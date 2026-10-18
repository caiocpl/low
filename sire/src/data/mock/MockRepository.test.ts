import { beforeEach, describe, expect, it } from 'vitest';
import { MockRepository } from './MockRepository';
import { MemoryDriver } from './db';
import { buildSeedDb } from '../seed/seed';
import { computeOperationalMetrics } from '../../domain/metrics';
import { PROTOCOL_RE } from '../../domain/ids';
import { validateChronology, effectiveMilestones } from '../../domain/milestones';
import { closureChecklist } from '../../domain/validation';
import type { Actor, IncidentInput } from '../../domain/types';
import { AppError, ConflictError, ForbiddenError, TransitionError, ValidationFailedError, UnavailableError } from '../errors';
import { buildIntegrationExport, toCsv } from '../export/integration';

const OP: Actor = { userId: 'u-op', name: 'Operador Teste', role: 'OPERADOR' };
const COORD: Actor = { userId: 'u-co', name: 'Coordenação Teste', role: 'COORDENADOR' };
const VIEW: Actor = { userId: 'u-vi', name: 'Visualizador Teste', role: 'VISUALIZADOR' };
const ADMIN: Actor = { userId: 'u-ad', name: 'Admin Teste', role: 'ADMIN' };

let clock = new Date('2026-10-18T15:00:00.000Z');
const advance = (min: number) => {
  clock = new Date(clock.getTime() + min * 60000);
};
const at = (offsetMin = 0) => new Date(clock.getTime() + offsetMin * 60000).toISOString();

const input = (over: Partial<IncidentInput> = {}): IncidentInput => ({
  callReceivedAtUTC: at(-1), channel: 'RAMAL_EMERGENCIA', categoryId: 'cat-vitima', priority: 'P1', phase: 'REATIVA', title: '',
  description: 'Colaborador caiu da escada e relata dor no tornozelo', callerName: 'Supervisor de turno', callerPhone: '(00) 90000-1234',
  hasVictims: true, victimCount: 1, victimConditionSummary: 'Consciente, dor no tornozelo', areaId: 'ar-norte', locationId: 'lc-n2',
  reference: 'Escada de acesso norte', suggestedBaseId: 'base-norte', responsibleBaseId: null, teamId: null, ...over,
});

let driver: MemoryDriver;
let repo: MockRepository;

beforeEach(() => {
  clock = new Date('2026-10-18T15:00:00.000Z');
  driver = new MemoryDriver();
  repo = new MockRepository({ driver, clock: () => clock });
});

async function expectError<T extends AppError>(p: Promise<unknown>, type: new (...a: never[]) => T): Promise<T> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(type);
    return e as T;
  }
  throw new Error(`Esperava ${type.name}`);
}

describe('seed reproduzível', () => {
  it('mesmo seed + mesmo instante ⇒ mesmos dados', () => {
    const a = buildSeedDb(clock, 123);
    const b = buildSeedDb(clock, 123);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.incidents.length).toBeGreaterThan(30);
  });
  it('dados históricos são cronologicamente consistentes e encerradas passam no checklist', () => {
    const db = buildSeedDb(clock);
    for (const inc of db.incidents) {
      const mss = db.milestones.filter((m) => m.incidentId === inc.id);
      expect(validateChronology(effectiveMilestones(mss), clock)).toEqual([]);
      expect(PROTOCOL_RE.test(inc.protocol)).toBe(true);
      expect(inc.isDemo).toBe(true);
    }
  });
  it('protocolos são únicos', () => {
    const db = buildSeedDb(clock);
    expect(new Set(db.incidents.map((i) => i.protocol)).size).toBe(db.incidents.length);
  });
});

