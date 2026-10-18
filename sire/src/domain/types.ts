/**
 * Contratos de dados do SIRE.
 *
 * Convenções (espelham o modelo Dataverse descrito em docs/DICIONARIO_DADOS.md):
 * - `id`: UUID imutável (PK).
 * - Datas sempre em ISO-8601 UTC (`...Z`); a apresentação converte para America/Sao_Paulo.
 * - Toda linha transacional carrega metadados de auditoria (`AuditFields`).
 * - Exclusão é lógica (`isDeleted`), nunca física.
 * - Nenhuma coluna de fato guarda arrays/JSON: relações 1:N vivem em tabelas filhas.
 */

export type UUID = string;
export type IsoUtc = string;

export type RecordSource = 'SIRE_APP' | 'SEED_DEMO' | 'IMPORT';

export interface AuditFields {
  createdAtUTC: IsoUtc;
  updatedAtUTC: IsoUtc;
  createdBy: string;
  updatedBy: string;
  source: RecordSource;
  isDemo: true;
  rowVersion: number;
  isDeleted: boolean;
}

// ---------------------------------------------------------------- Perfis

export type Role = 'OPERADOR' | 'COORDENADOR' | 'INSPETOR' | 'ADMIN' | 'VISUALIZADOR';

export interface Actor {
  userId: string;
  name: string;
  role: Role;
}

// ---------------------------------------------------------------- Catálogo / dimensões

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export interface PriorityDef {
  code: Priority;
  label: string;
  description: string;
}

export interface SuggestedResource {
  kind: 'VIATURA' | 'EQUIPE';
  label: string;
  quantity: number;
}

/** Campos que podem ser exigidos por categoria antes do encerramento. */
export type RequirableField =
  | 'extinguishingAgent'
  | 'affectedAreaM2'
  | 'chemicalProduct'
  | 'victims'
  | 'witness'
  | 'attachments';

export interface IncidentCategory {
  id: string;
  code: string;
  name: string;
  /** Rótulo exibido em "O que aconteceu?" */
  prompt: string;
  defaultPriority: Priority;
  defaultPhase: Phase;
  suggestedResources: SuggestedResource[];
  /** Órgãos/funções sugeridos para acionamento (ids de NotificationTarget). */
  suggestedTargets: string[];
  /** Orientações configuráveis — exemplos, NÃO procedimentos validados. */
  guidance: string[];
  requiredForClosure: RequirableField[];
  active: boolean;
}

export interface Area {
  id: string;
  code: string;
  name: string;
  preferredBaseId: string | null;
  businessUnit: string | null;
}

/** Coordenadas em um plano esquemático fictício (0–1000), nunca geográficas reais. */
export interface SchematicPoint {
  x: number;
  y: number;
}

export interface Location {
  id: string;
  areaId: string;
  name: string;
  point: SchematicPoint | null;
}

export interface Base {
  id: string;
  code: string;
  name: string;
  point: SchematicPoint | null;
  isAdvancedPost: boolean;
}

export interface Team {
  id: string;
  code: string;
  name: string;
}

export type VehicleType = 'ABT' | 'ACR' | 'UR' | 'USB' | 'APOIO';

export interface Vehicle {
  id: string;
  code: string;
  type: VehicleType;
  description: string;
  plate: string;
  baseId: string;
  waterTankL: number | null;
  foamTankL: number | null;
  active: boolean;
}

export interface Person {
  id: string;
  name: string;
  jobTitle: string;
  teamId: string;
  baseId: string;
  active: boolean;
}

export interface NotificationTarget {
  id: string;
  code: string;
  name: string;
  description: string;
  order: number;
}

export interface ContactEntry {
  id: string;
  group: string;
  role: string;
  occupancy: 'Titular' | 'Suplente';
  name: string;
  phone: string;
  extension: string | null;
}

export interface DurationDefinition {
  id: string;
  label: string;
  from: MilestoneType;
  to: MilestoneType;
  description: string;
  /** Meta de referência em minutos (exemplo configurável). */
  targetMinutes: number | null;
}

export interface Catalog {
  priorities: PriorityDef[];
  categories: IncidentCategory[];
  areas: Area[];
  locations: Location[];
  bases: Base[];
  teams: Team[];
  vehicles: Vehicle[];
  people: Person[];
  notificationTargets: NotificationTarget[];
  contacts: ContactEntry[];
  durations: DurationDefinition[];
  channels: { code: Channel; label: string }[];
}

// ---------------------------------------------------------------- Ocorrência

export type IncidentStatus =
  | 'RASCUNHO'
  | 'REGISTRADA'
  | 'EM_TRIAGEM'
  | 'ACIONADA'
  | 'EM_DESLOCAMENTO'
  | 'EM_ATENDIMENTO'
  | 'CONTROLADA'
  | 'ENCERRADA'
  | 'CANCELADA';

export type Channel = 'RADIO' | 'RAMAL_EMERGENCIA' | 'TELEFONE' | 'PRESENCIAL' | 'SISTEMA';
export type Phase = 'REATIVA' | 'PROATIVA';

export interface Incident extends AuditFields {
  id: UUID;
  protocol: string;
  idempotencyKey: string;
  status: IncidentStatus;
  callReceivedAtUTC: IsoUtc;
  operatorName: string;
  channel: Channel;
  categoryId: string;
  priority: Priority;
  phase: Phase;
  title: string;
  description: string;
  callerName: string;
  callerPhone: string;
  hasVictims: boolean;
  victimCount: number | null;
  victimConditionSummary: string;
  areaId: string | null;
  locationId: string | null;
  reference: string;
  suggestedBaseId: string | null;
  responsibleBaseId: string | null;
  teamId: string | null;
  classification: string;
  unfolding: string;
  extinguishingAgent: string;
  extinguishingQty: string;
  affectedAreaM2: number | null;
  chemicalProduct: string;
  paeItem: string;
  attended: boolean | null;
  closingSummary: string;
  cancelReason: string;
  closedAtUTC: IsoUtc | null;
}

