/**
 * Implementação local (navegador) do contrato `SireRepository`.
 *
 * Simula o comportamento esperado do backend Dataverse:
 *  - autorização verificada na fonte (cada operação valida o perfil do ator);
 *  - idempotência na criação (mesma chave ⇒ mesmo registro, nunca duplicata);
 *  - concorrência otimista (`rowVersion`);
 *  - histórico e auditoria somente-acréscimo (nunca sobrescreve a linha do tempo);
 *  - exclusão lógica;
 *  - latência e indisponibilidade simuladas para exercitar estados de carregamento/erro.
 *
 * AUTENTICAÇÃO É SIMULADA: o "ator" vem do seletor de perfil da demo e não é segurança real.
 */
import type {
  Actor,
  AuditLogEntry,
  Catalog,
  Incident,
  IncidentAggregate,
  IncidentInput,
  IncidentMilestone,
  IncidentPatch,
  IncidentStatus,
  IsoUtc,
  MilestoneType,
} from '../../domain/types';
import type { ChildInput, ChildKind, IncidentQuery, IntegrationExport, Page, SireRepository, TransitionOptions } from '../repository';
import type { OperationalDataset } from '../../domain/metrics';
import { can, canEditIncident, type Permission } from '../../domain/permissions';
import {
  cancelAllowedFor,
  canTransition,
  isFinal,
  MIN_REASON_LENGTH,
  STATUS_LABEL,
  STATUS_MILESTONES,
  STATUS_ORDER,
} from '../../domain/status';
import { checkNewMilestone, effectiveMilestones, MILESTONE_LABEL } from '../../domain/milestones';
import { closureChecklist, isClosureReady, validateIncidentInput, validatePatch, type SaveMode } from '../../domain/validation';
import { formatProtocol, uuid } from '../../domain/ids';
import { isValidIso } from '../../domain/time';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  StorageError,
  TransitionError,
  UnavailableError,
  ValidationFailedError,
} from '../errors';
import { LocalStorageDriver, type DemoDb, type StorageDriver } from './db';
import { buildSeedDb, DEFAULT_SEED } from '../seed/seed';
import { buildIntegrationExport } from '../export/integration';

export interface MockRepositoryOptions {
  driver?: StorageDriver;
  clock?: () => Date;
  latencyMs?: number;
  seed?: number;
}

const PERMISSION_LABEL: Record<Permission, string> = {
  'incident.view': 'consultar ocorrências',
  'incident.create': 'registrar chamados',
  'incident.edit': 'editar ocorrências',
  'incident.advance': 'avançar o status da ocorrência',
  'incident.close': 'encerrar ocorrências',
  'incident.correctClosed': 'corrigir ocorrências encerradas',
  'incident.addResources': 'registrar recursos e eventos',
  'incident.report': 'emitir relatórios',
  'contacts.view': 'consultar contatos',
  'integration.export': 'exportar dados de integração',
  'audit.view': 'consultar auditoria',
  'admin.config': 'alterar parametrizações',
  'admin.reset': 'reiniciar a demonstração',
};

const INPUT_FIELDS: (keyof IncidentInput)[] = [
  'callReceivedAtUTC', 'channel', 'categoryId', 'priority', 'phase', 'title', 'description', 'callerName', 'callerPhone',
  'hasVictims', 'victimCount', 'victimConditionSummary', 'areaId', 'locationId', 'reference', 'suggestedBaseId',
  'responsibleBaseId', 'teamId',
];

const MAX_ATTACHMENTS = 8;
const MAX_ATTACHMENT_CHARS = 900_000; // ~650 KB binário em base64

export class MockRepository implements SireRepository {
  readonly kind = 'mock' as const;
  private readonly driver: StorageDriver;
  private readonly clock: () => Date;
  private readonly latencyMs: number;
  private readonly seed: number;
  private readonly listeners = new Set<() => void>();
  private outage = false;

  constructor(opts: MockRepositoryOptions = {}) {
    this.driver = opts.driver ?? new LocalStorageDriver();
    this.clock = opts.clock ?? (() => new Date());
    this.latencyMs = opts.latencyMs ?? 0;
    this.seed = opts.seed ?? DEFAULT_SEED;
    this.driver.onExternalChange?.(() => this.emit());
  }

