import type { IncidentStatus, MilestoneType, Role } from './types';

export const STATUS_ORDER: IncidentStatus[] = [
  'RASCUNHO',
  'REGISTRADA',
  'EM_TRIAGEM',
  'ACIONADA',
  'EM_DESLOCAMENTO',
  'EM_ATENDIMENTO',
  'CONTROLADA',
  'ENCERRADA',
];

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  RASCUNHO: 'Rascunho',
  REGISTRADA: 'Registrada',
  EM_TRIAGEM: 'Em triagem',
  ACIONADA: 'Acionada',
  EM_DESLOCAMENTO: 'Em deslocamento',
  EM_ATENDIMENTO: 'Em atendimento',
  CONTROLADA: 'Controlada',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

export type StatusTone = 'neutral' | 'info' | 'warning' | 'critical' | 'success' | 'muted';

export const STATUS_TONE: Record<IncidentStatus, StatusTone> = {
  RASCUNHO: 'muted',
  REGISTRADA: 'info',
  EM_TRIAGEM: 'info',
  ACIONADA: 'warning',
  EM_DESLOCAMENTO: 'warning',
  EM_ATENDIMENTO: 'critical',
  CONTROLADA: 'success',
  ENCERRADA: 'neutral',
  CANCELADA: 'muted',
};

export const FINAL_STATUSES: IncidentStatus[] = ['ENCERRADA', 'CANCELADA'];
export const isFinal = (s: IncidentStatus) => FINAL_STATUSES.includes(s);
/** "Ativa" = registrada e ainda não finalizada (rascunho não conta como ocorrência). */
export const isActive = (s: IncidentStatus) => s !== 'RASCUNHO' && !isFinal(s);

/**
 * Transições permitidas (avanço linear). Cancelamento é tratado à parte
 * porque exige justificativa e depende do perfil.
 */
const NEXT: Partial<Record<IncidentStatus, IncidentStatus>> = {
  RASCUNHO: 'REGISTRADA',
  REGISTRADA: 'EM_TRIAGEM',
  EM_TRIAGEM: 'ACIONADA',
  ACIONADA: 'EM_DESLOCAMENTO',
  EM_DESLOCAMENTO: 'EM_ATENDIMENTO',
  EM_ATENDIMENTO: 'CONTROLADA',
  CONTROLADA: 'ENCERRADA',
};

export function nextStatus(s: IncidentStatus): IncidentStatus | null {
  return NEXT[s] ?? null;
}

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (to === 'CANCELADA') return !isFinal(from);
  return NEXT[from] === to;
}

/** Marco(s) temporal(is) registrados automaticamente ao entrar em cada status. */
export const STATUS_MILESTONES: Partial<Record<IncidentStatus, MilestoneType[]>> = {
  ACIONADA: ['ACIONAMENTO'],
  EM_DESLOCAMENTO: ['SAIDA_BASE'],
  EM_ATENDIMENTO: ['CHEGADA_LOCAL', 'INICIO_ATENDIMENTO'],
  CONTROLADA: ['CONTROLE'],
  ENCERRADA: ['TERMINO_ATENDIMENTO'],
};

/** Rótulo do botão de ação principal para avançar a partir de cada status. */
export const ADVANCE_ACTION_LABEL: Partial<Record<IncidentStatus, string>> = {
  RASCUNHO: 'Registrar ocorrência',
  REGISTRADA: 'Iniciar triagem',
  EM_TRIAGEM: 'Confirmar acionamento',
  ACIONADA: 'Registrar saída da base',
  EM_DESLOCAMENTO: 'Registrar chegada e início do atendimento',
  EM_ATENDIMENTO: 'Declarar situação controlada',
  CONTROLADA: 'Encerrar ocorrência',
};

export function cancelAllowedFor(role: Role, from: IncidentStatus): boolean {
  if (isFinal(from)) return false;
  if (role === 'COORDENADOR' || role === 'ADMIN') return true;
  if (role === 'OPERADOR') return ['RASCUNHO', 'REGISTRADA', 'EM_TRIAGEM'].includes(from);
  return false;
}

export const MIN_REASON_LENGTH = 10;
