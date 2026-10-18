/**
 * Contrato único de acesso a dados. A UI e os casos de uso dependem apenas desta
 * interface; `MockRepository` (demo local) e `DataverseRepository` (futuro) a implementam.
 * Toda autorização é verificada AQUI (na fonte), não apenas escondendo botões na UI.
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
  IncidentVictim,
  IncidentOtherResource,
  IsoUtc,
  MilestoneType,
  Priority,
} from '../domain/types';
import type { OperationalDataset } from '../domain/metrics';
import type { SaveMode } from '../domain/validation';

export interface IncidentQuery {
  search?: string;
  statuses?: IncidentStatus[];
  categoryId?: string | null;
  areaId?: string | null;
  priority?: Priority | null;
  fromUTC?: IsoUtc | null;
  toUTC?: IsoUtc | null;
  sort?: 'recent' | 'oldest' | 'priority' | 'status';
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ChildInput =
  | { kind: 'vehicle'; vehicleId: string; kmStart: number | null; kmEnd: number | null }
  | { kind: 'personnel'; personId: string; functionInIncident: string }
  | { kind: 'victim'; data: Omit<IncidentVictim, 'id' | 'incidentId' | 'isDeleted'> }
  | { kind: 'witness'; name: string; statement: string; takenAtUTC: IsoUtc }
  | { kind: 'otherResource'; data: Omit<IncidentOtherResource, 'id' | 'incidentId' | 'isDeleted'> }
  | { kind: 'attachment'; fileName: string; caption: string; mimeType: string; dataUrl: string; isSynthetic: boolean }
  | { kind: 'notification'; targetId: string; atUTC: IsoUtc; note: string };

export type ChildKind = ChildInput['kind'];

export interface TransitionOptions {
  expectedVersion: number;
  reason?: string;
  /** Horário do(s) marco(s) associado(s) à transição; padrão = agora. */
  atUTC?: IsoUtc;
  closingSummary?: string;
  vehicleId?: string | null;
}

/** Linha "achatada" para integração (contrato Power BI). */
export type IntegrationRow = Record<string, string | number | boolean | null>;

export interface IntegrationExport {
  generatedAtUTC: IsoUtc;
  schemaVersion: string;
  tables: { name: string; kind: 'fato' | 'dimensao' | 'ponte' | 'auditoria'; rows: IntegrationRow[] }[];
}

export interface SireRepository {
  readonly kind: 'mock' | 'dataverse';
  getCatalog(): Promise<Catalog>;
  listIncidents(query: IncidentQuery): Promise<Page<Incident>>;
  getIncident(id: string): Promise<IncidentAggregate>;
  getOperationalDataset(): Promise<OperationalDataset>;

  createIncident(actor: Actor, input: IncidentInput, opts: { mode: SaveMode; idempotencyKey: string }): Promise<Incident>;
  updateIncident(actor: Actor, id: string, patch: IncidentPatch, opts: { expectedVersion: number; reason?: string }): Promise<Incident>;
  transitionIncident(actor: Actor, id: string, to: IncidentStatus, opts: TransitionOptions): Promise<Incident>;

  recordMilestone(actor: Actor, incidentId: string, m: { type: MilestoneType; atUTC: IsoUtc; vehicleId: string | null }): Promise<IncidentMilestone>;
  removeMilestone(actor: Actor, incidentId: string, milestoneId: string, reason: string): Promise<void>;
  addChild(actor: Actor, incidentId: string, child: ChildInput): Promise<void>;
  removeChild(actor: Actor, incidentId: string, kind: ChildKind, childId: string, reason: string): Promise<void>;
  addNote(actor: Actor, incidentId: string, text: string): Promise<void>;

  listAudit(entityId?: string): Promise<AuditLogEntry[]>;
  exportIntegration(actor: Actor): Promise<IntegrationExport>;
  resetDemo(actor: Actor): Promise<void>;

  /** Notifica alterações (inclusive de outras abas) para a UI recarregar. */
  subscribe(listener: () => void): () => void;
}