  // ------------------------------------------------------------ infraestrutura

  /** Liga/desliga a simulação de indisponibilidade (para demonstrar estados de erro). */
  setSimulatedOutage(on: boolean): void {
    this.outage = on;
    this.emit();
  }

  get simulatedOutage(): boolean {
    return this.outage;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    if (this.outage) throw new UnavailableError();
  }

  private now(): Date {
    return this.clock();
  }

  private nowIso(): IsoUtc {
    return this.now().toISOString();
  }

  private load(): DemoDb {
    const db = this.driver.load();
    if (db) return db;
    const fresh = buildSeedDb(this.now(), this.seed);
    this.persist(fresh);
    return fresh;
  }

  private persist(db: DemoDb): void {
    try {
      this.driver.save(db);
    } catch {
      throw new StorageError();
    }
  }

  /** Executa uma mutação de forma atômica: tudo ou nada. */
  private async mutate<T>(fn: (db: DemoDb) => T): Promise<T> {
    await this.delay();
    const db = this.load();
    const result = fn(db);
    this.persist(db);
    this.emit();
    return result;
  }

  private async read<T>(fn: (db: DemoDb) => T): Promise<T> {
    await this.delay();
    return fn(this.load());
  }

  private assertCan(actor: Actor, p: Permission): void {
    if (!can(actor.role, p)) throw new ForbiddenError(PERMISSION_LABEL[p]);
  }

  private findIncident(db: DemoDb, id: string): Incident {
    const inc = db.incidents.find((i) => i.id === id && !i.isDeleted);
    if (!inc) throw new NotFoundError('Ocorrência');
    return inc;
  }

  private audit(
    db: DemoDb,
    actor: Actor,
    operationId: string,
    entry: Pick<AuditLogEntry, 'entity' | 'entityId' | 'action'> & Partial<Pick<AuditLogEntry, 'field' | 'oldValue' | 'newValue' | 'reason'>>,
  ): void {
    db.auditLog.push({
      id: uuid(),
      operationId,
      field: null,
      oldValue: null,
      newValue: null,
      reason: '',
      ...entry,
      actorName: actor.name,
      actorRole: actor.role,
      atUTC: this.nowIso(),
    });
  }

  private event(db: DemoDb, incidentId: string, actor: Actor, type: IncidentAggregate['events'][number]['type'], text: string, atUTC?: IsoUtc) {
    db.events.push({ id: uuid(), incidentId, type, atUTC: atUTC ?? this.nowIso(), actorName: actor.name, text });
  }

  private touch(inc: Incident, actor: Actor, bumpVersion: boolean): void {
    inc.updatedAtUTC = this.nowIso();
    inc.updatedBy = actor.name;
    if (bumpVersion) inc.rowVersion += 1;
  }

  private titleFor(db: DemoDb, categoryId: string, locationId: string | null): string {
    const cat = db.catalog.categories.find((c) => c.id === categoryId);
    const loc = db.catalog.locations.find((l) => l.id === locationId);
    return [cat?.name ?? 'Ocorrência sem categoria', loc?.name].filter(Boolean).join(' · ');
  }

  private addMilestoneRow(db: DemoDb, incidentId: string, type: MilestoneType, atUTC: IsoUtc, actor: Actor, vehicleId: string | null = null): IncidentMilestone {
    const row: IncidentMilestone = { id: uuid(), incidentId, type, atUTC, vehicleId, actorName: actor.name, recordedAtUTC: this.nowIso(), isDeleted: false };
    db.milestones.push(row);
    return row;
  }

  // ------------------------------------------------------------ leitura

  getCatalog(): Promise<Catalog> {
    return this.read((db) => db.catalog);
  }

