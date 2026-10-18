import type { Catalog, IncidentAggregate, IncidentInput, IncidentPatch, RequirableField } from './types';
import { effectiveMilestones, validateChronology, MILESTONE_LABEL } from './milestones';
import { FUTURE_TOLERANCE_MIN } from './milestones';
import { isValidIso } from './time';

export interface FieldError {
  field: string;
  message: string;
}

export type SaveMode = 'draft' | 'register';

const PHONE_RE = /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/;

export function normalizePhone(v: string): string {
  return v.replace(/[^\d()\s-]/g, '').trim();
}

/** Validação do pré-atendimento (A2). Rascunho exige o mínimo; registro exige o protocolo completo. */
export function validateIncidentInput(input: IncidentInput, mode: SaveMode, catalog: Catalog, now: Date): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });

  if (mode === 'draft') {
    if (!input.categoryId && !input.description.trim() && !input.locationId) {
      add('categoryId', 'Para salvar um rascunho, informe ao menos o que aconteceu, a descrição ou o local.');
    }
  } else {
    if (!input.categoryId) add('categoryId', 'Informe o que aconteceu (hipótese acidental).');
    if (!input.priority) add('priority', 'Informe a prioridade.');
    if (!input.channel) add('channel', 'Informe o canal de entrada.');
    if (input.description.trim().length < 10) add('description', 'Descreva o incidente com pelo menos 10 caracteres.');
    if (!input.areaId) add('areaId', 'Informe a macroárea.');
    if (!input.locationId) add('locationId', 'Informe o local da ocorrência.');
    if (!input.callerName.trim()) add('callerName', 'Informe o nome do solicitante (ou "Não identificado").');
  }

  // Regras válidas em qualquer modo (evitam gravar dado incoerente mesmo em rascunho).
  if (input.categoryId && !catalog.categories.some((c) => c.id === input.categoryId)) {
    add('categoryId', 'Categoria inexistente no cadastro.');
  }
  if (input.areaId && !catalog.areas.some((a) => a.id === input.areaId)) add('areaId', 'Macroárea inexistente.');
  if (input.locationId) {
    const loc = catalog.locations.find((l) => l.id === input.locationId);
    if (!loc) add('locationId', 'Local inexistente.');
    else if (input.areaId && loc.areaId !== input.areaId) add('locationId', 'O local não pertence à macroárea selecionada.');
  }
  if (input.callerPhone.trim() && !PHONE_RE.test(input.callerPhone.trim())) {
    add('callerPhone', 'Telefone inválido. Use o formato (00) 90000-0000 — campo opcional.');
  }
  if (!isValidIso(input.callReceivedAtUTC)) {
    add('callReceivedAtUTC', 'Data/hora do chamado inválida.');
  } else if (Date.parse(input.callReceivedAtUTC) > now.getTime() + FUTURE_TOLERANCE_MIN * 60000) {
    add('callReceivedAtUTC', 'A data/hora do chamado não pode estar no futuro.');
  }
  if (input.hasVictims) {
    if (input.victimCount === null || !Number.isInteger(input.victimCount) || input.victimCount < 1) {
      add('victimCount', 'Informe quantas vítimas (número inteiro a partir de 1).');
    } else if (input.victimCount > 500) {
      add('victimCount', 'Quantidade de vítimas acima do limite aceito (500).');
    }
    if (mode === 'register' && !input.victimConditionSummary.trim()) {
      add('victimConditionSummary', 'Descreva resumidamente o estado da(s) vítima(s).');
    }
  } else if (input.victimCount !== null && input.victimCount !== 0) {
    add('victimCount', 'Quantidade informada, mas "Há vítimas?" está marcado como Não.');
  }
  return errors;
}

export function validatePatch(patch: IncidentPatch): FieldError[] {
  const errors: FieldError[] = [];
  if (patch.affectedAreaM2 !== undefined && patch.affectedAreaM2 !== null) {
    if (!Number.isFinite(patch.affectedAreaM2) || patch.affectedAreaM2 < 0) {
      errors.push({ field: 'affectedAreaM2', message: 'Área afetada deve ser um número maior ou igual a zero.' });
    }
  }
  if (patch.victimCount !== undefined && patch.victimCount !== null && (!Number.isInteger(patch.victimCount) || patch.victimCount < 0)) {
    errors.push({ field: 'victimCount', message: 'Quantidade de vítimas inválida.' });
  }
  if (patch.callerPhone !== undefined && patch.callerPhone.trim() && !PHONE_RE.test(patch.callerPhone.trim())) {
    errors.push({ field: 'callerPhone', message: 'Telefone inválido.' });
  }
  return errors;
}

