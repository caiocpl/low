import type { DurationDefinition, IncidentMilestone, IsoUtc, MilestoneType } from './types';
import { diffMinutes, formatDateTime } from './time';

export const MILESTONE_ORDER: MilestoneType[] = [
  'CHAMADO',
  'ACIONAMENTO',
  'SAIDA_BASE',
  'CHEGADA_LOCAL',
  'INICIO_ATENDIMENTO',
  'CONTROLE',
  'TERMINO_ATENDIMENTO',
  'SAIDA_LOCAL',
  'CHEGADA_BASE',
];

export const MILESTONE_LABEL: Record<MilestoneType, string> = {
  CHAMADO: 'Chamado recebido',
  ACIONAMENTO: 'Acionamento da equipe',
  SAIDA_BASE: 'Saída da base',
  CHEGADA_LOCAL: 'Chegada no local',
  INICIO_ATENDIMENTO: 'Início do atendimento',
  CONTROLE: 'Situação controlada',
  TERMINO_ATENDIMENTO: 'Término do atendimento',
  SAIDA_LOCAL: 'Saída do local',
  CHEGADA_BASE: 'Chegada na base',
};

/** Tolerância para relógios dessincronizados ao validar "data no futuro". */
export const FUTURE_TOLERANCE_MIN = 2;

/** Marco efetivo por tipo = o mais antigo não excluído (ex.: primeira viatura a sair). */
export function effectiveMilestones(milestones: IncidentMilestone[]): Partial<Record<MilestoneType, IsoUtc>> {
  const out: Partial<Record<MilestoneType, IsoUtc>> = {};
  for (const m of milestones) {
    if (m.isDeleted) continue;
    const cur = out[m.type];
    if (!cur || Date.parse(m.atUTC) < Date.parse(cur)) out[m.type] = m.atUTC;
  }
  return out;
}

export interface ChronologyIssue {
  type: MilestoneType;
  message: string;
}

/**
 * Valida a sequência temporal dos marcos: cada marco informado deve ser
 * igual ou posterior ao marco anterior informado, e nenhum pode estar no futuro.
 */
export function validateChronology(
  eff: Partial<Record<MilestoneType, IsoUtc>>,
  now: Date,
): ChronologyIssue[] {
  const issues: ChronologyIssue[] = [];
  let prev: { type: MilestoneType; at: IsoUtc } | null = null;
  for (const type of MILESTONE_ORDER) {
    const at = eff[type];
    if (!at) continue;
    if (Date.parse(at) > now.getTime() + FUTURE_TOLERANCE_MIN * 60000) {
      issues.push({ type, message: `${MILESTONE_LABEL[type]} está no futuro (${formatDateTime(at)}).` });
    }
    if (prev && Date.parse(at) < Date.parse(prev.at)) {
      issues.push({
        type,
        message: `${MILESTONE_LABEL[type]} (${formatDateTime(at)}) é anterior a ${MILESTONE_LABEL[prev.type].toLowerCase()} (${formatDateTime(prev.at)}).`,
      });
    }
    prev = { type, at };
  }
  return issues;
}

/** Verifica se inserir um novo marco quebraria a cronologia. */
export function checkNewMilestone(
  existing: IncidentMilestone[],
  type: MilestoneType,
  atUTC: IsoUtc,
  now: Date,
): ChronologyIssue[] {
  const eff = effectiveMilestones(existing);
  const cur = eff[type];
  eff[type] = cur && Date.parse(cur) < Date.parse(atUTC) ? cur : atUTC;
  return validateChronology(eff, now).filter((i) => i.type === type || MILESTONE_ORDER.indexOf(i.type) > MILESTONE_ORDER.indexOf(type));
}

export interface ComputedDuration {
  definition: DurationDefinition;
  minutes: number | null;
  status: 'OK' | 'SEM_DADOS' | 'INCONSISTENTE' | 'ACIMA_META';
}

export function computeDurations(
  definitions: DurationDefinition[],
  eff: Partial<Record<MilestoneType, IsoUtc>>,
): ComputedDuration[] {
  return definitions.map((definition) => {
    const from = eff[definition.from];
    const to = eff[definition.to];
    if (!from || !to) return { definition, minutes: null, status: 'SEM_DADOS' };
    const minutes = diffMinutes(from, to);
    if (minutes < 0) return { definition, minutes, status: 'INCONSISTENTE' };
    if (definition.targetMinutes !== null && minutes > definition.targetMinutes) {
      return { definition, minutes, status: 'ACIMA_META' };
    }
    return { definition, minutes, status: 'OK' };
  });
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] as number) + (s[mid] as number)) / 2 : (s[mid] as number);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