  listIncidents(q: IncidentQuery): Promise<Page<Incident>> {
    return this.read((db) => {
      const term = (q.search ?? '').trim().toLocaleLowerCase('pt-BR');
      const locName = new Map(db.catalog.locations.map((l) => [l.id, l.name.toLocaleLowerCase('pt-BR')]));
      let rows = db.incidents.filter((i) => !i.isDeleted);
      if (q.statuses?.length) rows = rows.filter((i) => q.statuses?.includes(i.status));
      if (q.categoryId) rows = rows.filter((i) => i.categoryId === q.categoryId);
      if (q.areaId) rows = rows.filter((i) => i.areaId === q.areaId);
      if (q.priority) rows = rows.filter((i) => i.priority === q.priority);
      if (q.fromUTC) rows = rows.filter((i) => Date.parse(i.callReceivedAtUTC) >= Date.parse(q.fromUTC as string));
      if (q.toUTC) rows = rows.filter((i) => Date.parse(i.callReceivedAtUTC) <= Date.parse(q.toUTC as string));
      if (term) {
        rows = rows.filter((i) =>
          [i.protocol, i.title, i.description, i.callerName, locName.get(i.locationId ?? '') ?? '']
            .join(' ')
            .toLocaleLowerCase('pt-BR')
            .includes(term),
        );
      }
      const sort = q.sort ?? 'recent';
      rows.sort((a, b) => {
        if (sort === 'oldest') return Date.parse(a.callReceivedAtUTC) - Date.parse(b.callReceivedAtUTC);
        if (sort === 'priority') return a.priority.localeCompare(b.priority) || Date.parse(b.callReceivedAtUTC) - Date.parse(a.callReceivedAtUTC);
        if (sort === 'status') {
          const rank = (s: IncidentStatus) => (s === 'CANCELADA' ? 99 : STATUS_ORDER.indexOf(s));
          return rank(a.status) - rank(b.status) || Date.parse(b.callReceivedAtUTC) - Date.parse(a.callReceivedAtUTC);
        }
        return Date.parse(b.callReceivedAtUTC) - Date.parse(a.callReceivedAtUTC);
      });
      const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
      const total = rows.length;
      const maxPage = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(Math.max(q.page ?? 1, 1), maxPage);
      return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
    });
  }

  getIncident(id: string): Promise<IncidentAggregate> {
    return this.read((db) => {
      const incident = this.findIncident(db, id);
      const of = <T extends { incidentId: string }>(rows: T[]) => rows.filter((r) => r.incidentId === id);
      return {
        incident,
        statusHistory: of(db.statusHistory).sort((a, b) => Date.parse(a.atUTC) - Date.parse(b.atUTC)),
        milestones: of(db.milestones),
        events: of(db.events),
        vehicles: of(db.vehicles),
        personnel: of(db.personnel),
        victims: of(db.victims),
        witnesses: of(db.witnesses),
        otherResources: of(db.otherResources),
        attachments: of(db.attachments),
        notifications: of(db.notifications),
      };
    });
  }

  getOperationalDataset(): Promise<OperationalDataset> {
    return this.read((db) => ({
      incidents: db.incidents,
      milestones: db.milestones,
      statusHistory: db.statusHistory,
      vehicles: db.vehicles,
    }));
  }

  listAudit(entityId?: string): Promise<AuditLogEntry[]> {
    return this.read((db) =>
      db.auditLog.filter((a) => !entityId || a.entityId === entityId).sort((a, b) => Date.parse(b.atUTC) - Date.parse(a.atUTC)),
    );
  }

  // ------------------------------------------------------------ escrita: ocorrência