// ---------------------------------------------------------------- Checklist de encerramento

export interface ClosureCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

const REQUIRABLE_LABEL: Record<RequirableField, string> = {
  extinguishingAgent: 'Agente extintor informado',
  affectedAreaM2: 'Área afetada (m²) informada',
  chemicalProduct: 'Produto químico identificado',
  victims: 'Vítimas detalhadas na aba Vítimas',
  witness: 'Ao menos um depoimento de testemunha',
  attachments: 'Ao menos um registro fotográfico',
};

/**
 * Checklist de completude exigido antes do encerramento (A5).
 * `closingSummary` pode ser passado separadamente quando ainda não foi salvo.
 */
export function closureChecklist(agg: IncidentAggregate, catalog: Catalog, now: Date, closingSummary?: string): ClosureCheck[] {
  const inc = agg.incident;
  const cat = catalog.categories.find((c) => c.id === inc.categoryId);
  const eff = effectiveMilestones(agg.milestones);
  const chronology = validateChronology(eff, now);
  const activeVictims = agg.victims.filter((v) => !v.isDeleted);
  const summary = (closingSummary ?? inc.closingSummary).trim();

  const checks: ClosureCheck[] = [
    { id: 'status', label: 'Ocorrência declarada controlada', ok: inc.status === 'CONTROLADA' },
    { id: 'location', label: 'Macroárea e local definidos', ok: Boolean(inc.areaId && inc.locationId) },
    { id: 'base', label: 'Base responsável e equipe definidas', ok: Boolean(inc.responsibleBaseId && inc.teamId) },
    { id: 'classification', label: 'Classificação preenchida', ok: inc.classification.trim().length > 0 },
    { id: 'attended', label: '"Ocorrência atendida?" respondido', ok: inc.attended !== null },
  ];

  const requiredMilestones = ['CHAMADO', 'ACIONAMENTO', 'SAIDA_BASE', 'CHEGADA_LOCAL', 'INICIO_ATENDIMENTO', 'CONTROLE'] as const;
  const missing = requiredMilestones.filter((m) => !eff[m]);
  checks.push({
    id: 'milestones',
    label: 'Marcos de tempo obrigatórios registrados',
    ok: missing.length === 0,
    detail: missing.length ? `Faltam: ${missing.map((m) => MILESTONE_LABEL[m]).join(', ')}` : undefined,
  });
  checks.push({
    id: 'chronology',
    label: 'Linha do tempo em ordem cronológica',
    ok: chronology.length === 0,
    detail: chronology.map((c) => c.message).join(' '),
  });
  checks.push({ id: 'vehicles', label: 'Ao menos uma viatura vinculada', ok: agg.vehicles.some((v) => !v.isDeleted) });
  checks.push({ id: 'personnel', label: 'Efetivo empenhado registrado', ok: agg.personnel.some((p) => !p.isDeleted) });

  if (inc.hasVictims) {
    checks.push({
      id: 'victimsCount',
      label: 'Vítimas detalhadas conferem com a quantidade informada',
      ok: activeVictims.length === (inc.victimCount ?? 0),
      detail: `${activeVictims.length} detalhada(s) de ${inc.victimCount ?? 0} informada(s)`,
    });
  }

  for (const field of cat?.requiredForClosure ?? []) {
    let ok = false;
    switch (field) {
      case 'extinguishingAgent':
        ok = inc.extinguishingAgent.trim().length > 0;
        break;
      case 'affectedAreaM2':
        ok = inc.affectedAreaM2 !== null;
        break;
      case 'chemicalProduct':
        ok = inc.chemicalProduct.trim().length > 0;
        break;
      case 'victims':
        ok = activeVictims.length > 0;
        break;
      case 'witness':
        ok = agg.witnesses.some((w) => !w.isDeleted);
        break;
      case 'attachments':
        ok = agg.attachments.some((a) => !a.isDeleted);
        break;
    }
    checks.push({ id: `cat-${field}`, label: `${REQUIRABLE_LABEL[field]} (exigido pela categoria)`, ok });
  }

  checks.push({
    id: 'summary',
    label: 'Resumo de encerramento com pelo menos 20 caracteres',
    ok: summary.length >= 20,
  });
  return checks;
}

export function isClosureReady(checks: ClosureCheck[]): boolean {
  return checks.every((c) => c.ok);
}