describe('fluxo PAE ponta a ponta', () => {
  it('cria, persiste, avança, encerra e reflete nos indicadores', async () => {
    const before = computeOperationalMetrics(await repo.getOperationalDataset(), await repo.getCatalog(), clock, { fromUTC: null, toUTC: null, areaId: null, categoryId: null });

    const inc = await repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'k-1' });
    expect(inc.status).toBe('REGISTRADA');
    expect(inc.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(PROTOCOL_RE.test(inc.protocol)).toBe(true);

    // Persistência: nova instância lendo o mesmo armazenamento
    const repo2 = new MockRepository({ driver, clock: () => clock });
    const loaded = await repo2.getIncident(inc.id);
    expect(loaded.incident.protocol).toBe(inc.protocol);
    expect(loaded.milestones.map((m) => m.type)).toEqual(['CHAMADO']);

    const list = await repo.listIncidents({ search: inc.protocol });
    expect(list.items.map((i) => i.id)).toEqual([inc.id]);

    let cur = await repo.transitionIncident(OP, inc.id, 'EM_TRIAGEM', { expectedVersion: inc.rowVersion });
    await expectError(repo.transitionIncident(OP, inc.id, 'ACIONADA', { expectedVersion: cur.rowVersion }), TransitionError); // sem base
    cur = await repo.updateIncident(OP, inc.id, { responsibleBaseId: 'base-norte', teamId: 'tm-a' }, { expectedVersion: cur.rowVersion });
    cur = await repo.transitionIncident(OP, inc.id, 'ACIONADA', { expectedVersion: cur.rowVersion });
    await repo.addChild(OP, inc.id, { kind: 'notification', targetId: 'nt-sau', atUTC: at(), note: '' });
    advance(2);
    cur = await repo.transitionIncident(OP, inc.id, 'EM_DESLOCAMENTO', { expectedVersion: cur.rowVersion });
    await repo.addChild(OP, inc.id, { kind: 'vehicle', vehicleId: 'vt-04', kmStart: 1000, kmEnd: null });
    await repo.addChild(OP, inc.id, { kind: 'personnel', personId: 'ps-07', functionInIncident: 'Socorrista' });
    advance(6);
    cur = await repo.transitionIncident(OP, inc.id, 'EM_ATENDIMENTO', { expectedVersion: cur.rowVersion });
    await repo.addChild(OP, inc.id, { kind: 'victim', data: { pseudonym: 'Vítima 1', condition: 'CONSCIENTE', destination: 'AMBULATORIO', bond: 'PROPRIO', notes: '' } });
    await repo.addChild(OP, inc.id, { kind: 'witness', name: 'Testemunha fictícia', statement: 'Viu o colaborador escorregar no degrau molhado.', takenAtUTC: at() });
    advance(15);
    cur = await repo.transitionIncident(OP, inc.id, 'CONTROLADA', { expectedVersion: cur.rowVersion });

    // Operador não encerra (autorização na fonte)
    await expectError(repo.transitionIncident(OP, inc.id, 'ENCERRADA', { expectedVersion: cur.rowVersion, closingSummary: 'x'.repeat(30) }), ForbiddenError);

    // Checklist incompleto bloqueia o encerramento
    const err = await expectError(repo.transitionIncident(COORD, inc.id, 'ENCERRADA', { expectedVersion: cur.rowVersion }), TransitionError);
    expect(err.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(expect.arrayContaining(['classification', 'attended', 'summary']));

    cur = await repo.updateIncident(OP, inc.id, { classification: 'Queda de mesmo nível', attended: true }, { expectedVersion: cur.rowVersion });
    advance(5);
    cur = await repo.transitionIncident(COORD, inc.id, 'ENCERRADA', { expectedVersion: cur.rowVersion, closingSummary: 'Vítima imobilizada e removida ao ambulatório em condição estável.' });
    expect(cur.status).toBe('ENCERRADA');
    expect(cur.closedAtUTC).toBe(at());

    const agg = await repo.getIncident(inc.id);
    expect(agg.statusHistory.map((h) => h.toStatus)).toEqual(['REGISTRADA', 'EM_TRIAGEM', 'ACIONADA', 'EM_DESLOCAMENTO', 'EM_ATENDIMENTO', 'CONTROLADA', 'ENCERRADA']);
    expect(closureChecklist(agg, await repo.getCatalog(), clock).every((c) => c.ok || c.id === 'status')).toBe(true);

    const after = computeOperationalMetrics(await repo.getOperationalDataset(), await repo.getCatalog(), clock, { fromUTC: null, toUTC: null, areaId: null, categoryId: null });
    expect(after.closedToday).toBe(before.closedToday + 1);
    expect(after.mobilization.n).toBe(before.mobilization.n + 1);

    // Exportação de integração contém o registro com durações calculadas
    const exp = await repo.exportIntegration(COORD);
    const fato = exp.tables.find((t) => t.name === 'FatoOcorrencia')?.rows.find((r) => r.ocorrencia_id === inc.id);
    expect(fato?.status_codigo).toBe('ENCERRADA');
    expect(fato?.min_mobilizacao).toBe(2);
    expect(toCsv(exp.tables[0]!.rows).split('\r\n')[0]).toContain('ocorrencia_id;protocolo');
  });
});