  createIncident(actor: Actor, input: IncidentInput, opts: { mode: SaveMode; idempotencyKey: string }): Promise<Incident> {
    return this.mutate((db) => {
      this.assertCan(actor, 'incident.create');
      const existing = db.incidents.find((i) => i.idempotencyKey === opts.idempotencyKey);
      if (existing) return existing; // clique duplo / reenvio: devolve o mesmo registro

      const now = this.now();
      const errors = validateIncidentInput(input, opts.mode, db.catalog, now);
      if (errors.length) throw new ValidationFailedError(errors);

      const year = new Date(input.callReceivedAtUTC).getUTCFullYear();
      const seq = (db.counters.protocolByYear[year] ?? 0) + 1;
      db.counters.protocolByYear[year] = seq;
      const status: IncidentStatus = opts.mode === 'draft' ? 'RASCUNHO' : 'REGISTRADA';
      const nowIso = now.toISOString();
      const inc: Incident = {
        ...input,
        title: this.titleFor(db, input.categoryId, input.locationId),
        victimCount: input.hasVictims ? input.victimCount : null,
        id: uuid(),
        protocol: formatProtocol(year, seq),
        idempotencyKey: opts.idempotencyKey,
        status,
        operatorName: actor.name,
        classification: '',
        unfolding: '',
        extinguishingAgent: '',
        extinguishingQty: '',
        affectedAreaM2: null,
        chemicalProduct: '',
        paeItem: '',
        attended: null,
        closingSummary: '',
        cancelReason: '',
        closedAtUTC: null,
        createdAtUTC: nowIso,
        updatedAtUTC: nowIso,
        createdBy: actor.name,
        updatedBy: actor.name,
        source: 'SIRE_APP',
        isDemo: true,
        rowVersion: 1,
        isDeleted: false,
      };
      db.incidents.push(inc);
      db.statusHistory.push({ id: uuid(), incidentId: inc.id, fromStatus: null, toStatus: status, atUTC: nowIso, actorName: actor.name, actorRole: actor.role, reason: '' });
      if (status === 'REGISTRADA') this.addMilestoneRow(db, inc.id, 'CHAMADO', inc.callReceivedAtUTC, actor);
      this.event(db, inc.id, actor, 'SISTEMA', status === 'RASCUNHO' ? 'Rascunho salvo — ainda não é uma ocorrência registrada.' : 'Ocorrência registrada na central.');
      this.audit(db, actor, uuid(), { entity: 'Incident', entityId: inc.id, action: 'CREATE', newValue: `${inc.protocol} (${STATUS_LABEL[status]})` });
      return inc;
    });
  }