export type IncidentInput = Pick<
  Incident,
  | 'callReceivedAtUTC'
  | 'channel'
  | 'categoryId'
  | 'priority'
  | 'phase'
  | 'title'
  | 'description'
  | 'callerName'
  | 'callerPhone'
  | 'hasVictims'
  | 'victimCount'
  | 'victimConditionSummary'
  | 'areaId'
  | 'locationId'
  | 'reference'
  | 'suggestedBaseId'
  | 'responsibleBaseId'
  | 'teamId'
>;

export type IncidentEditableField =
  | keyof IncidentInput
  | 'classification'
  | 'unfolding'
  | 'extinguishingAgent'
  | 'extinguishingQty'
  | 'affectedAreaM2'
  | 'chemicalProduct'
  | 'paeItem'
  | 'attended'
  | 'closingSummary';

export type IncidentPatch = Partial<Pick<Incident, IncidentEditableField>>;

export interface IncidentStatusHistory {
  id: UUID;
  incidentId: UUID;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  atUTC: IsoUtc;
  actorName: string;
  actorRole: Role;
  reason: string;
}

export type MilestoneType =
  | 'CHAMADO'
  | 'ACIONAMENTO'
  | 'SAIDA_BASE'
  | 'CHEGADA_LOCAL'
  | 'INICIO_ATENDIMENTO'
  | 'CONTROLE'
  | 'TERMINO_ATENDIMENTO'
  | 'SAIDA_LOCAL'
  | 'CHEGADA_BASE';

export interface IncidentMilestone {
  id: UUID;
  incidentId: UUID;
  type: MilestoneType;
  atUTC: IsoUtc;
  vehicleId: string | null;
  actorName: string;
  recordedAtUTC: IsoUtc;
  isDeleted: boolean;
}

export type IncidentEventType = 'NOTA' | 'SISTEMA' | 'CORRECAO' | 'ANEXO' | 'RECURSO' | 'ACIONAMENTO';

export interface IncidentEvent {
  id: UUID;
  incidentId: UUID;
  type: IncidentEventType;
  atUTC: IsoUtc;
  actorName: string;
  text: string;
}

export interface IncidentVehicle {
  id: UUID;
  incidentId: UUID;
  vehicleId: string;
  kmStart: number | null;
  kmEnd: number | null;
  isDeleted: boolean;
}

export interface IncidentPersonnel {
  id: UUID;
  incidentId: UUID;
  personId: string;
  functionInIncident: string;
  isDeleted: boolean;
}

export type VictimCondition = 'CONSCIENTE' | 'FERIMENTO_LEVE' | 'FERIMENTO_GRAVE' | 'INCONSCIENTE' | 'NAO_AVALIADA';
export type VictimDestination = 'ATENDIDA_NO_LOCAL' | 'AMBULATORIO' | 'HOSPITAL' | 'RECUSOU_ATENDIMENTO';
export type VictimBond = 'PROPRIO' | 'CONTRATADO' | 'TERCEIRO';

export interface IncidentVictim {
  id: UUID;
  incidentId: UUID;
  /** Pseudônimo (minimização de dados) — nunca nome real na demo. */
  pseudonym: string;
  condition: VictimCondition;
  destination: VictimDestination;
  bond: VictimBond;
  notes: string;
  isDeleted: boolean;
}

export interface IncidentWitness {
  id: UUID;
  incidentId: UUID;
  name: string;
  statement: string;
  takenAtUTC: IsoUtc;
  isDeleted: boolean;
}

export interface IncidentOtherResource {
  id: UUID;
  incidentId: UUID;
  category: 'COMBATE' | 'RESGATE' | 'EPI' | 'SUPORTE' | 'OUTRO';
  description: string;
  quantity: number;
  isDeleted: boolean;
}

export interface IncidentAttachment {
  id: UUID;
  incidentId: UUID;
  fileName: string;
  caption: string;
  mimeType: string;
  /** data: URL (demo). Em produção: coluna de arquivo/imagem Dataverse. */
  dataUrl: string;
  isSynthetic: boolean;
  sizeBytes: number;
  addedAtUTC: IsoUtc;
  actorName: string;
  isDeleted: boolean;
}

export interface IncidentNotification {
  id: UUID;
  incidentId: UUID;
  targetId: string;
  atUTC: IsoUtc;
  actorName: string;
  note: string;
  isDeleted: boolean;
}

export interface IncidentAggregate {
  incident: Incident;
  statusHistory: IncidentStatusHistory[];
  milestones: IncidentMilestone[];
  events: IncidentEvent[];
  vehicles: IncidentVehicle[];
  personnel: IncidentPersonnel[];
  victims: IncidentVictim[];
  witnesses: IncidentWitness[];
  otherResources: IncidentOtherResource[];
  attachments: IncidentAttachment[];
  notifications: IncidentNotification[];
}

// ---------------------------------------------------------------- Auditoria

export interface AuditLogEntry {
  id: UUID;
  operationId: UUID;
  entity: string;
  entityId: UUID;
  action: 'CREATE' | 'UPDATE' | 'TRANSITION' | 'ADD_CHILD' | 'REMOVE_CHILD' | 'RESET' | 'CORRECTION';
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  actorName: string;
  actorRole: Role;
  atUTC: IsoUtc;
}