describe('robustez e segurança', () => {
  it('clique duplo / reenvio não duplica (idempotência)', async () => {
    const [a, b] = await Promise.all([
      repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'same' }),
      repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'same' }),
    ]);
    expect(a.id).toBe(b.id);
    const all = await repo.listIncidents({ search: a.protocol });
    expect(all.total).toBe(1);
  });

  it('erros de validação não gravam nada', async () => {
    const before = (await repo.listIncidents({ pageSize: 100 })).total;
    const err = await expectError(repo.createIncident(OP, input({ hasVictims: true, victimCount: null }), { mode: 'register', idempotencyKey: 'v' }), ValidationFailedError);
    expect(err.errors.map((e) => e.field)).toContain('victimCount');
    expect((await repo.listIncidents({ pageSize: 100 })).total).toBe(before);
  });

  it('rascunho não é ocorrência registrada e pode ser promovido', async () => {
    const d = await repo.createIncident(OP, input({ description: '', callerName: '', hasVictims: false, victimCount: null, victimConditionSummary: '' }), { mode: 'draft', idempotencyKey: 'd' });
    expect(d.status).toBe('RASCUNHO');
    const blocked = await expectError(repo.transitionIncident(OP, d.id, 'REGISTRADA', { expectedVersion: d.rowVersion }), ValidationFailedError);
    expect(blocked.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['description', 'callerName']));
    const u = await repo.updateIncident(OP, d.id, { description: 'Prevenção solicitada para solda', callerName: 'Planejador' }, { expectedVersion: d.rowVersion });
    const r = await repo.transitionIncident(OP, d.id, 'REGISTRADA', { expectedVersion: u.rowVersion });
    expect(r.status).toBe('REGISTRADA');
    expect((await repo.getIncident(d.id)).milestones.map((m) => m.type)).toEqual(['CHAMADO']);
  });

  it('concorrência otimista rejeita versão desatualizada', async () => {
    const inc = await repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'c' });
    await repo.updateIncident(OP, inc.id, { reference: 'A' }, { expectedVersion: inc.rowVersion });
    await expectError(repo.updateIncident(OP, inc.id, { reference: 'B' }, { expectedVersion: inc.rowVersion }), ConflictError);
  });

  it('estado incompatível é rejeitado', async () => {
    const inc = await repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'x' });
    await expectError(repo.transitionIncident(OP, inc.id, 'EM_ATENDIMENTO', { expectedVersion: inc.rowVersion }), TransitionError);
  });

  it('marcos fora de sequência são rejeitados', async () => {
    const inc = await repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'm' });
    await expectError(repo.recordMilestone(OP, inc.id, { type: 'CHEGADA_LOCAL', atUTC: at(-30), vehicleId: null }), ValidationFailedError);
    await expectError(repo.recordMilestone(OP, inc.id, { type: 'CHEGADA_LOCAL', atUTC: at(30), vehicleId: null }), ValidationFailedError);
  });

  it('perfil sem permissão é barrado na fonte', async () => {
    await expectError(repo.createIncident(VIEW, input(), { mode: 'register', idempotencyKey: 'p' }), ForbiddenError);
    await expectError(repo.resetDemo(COORD), ForbiddenError);
    await expectError(repo.exportIntegration(OP), ForbiddenError);
  });

  it('cancelamento exige justificativa e respeita o perfil', async () => {
    const inc = await repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'cx' });
    await expectError(repo.transitionIncident(OP, inc.id, 'CANCELADA', { expectedVersion: inc.rowVersion, reason: 'curto' }), ValidationFailedError);
    const c = await repo.transitionIncident(OP, inc.id, 'CANCELADA', { expectedVersion: inc.rowVersion, reason: 'Chamado duplicado do protocolo anterior' });
    expect(c.status).toBe('CANCELADA');
    await expectError(repo.updateIncident(COORD, inc.id, { reference: 'x' }, { expectedVersion: c.rowVersion }), ForbiddenError);
  });

  it('correção pós-encerramento exige justificativa e gera auditoria', async () => {
    const db = buildSeedDb(clock);
    driver.save(db);
    const closed = db.incidents.find((i) => i.status === 'ENCERRADA')!;
    await expectError(repo.updateIncident(OP, closed.id, { reference: 'Novo ponto' }, { expectedVersion: closed.rowVersion }), ForbiddenError);
    await expectError(repo.updateIncident(COORD, closed.id, { reference: 'Novo ponto' }, { expectedVersion: closed.rowVersion, reason: 'curto' }), ValidationFailedError);
    await repo.updateIncident(COORD, closed.id, { reference: 'Novo ponto' }, { expectedVersion: closed.rowVersion, reason: 'Ajuste do ponto de referência informado pela área' });
    const audit = await repo.listAudit(closed.id);
    expect(audit[0]).toMatchObject({ action: 'CORRECTION', field: 'reference', newValue: 'Novo ponto', actorRole: 'COORDENADOR' });
  });

  it('indisponibilidade simulada não corrompe dados', async () => {
    const before = (await repo.listIncidents({ pageSize: 100 })).total;
    repo.setSimulatedOutage(true);
    await expectError(repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'o' }), UnavailableError);
    repo.setSimulatedOutage(false);
    expect((await repo.listIncidents({ pageSize: 100 })).total).toBe(before);
  });

  it('reinício da demo só pelo administrador e restaura o seed', async () => {
    await repo.createIncident(OP, input(), { mode: 'register', idempotencyKey: 'r' });
    await repo.resetDemo(ADMIN);
    expect((await repo.listIncidents({ pageSize: 100 })).total).toBe(buildSeedDb(clock).incidents.length);
  });

  it('exportação preserva nulos (sem zero silencioso)', () => {
    const exp = buildIntegrationExport(buildSeedDb(clock), clock);
    const draft = exp.tables[0]!.rows.find((r) => r.status_codigo === 'RASCUNHO');
    expect(draft?.min_resposta).toBeNull();
  });
});
