import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDuration, fromLocalInputValue, startOfLocalDay, toLocalInputValue } from './time';
import { canTransition, cancelAllowedFor, nextStatus, STATUS_ORDER } from './status';
import { can, canEditIncident, ALL_ROLES } from './permissions';
import { checkNewMilestone, computeDurations, effectiveMilestones, median, validateChronology } from './milestones';
import { validateIncidentInput } from './validation';
import { formatProtocol, PROTOCOL_RE, seededRandom } from './ids';
import { DEMO_CATALOG } from '../data/seed/catalog';
import type { IncidentInput, IncidentMilestone } from './types';

const NOW = new Date('2026-10-18T15:00:00.000Z'); // 12:00 em São Paulo

describe('time (America/Sao_Paulo)', () => {
  it('formata UTC no fuso de São Paulo', () => {
    expect(formatDateTime('2026-10-18T15:00:00.000Z')).toBe('18/10/2026 12:00');
  });
  it('converte ida e volta do input datetime-local sem perda', () => {
    const iso = fromLocalInputValue('2026-10-18T12:30');
    expect(iso).toBe('2026-10-18T15:30:00.000Z');
    expect(toLocalInputValue(iso)).toBe('2026-10-18T12:30');
  });
  it('rejeita datas inexistentes em vez de normalizar silenciosamente', () => {
    expect(fromLocalInputValue('2026-02-31T10:00')).toBeNull();
    expect(fromLocalInputValue('lixo')).toBeNull();
  });
  it('calcula o início do dia local', () => {
    expect(startOfLocalDay(NOW)).toBe('2026-10-18T03:00:00.000Z');
  });
  it('formata durações e sinaliza ausência/inconsistência', () => {
    expect(formatDuration(7)).toBe('7 min');
    expect(formatDuration(65)).toBe('1 h 05 min');
    expect(formatDuration(null)).toBe('Sem dados');
    expect(formatDuration(-3)).toBe('Inconsistente');
  });
});

describe('máquina de estados', () => {
  it('só permite avanço linear', () => {
    for (let i = 0; i < STATUS_ORDER.length - 1; i++) {
      const from = STATUS_ORDER[i]!;
      expect(nextStatus(from)).toBe(STATUS_ORDER[i + 1]);
      expect(canTransition(from, STATUS_ORDER[i + 1]!)).toBe(true);
    }
    expect(canTransition('REGISTRADA', 'EM_ATENDIMENTO')).toBe(false);
    expect(canTransition('ENCERRADA', 'EM_ATENDIMENTO')).toBe(false);
  });
  it('cancelamento depende do perfil e do status', () => {
    expect(cancelAllowedFor('OPERADOR', 'REGISTRADA')).toBe(true);
    expect(cancelAllowedFor('OPERADOR', 'EM_ATENDIMENTO')).toBe(false);
    expect(cancelAllowedFor('COORDENADOR', 'EM_ATENDIMENTO')).toBe(true);
    expect(cancelAllowedFor('VISUALIZADOR', 'REGISTRADA')).toBe(false);
    expect(cancelAllowedFor('ADMIN', 'ENCERRADA')).toBe(false);
  });
});

describe('permissões', () => {
  it('visualizador e inspetor não criam nem editam ocorrências', () => {
    expect(can('VISUALIZADOR', 'incident.create')).toBe(false);
    expect(can('INSPETOR', 'incident.edit')).toBe(false);
    expect(canEditIncident('VISUALIZADOR', 'REGISTRADA')).toBe(false);
  });
  it('apenas coordenador e administrador encerram e corrigem encerradas', () => {
    expect(ALL_ROLES.filter((r) => can(r, 'incident.close'))).toEqual(['COORDENADOR', 'ADMIN']);
    expect(canEditIncident('OPERADOR', 'ENCERRADA')).toBe(false);
    expect(canEditIncident('COORDENADOR', 'ENCERRADA')).toBe(true);
    expect(canEditIncident('ADMIN', 'CANCELADA')).toBe(false);
  });
  it('somente administrador reinicia a demonstração', () => {
    expect(ALL_ROLES.filter((r) => can(r, 'admin.reset'))).toEqual(['ADMIN']);
  });
});

const ms = (type: IncidentMilestone['type'], atUTC: string, isDeleted = false): IncidentMilestone => ({
  id: `${type}-${atUTC}`, incidentId: 'i', type, atUTC, vehicleId: null, actorName: 't', recordedAtUTC: atUTC, isDeleted,
});

