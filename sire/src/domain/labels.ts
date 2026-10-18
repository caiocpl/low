import type { IncidentOtherResource, VictimBond, VictimCondition, VictimDestination } from './types';

export const VICTIM_CONDITION_LABEL: Record<VictimCondition, string> = {
  CONSCIENTE: 'Consciente e orientada',
  FERIMENTO_LEVE: 'Ferimento leve',
  FERIMENTO_GRAVE: 'Ferimento grave',
  INCONSCIENTE: 'Inconsciente',
  NAO_AVALIADA: 'Não avaliada',
};

export const VICTIM_DESTINATION_LABEL: Record<VictimDestination, string> = {
  ATENDIDA_NO_LOCAL: 'Atendida no local',
  AMBULATORIO: 'Removida ao ambulatório',
  HOSPITAL: 'Removida ao hospital',
  RECUSOU_ATENDIMENTO: 'Recusou atendimento',
};

export const VICTIM_BOND_LABEL: Record<VictimBond, string> = {
  PROPRIO: 'Empregado próprio',
  CONTRATADO: 'Contratado',
  TERCEIRO: 'Terceiro / visitante',
};

export const OTHER_RESOURCE_LABEL: Record<IncidentOtherResource['category'], string> = {
  COMBATE: 'Combate a incêndio',
  RESGATE: 'Resgate e salvamento',
  EPI: 'Proteção individual (EPI)',
  SUPORTE: 'Suporte / apoio externo',
  OUTRO: 'Outro',
};