  updateIncident(actor: Actor, id: string, patch: IncidentPatch, opts: { expectedVersion: number; reason?: string }): Promise<Incident> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, id);
      if (inc.status === 'CANCELADA') throw new ForbiddenError('editar ocorrências canceladas');
      if (!canEditIncident(actor.role, inc.status)) {
        throw new ForbiddenError(inc.status === 'ENCERRADA' ? PERMISSION_LABEL['incident.correctClosed'] : PERMISSION_LABEL['incident.edit']);
      }
      if (inc.rowVersion !== opts.expectedVersion) throw new ConflictError();
      const isCorrection = inc.status === 'ENCERRADA';
      const reason = (opts.reason ?? '').trim();
      if (isCorrection && reason.length < MIN_REASON_LENGTH) {
        throw new ValidationFailedError([{ field: 'reason', message: `Correção em ocorrência encerrada exige justificativa (mín. ${MIN_REASON_LENGTH} caracteres).` }]);
      }

      const patchErrors = validatePatch(patch);
      if (patchErrors.length) throw new ValidationFailedError(patchErrors);

      const touchesInput = Object.keys(patch).some((k) => (INPUT_FIELDS as string[]).includes(k));
      if (touchesInput) {
        const merged = { ...inc, ...patch } as Incident;
        if (!merged.hasVictims) merged.victimCount = null;
        const mode: SaveMode = inc.status === 'RASCUNHO' ? 'draft' : 'register';
        const errors = validateIncidentInput(merged, mode, db.catalog, this.now());
        if (errors.length) throw new ValidationFailedError(errors);
        if (!merged.hasVictims) patch = { ...patch, victimCount: null };
      }

      const opId = uuid();
      const changes: string[] = [];
      for (const [field, value] of Object.entries(patch) as [keyof Incident, unknown][]) {
        const before = inc[field];
        if (JSON.stringify(before) === JSON.stringify(value)) continue;
        (inc as unknown as Record<string, unknown>)[field] = value;
        changes.push(field);
        this.audit(db, actor, opId, {
          entity: 'Incident',
          entityId: inc.id,
          action: isCorrection ? 'CORRECTION' : 'UPDATE',
          field,
          oldValue: before === null || before === undefined ? null : String(before),
          newValue: value === null || value === undefined ? null : String(value),
          reason,
        });
      }
      if (changes.length === 0) return inc;
      if (changes.includes('categoryId') || changes.includes('locationId')) inc.title = this.titleFor(db, inc.categoryId, inc.locationId);
      this.touch(inc, actor, true);
      if (isCorrection) this.event(db, inc.id, actor, 'CORRECAO', `Correção auditada (${changes.length} campo(s)): ${reason}`);
      return inc;
    });
  }

  transitionIncident(actor: Actor, id: string, to: IncidentStatus, opts: TransitionOptions): Promise<Incident> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, id);
      const from = inc.status;
      if (inc.rowVersion !== opts.expectedVersion) throw new ConflictError();
      const reason = (opts.reason ?? '').trim();
      const now = this.now();
      const atUTC = opts.atUTC ?? now.toISOString();
      if (!isValidIso(atUTC)) throw new ValidationFailedError([{ field: 'atUTC', message: 'Data/hora inválida.' }]);

      if (to === 'CANCELADA') {
        if (isFinal(from)) throw new TransitionError(`Ocorrência ${STATUS_LABEL[from].toLowerCase()} não pode ser cancelada.`);
        if (!cancelAllowedFor(actor.role, from)) throw new ForbiddenError(`cancelar ocorrência no status "${STATUS_LABEL[from]}"`);
        if (reason.length < MIN_REASON_LENGTH) {
          throw new ValidationFailedError([{ field: 'reason', message: `Informe a justificativa do cancelamento (mín. ${MIN_REASON_LENGTH} caracteres).` }]);
        }
        inc.cancelReason = reason;
        inc.closedAtUTC = now.toISOString();
      } else {
        if (!canTransition(from, to)) {
          throw new TransitionError(`Transição não permitida: ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}.`);
        }
        this.assertCan(actor, to === 'ENCERRADA' ? 'incident.close' : 'incident.advance');

        if (from === 'RASCUNHO') {
          const errors = validateIncidentInput(inc, 'register', db.catalog, now);
          if (errors.length) throw new ValidationFailedError(errors);
        }
        if (to === 'ACIONADA' && !inc.responsibleBaseId) {
          throw new TransitionError('Defina a base responsável antes de confirmar o acionamento.');
        }

        // Marcos de tempo associados à transição — validados antes de qualquer gravação.
        const milestonesToAdd = (STATUS_MILESTONES[to] ?? []).filter((m) => !effectiveMilestones(db.milestones.filter((x) => x.incidentId === id))[m]);
        const current = db.milestones.filter((m) => m.incidentId === id);
        const simulated = [...current];
        if (from === 'RASCUNHO') simulated.push({ id: 'tmp', incidentId: id, type: 'CHAMADO', atUTC: inc.callReceivedAtUTC, vehicleId: null, actorName: '', recordedAtUTC: '', isDeleted: false });
        for (const m of milestonesToAdd) {
          const issues = checkNewMilestone(simulated, m, atUTC, now);
          if (issues.length) throw new ValidationFailedError(issues.map((i) => ({ field: 'atUTC', message: i.message })));
          simulated.push({ id: 'tmp', incidentId: id, type: m, atUTC, vehicleId: null, actorName: '', recordedAtUTC: '', isDeleted: false });
        }

        if (to === 'ENCERRADA') {
          const summary = opts.closingSummary ?? inc.closingSummary;
          const agg = this.aggregateOf(db, inc);
          const checks = closureChecklist(agg, db.catalog, now, summary);
          if (!isClosureReady(checks)) throw new TransitionError('Checklist de encerramento incompleto.', checks);
          if (summary !== inc.closingSummary) {
            this.audit(db, actor, uuid(), { entity: 'Incident', entityId: inc.id, action: 'UPDATE', field: 'closingSummary', oldValue: inc.closingSummary, newValue: summary });
            inc.closingSummary = summary;
          }
          inc.closedAtUTC = atUTC;
        }

        if (from === 'RASCUNHO') this.addMilestoneRow(db, id, 'CHAMADO', inc.callReceivedAtUTC, actor);
        for (const m of milestonesToAdd) this.addMilestoneRow(db, id, m, atUTC, actor, opts.vehicleId ?? null);
      }

      inc.status = to;
      this.touch(inc, actor, true);
      db.statusHistory.push({ id: uuid(), incidentId: id, fromStatus: from, toStatus: to, atUTC: now.toISOString(), actorName: actor.name, actorRole: actor.role, reason });
      this.event(db, id, actor, 'SISTEMA', `Status alterado: ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}${reason ? ` — ${reason}` : ''}`);
      this.audit(db, actor, uuid(), { entity: 'Incident', entityId: id, action: 'TRANSITION', field: 'status', oldValue: from, newValue: to, reason });
      return inc;
    });
  }

  private aggregateOf(db: DemoDb, incident: Incident): IncidentAggregate {
    const of = <T extends { incidentId: string }>(rows: T[]) => rows.filter((r) => r.incidentId === incident.id);
    return {
      incident,
      statusHistory: of(db.statusHistory),
      milestones: of(db.milestones),
      events: of(db.events),
      vehicles: of(db.vehicles),
      personnel: of(db.personnel),
      victims: of(db.victims),
      witnesses: of(db.witnesses),
      otherResources: of(db.otherResources),
      attachments: of(db.attachments),
      notifications: of(db.notifications),
    };
  }

  // ------------------------------------------------------------ escrita: marcos, recursos, notas

  private assertCanWriteChild(actor: Actor, inc: Incident, allowOnClosed: boolean = false): void {
    if (inc.status === 'CANCELADA') throw new ForbiddenError('alterar ocorrências canceladas');
    if (inc.status === 'ENCERRADA' && !allowOnClosed) this.assertCan(actor, 'incident.correctClosed');
    else this.assertCan(actor, 'incident.addResources');
  }

  recordMilestone(actor: Actor, incidentId: string, m: { type: MilestoneType; atUTC: IsoUtc; vehicleId: string | null }): Promise<IncidentMilestone> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, incidentId);
      if (inc.status === 'RASCUNHO') throw new TransitionError('Registre a ocorrência antes de lançar marcos de tempo.');
      const postClosure = m.type === 'SAIDA_LOCAL' || m.type === 'CHEGADA_BASE';
      this.assertCanWriteChild(actor, inc, postClosure);
      if (!isValidIso(m.atUTC)) throw new ValidationFailedError([{ field: 'atUTC', message: 'Data/hora inválida.' }]);
      if (m.vehicleId && !db.catalog.vehicles.some((v) => v.id === m.vehicleId)) throw new ValidationFailedError([{ field: 'vehicleId', message: 'Viatura inexistente.' }]);
      const issues = checkNewMilestone(db.milestones.filter((x) => x.incidentId === incidentId), m.type, m.atUTC, this.now());
      if (issues.length) throw new ValidationFailedError(issues.map((i) => ({ field: 'atUTC', message: i.message })));
      const row = this.addMilestoneRow(db, incidentId, m.type, m.atUTC, actor, m.vehicleId);
      this.touch(inc, actor, false);
      this.event(db, incidentId, actor, 'RECURSO', `Marco registrado: ${MILESTONE_LABEL[m.type]}`, m.atUTC);
      this.audit(db, actor, uuid(), { entity: 'IncidentMilestone', entityId: incidentId, action: 'ADD_CHILD', field: m.type, newValue: m.atUTC });
      return row;
    });
  }

  removeMilestone(actor: Actor, incidentId: string, milestoneId: string, reason: string): Promise<void> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, incidentId);
      this.assertCanWriteChild(actor, inc);
      if (reason.trim().length < 5) throw new ValidationFailedError([{ field: 'reason', message: 'Informe o motivo da exclusão (mín. 5 caracteres).' }]);
      const row = db.milestones.find((m) => m.id === milestoneId && m.incidentId === incidentId && !m.isDeleted);
      if (!row) throw new NotFoundError('Marco');
      row.isDeleted = true;
      this.touch(inc, actor, false);
      this.event(db, incidentId, actor, 'CORRECAO', `Marco "${MILESTONE_LABEL[row.type]}" desconsiderado: ${reason.trim()}`);
      this.audit(db, actor, uuid(), { entity: 'IncidentMilestone', entityId: incidentId, action: 'REMOVE_CHILD', field: row.type, oldValue: row.atUTC, reason: reason.trim() });
    });
  }

  addChild(actor: Actor, incidentId: string, child: ChildInput): Promise<void> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, incidentId);
      this.assertCanWriteChild(actor, inc);
      const fail = (field: string, message: string): never => {
        throw new ValidationFailedError([{ field, message }]);
      };
      let summary = '';
      switch (child.kind) {
        case 'vehicle': {
          const v = db.catalog.vehicles.find((x) => x.id === child.vehicleId);
          if (!v) fail('vehicleId', 'Selecione uma viatura cadastrada.');
          if (db.vehicles.some((x) => x.incidentId === incidentId && x.vehicleId === child.vehicleId && !x.isDeleted)) fail('vehicleId', 'Viatura já vinculada a esta ocorrência.');
          if (child.kmStart !== null && child.kmStart < 0) fail('kmStart', 'Km inicial inválido.');
          if (child.kmStart !== null && child.kmEnd !== null && child.kmEnd < child.kmStart) fail('kmEnd', 'Km final não pode ser menor que o inicial.');
          db.vehicles.push({ id: uuid(), incidentId, vehicleId: child.vehicleId, kmStart: child.kmStart, kmEnd: child.kmEnd, isDeleted: false });
          summary = `Viatura vinculada: ${v?.code} · ${v?.description}`;
          break;
        }
        case 'personnel': {
          const p = db.catalog.people.find((x) => x.id === child.personId);
          if (!p) fail('personId', 'Selecione uma pessoa cadastrada.');
          if (db.personnel.some((x) => x.incidentId === incidentId && x.personId === child.personId && !x.isDeleted)) fail('personId', 'Pessoa já incluída no efetivo.');
          db.personnel.push({ id: uuid(), incidentId, personId: child.personId, functionInIncident: child.functionInIncident.trim() || 'Combatente / socorrista', isDeleted: false });
          summary = `Efetivo incluído: ${p?.name}`;
          break;
        }
        case 'victim': {
          if (!inc.hasVictims) fail('pseudonym', 'Marque "Há vítimas?" como Sim e informe a quantidade antes de detalhar vítimas.');
          if (!child.data.pseudonym.trim()) fail('pseudonym', 'Informe uma identificação (pseudônimo) para a vítima.');
          db.victims.push({ id: uuid(), incidentId, ...child.data, pseudonym: child.data.pseudonym.trim(), isDeleted: false });
          summary = `Vítima detalhada: ${child.data.pseudonym.trim()}`;
          break;
        }
        case 'witness': {
          if (!child.name.trim()) fail('name', 'Informe o nome (fictício) da testemunha.');
          if (child.statement.trim().length < 10) fail('statement', 'O depoimento deve ter pelo menos 10 caracteres.');
          db.witnesses.push({ id: uuid(), incidentId, name: child.name.trim(), statement: child.statement.trim(), takenAtUTC: child.takenAtUTC, isDeleted: false });
          summary = `Depoimento registrado: ${child.name.trim()}`;
          break;
        }
        case 'otherResource': {
          if (!child.data.description.trim()) fail('description', 'Descreva o recurso.');
          if (!Number.isFinite(child.data.quantity) || child.data.quantity < 1) fail('quantity', 'Quantidade deve ser no mínimo 1.');
          db.otherResources.push({ id: uuid(), incidentId, ...child.data, description: child.data.description.trim(), isDeleted: false });
          summary = `Recurso registrado: ${child.data.quantity} × ${child.data.description.trim()}`;
          break;
        }
        case 'attachment': {
          if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(child.mimeType)) fail('file', 'Formato não suportado. Use PNG, JPEG ou WEBP.');
          if (child.dataUrl.length > MAX_ATTACHMENT_CHARS) fail('file', 'Imagem muito grande após compressão (limite ~650 KB).');
          if (db.attachments.filter((a) => a.incidentId === incidentId && !a.isDeleted).length >= MAX_ATTACHMENTS) fail('file', `Limite de ${MAX_ATTACHMENTS} imagens por ocorrência na demo.`);
          db.attachments.push({
            id: uuid(), incidentId, fileName: child.fileName, caption: child.caption.trim() || child.fileName, mimeType: child.mimeType, dataUrl: child.dataUrl,
            isSynthetic: child.isSynthetic, sizeBytes: Math.round((child.dataUrl.length * 3) / 4), addedAtUTC: this.nowIso(), actorName: actor.name, isDeleted: false,
          });
          summary = `Imagem anexada: ${child.caption.trim() || child.fileName}`;
          break;
        }
        case 'notification': {
          const t = db.catalog.notificationTargets.find((x) => x.id === child.targetId);
          if (!t) fail('targetId', 'Selecione o órgão/função acionado.');
          if (!isValidIso(child.atUTC)) fail('atUTC', 'Horário inválido.');
          if (Date.parse(child.atUTC) > this.now().getTime() + 2 * 60000) fail('atUTC', 'O horário do acionamento não pode estar no futuro.');
          if (Date.parse(child.atUTC) < Date.parse(inc.callReceivedAtUTC)) fail('atUTC', 'O acionamento não pode ser anterior ao chamado.');
          db.notifications.push({ id: uuid(), incidentId, targetId: child.targetId, atUTC: child.atUTC, actorName: actor.name, note: child.note.trim(), isDeleted: false });
          summary = `Acionamento registrado (simulado): ${t?.name}`;
          break;
        }
      }
      this.touch(inc, actor, false);
      this.event(db, incidentId, actor, child.kind === 'attachment' ? 'ANEXO' : child.kind === 'notification' ? 'ACIONAMENTO' : 'RECURSO', summary);
      this.audit(db, actor, uuid(), { entity: `Incident.${child.kind}`, entityId: incidentId, action: 'ADD_CHILD', newValue: summary, reason: inc.status === 'ENCERRADA' ? 'Correção pós-encerramento' : '' });
    });
  }

  removeChild(actor: Actor, incidentId: string, kind: ChildKind, childId: string, reason: string): Promise<void> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, incidentId);
      this.assertCanWriteChild(actor, inc);
      if (reason.trim().length < 5) throw new ValidationFailedError([{ field: 'reason', message: 'Informe o motivo da remoção (mín. 5 caracteres).' }]);
      const table = {
        vehicle: db.vehicles,
        personnel: db.personnel,
        victim: db.victims,
        witness: db.witnesses,
        otherResource: db.otherResources,
        attachment: db.attachments,
        notification: db.notifications,
      }[kind] as { id: string; incidentId: string; isDeleted: boolean }[];
      const row = table.find((r) => r.id === childId && r.incidentId === incidentId && !r.isDeleted);
      if (!row) throw new NotFoundError('Registro');
      row.isDeleted = true; // exclusão lógica: o registro permanece para auditoria
      this.touch(inc, actor, false);
      this.event(db, incidentId, actor, 'CORRECAO', `Registro removido (${kind}): ${reason.trim()}`);
      this.audit(db, actor, uuid(), { entity: `Incident.${kind}`, entityId: incidentId, action: 'REMOVE_CHILD', oldValue: childId, reason: reason.trim() });
    });
  }

  addNote(actor: Actor, incidentId: string, text: string): Promise<void> {
    return this.mutate((db) => {
      const inc = this.findIncident(db, incidentId);
      this.assertCanWriteChild(actor, inc);
      if (text.trim().length < 3) throw new ValidationFailedError([{ field: 'text', message: 'Escreva a anotação (mín. 3 caracteres).' }]);
      this.event(db, incidentId, actor, 'NOTA', text.trim());
      this.touch(inc, actor, false);
      this.audit(db, actor, uuid(), { entity: 'IncidentEvent', entityId: incidentId, action: 'ADD_CHILD', newValue: text.trim() });
    });
  }

  // ------------------------------------------------------------ integração e administração

  exportIntegration(actor: Actor): Promise<IntegrationExport> {
    return this.read((db) => {
      this.assertCan(actor, 'integration.export');
      return buildIntegrationExport(db, this.now());
    });
  }

  resetDemo(actor: Actor): Promise<void> {
    return this.mutate((db) => {
      this.assertCan(actor, 'admin.reset');
      const fresh = buildSeedDb(this.now(), this.seed);
      Object.assign(db, fresh);
      this.audit(db, actor, uuid(), { entity: 'Demo', entityId: 'demo', action: 'RESET', reason: 'Reinício da demonstração pelo administrador' });
    });
  }
}