describe('marcos e durações', () => {
  const list = [
    ms('CHAMADO', '2026-10-18T14:00:00Z'),
    ms('ACIONAMENTO', '2026-10-18T14:02:00Z'),
    ms('SAIDA_BASE', '2026-10-18T14:05:00Z'),
    ms('SAIDA_BASE', '2026-10-18T14:04:00Z'),
    ms('CHEGADA_LOCAL', '2026-10-18T14:13:00Z'),
    ms('CHEGADA_LOCAL', '2026-10-18T14:01:00Z', true),
  ];
  it('usa o marco mais antigo não excluído', () => {
    const eff = effectiveMilestones(list);
    expect(eff.SAIDA_BASE).toBe('2026-10-18T14:04:00Z');
    expect(eff.CHEGADA_LOCAL).toBe('2026-10-18T14:13:00Z');
  });
  it('calcula durações parametrizadas e marca ausência como Sem dados', () => {
    const res = computeDurations(DEMO_CATALOG.durations, effectiveMilestones(list));
    const byId = Object.fromEntries(res.map((r) => [r.definition.id, r]));
    expect(byId['dur-mobilizacao']?.minutes).toBe(2);
    expect(byId['dur-resposta']?.minutes).toBe(13);
    expect(byId['dur-resposta']?.status).toBe('ACIMA_META');
    expect(byId['dur-atendimento']?.status).toBe('SEM_DADOS');
  });
  it('detecta datas fora de sequência e no futuro', () => {
    const issues = validateChronology({ CHAMADO: '2026-10-18T14:00:00Z', SAIDA_BASE: '2026-10-18T13:50:00Z' }, NOW);
    expect(issues).toHaveLength(1);
    expect(checkNewMilestone(list, 'CONTROLE', '2026-10-18T18:00:00Z', NOW)[0]?.message).toMatch(/futuro/);
  });
  it('mediana correta para pares e ímpares', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

const baseInput = (over: Partial<IncidentInput> = {}): IncidentInput => ({
  callReceivedAtUTC: '2026-10-18T14:55:00.000Z', channel: 'RAMAL_EMERGENCIA', categoryId: 'cat-incendio', priority: 'P1', phase: 'REATIVA',
  title: '', description: 'Fumaça saindo do painel elétrico', callerName: 'Supervisor', callerPhone: '', hasVictims: false, victimCount: null,
  victimConditionSummary: '', areaId: 'ar-norte', locationId: 'lc-n1', reference: '', suggestedBaseId: 'base-norte', responsibleBaseId: null, teamId: null,
  ...over,
});

describe('validação do pré-atendimento', () => {
  it('aceita registro válido com telefone opcional ausente', () => {
    expect(validateIncidentInput(baseInput(), 'register', DEMO_CATALOG, NOW)).toEqual([]);
  });
  it('exige campos obrigatórios no registro', () => {
    const errs = validateIncidentInput(baseInput({ categoryId: '', description: '', areaId: null, locationId: null, callerName: '' }), 'register', DEMO_CATALOG, NOW);
    expect(errs.map((e) => e.field).sort()).toEqual(['areaId', 'callerName', 'categoryId', 'description', 'locationId']);
  });
  it('vítima marcada exige quantidade e estado', () => {
    const errs = validateIncidentInput(baseInput({ hasVictims: true, victimCount: null }), 'register', DEMO_CATALOG, NOW);
    expect(errs.map((e) => e.field)).toEqual(['victimCount', 'victimConditionSummary']);
  });
  it('rejeita local fora da macroárea, telefone inválido e chamado no futuro', () => {
    const errs = validateIncidentInput(
      baseInput({ locationId: 'lc-s1', callerPhone: '123', callReceivedAtUTC: '2026-10-18T16:00:00.000Z' }),
      'register', DEMO_CATALOG, NOW,
    );
    expect(errs.map((e) => e.field).sort()).toEqual(['callReceivedAtUTC', 'callerPhone', 'locationId']);
  });
  it('rascunho aceita o mínimo, mas não vazio total', () => {
    expect(validateIncidentInput(baseInput({ description: '', areaId: null, locationId: null, callerName: '' }), 'draft', DEMO_CATALOG, NOW)).toEqual([]);
    expect(validateIncidentInput(baseInput({ categoryId: '', description: '', areaId: null, locationId: null }), 'draft', DEMO_CATALOG, NOW)).toHaveLength(1);
  });
});

describe('identificadores', () => {
  it('protocolo legível e sequencial', () => {
    expect(formatProtocol(2026, 42)).toBe('PAE-2026-000042');
    expect(PROTOCOL_RE.test('PAE-2026-000042')).toBe(true);
  });
  it('PRNG determinístico', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
