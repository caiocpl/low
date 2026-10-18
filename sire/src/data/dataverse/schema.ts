/**
 * Mapeamento proposto entidade de domínio → tabela Dataverse (prefixo de editor `sire_`).
 * Fonte única usada pela documentação (docs/DICIONARIO_DADOS.md) e pelo futuro adaptador.
 */
export const DATAVERSE_TABLES = {
  Incident: 'sire_incident',
  IncidentStatusHistory: 'sire_incidentstatushistory',
  IncidentMilestone: 'sire_incidentmilestone',
  IncidentEvent: 'sire_incidentevent',
  IncidentVehicle: 'sire_incidentvehicle',
  IncidentPersonnel: 'sire_incidentpersonnel',
  IncidentVictim: 'sire_incidentvictim',
  IncidentWitness: 'sire_incidentwitness',
  IncidentOtherResource: 'sire_incidentotherresource',
  IncidentAttachment: 'sire_incidentattachment',
  IncidentNotification: 'sire_incidentnotification',
  IncidentCategory: 'sire_incidentcategory',
  Area: 'sire_area',
  Location: 'sire_location',
  Base: 'sire_base',
  Team: 'sire_team',
  Vehicle: 'sire_vehicle',
  Person: 'sire_person',
  NotificationTarget: 'sire_notificationtarget',
  ContactEntry: 'sire_contactdirectory',
  DurationDefinition: 'sire_durationdefinition',
  AuditLogEntry: 'sire_auditlog',
} as const;

/** Escolhas (option sets) globais propostas — valores numéricos estáveis para o BI. */
export const DATAVERSE_CHOICES = {
  sire_incidentstatus: { RASCUNHO: 100000000, REGISTRADA: 100000001, EM_TRIAGEM: 100000002, ACIONADA: 100000003, EM_DESLOCAMENTO: 100000004, EM_ATENDIMENTO: 100000005, CONTROLADA: 100000006, ENCERRADA: 100000007, CANCELADA: 100000008 },
  sire_priority: { P1: 100000000, P2: 100000001, P3: 100000002, P4: 100000003 },
  sire_phase: { REATIVA: 100000000, PROATIVA: 100000001 },
  sire_channel: { RADIO: 100000000, RAMAL_EMERGENCIA: 100000001, TELEFONE: 100000002, PRESENCIAL: 100000003, SISTEMA: 100000004 },
  sire_milestonetype: { CHAMADO: 100000000, ACIONAMENTO: 100000001, SAIDA_BASE: 100000002, CHEGADA_LOCAL: 100000003, INICIO_ATENDIMENTO: 100000004, CONTROLE: 100000005, TERMINO_ATENDIMENTO: 100000006, SAIDA_LOCAL: 100000007, CHEGADA_BASE: 100000008 },
} as const;
