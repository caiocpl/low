import type { IncidentStatus, Role } from './types';

export type Permission =
  | 'incident.view'
  | 'incident.create'
  | 'incident.edit'
  | 'incident.advance'
  | 'incident.close'
  | 'incident.correctClosed'
  | 'incident.addResources'
  | 'incident.report'
  | 'contacts.view'
  | 'integration.export'
  | 'audit.view'
  | 'admin.config'
  | 'admin.reset';

const MATRIX: Record<Role, Permission[]> = {
  OPERADOR: [
    'incident.view',
    'incident.create',
    'incident.edit',
    'incident.advance',
    'incident.addResources',
    'incident.report',
    'contacts.view',
  ],
  COORDENADOR: [
    'incident.view',
    'incident.create',
    'incident.edit',
    'incident.advance',
    'incident.close',
    'incident.correctClosed',
    'incident.addResources',
    'incident.report',
    'contacts.view',
    'integration.export',
    'audit.view',
  ],
  INSPETOR: ['incident.view', 'incident.report'],
  ADMIN: [
    'incident.view',
    'incident.create',
    'incident.edit',
    'incident.advance',
    'incident.close',
    'incident.correctClosed',
    'incident.addResources',
    'incident.report',
    'contacts.view',
    'integration.export',
    'audit.view',
    'admin.config',
    'admin.reset',
  ],
  VISUALIZADOR: ['incident.view', 'incident.report'],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export const ROLE_LABEL: Record<Role, string> = {
  OPERADOR: 'Operador da Central',
  COORDENADOR: 'Coordenador',
  INSPETOR: 'Inspetor',
  ADMIN: 'Administrador',
  VISUALIZADOR: 'Visualizador',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  OPERADOR: 'Registra chamados, conduz a ocorrência até "Controlada" e cancela apenas nas fases iniciais.',
  COORDENADOR: 'Tudo do operador + encerramento, cancelamento em qualquer fase e correções auditadas.',
  INSPETOR: 'Foco na prontidão SPE/SHP; consulta ocorrências em modo leitura.',
  ADMIN: 'Parametrização, reinício da demonstração e todas as permissões.',
  VISUALIZADOR: 'Somente leitura e emissão de relatório.',
};

export const ALL_ROLES: Role[] = ['OPERADOR', 'COORDENADOR', 'INSPETOR', 'ADMIN', 'VISUALIZADOR'];

/** Edição comum de campos: bloqueada em status finais (exceto correção auditada). */
export function canEditIncident(role: Role, status: IncidentStatus): boolean {
  if (status === 'ENCERRADA' || status === 'CANCELADA') return can(role, 'incident.correctClosed') && status === 'ENCERRADA';
  return can(role, 'incident.edit');
}
