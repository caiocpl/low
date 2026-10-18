/**
 * Constrói o conjunto de tabelas "prontas para BI" a partir dos registros transacionais.
 * Espelha o contrato documentado em docs/CONTRATO_POWER_BI.md (versão `SCHEMA_VERSION`).
 *
 * Regras:
 *  - Chaves são os UUIDs imutáveis da origem (nunca o protocolo, que é apenas legível).
 *  - Datas em UTC (sufixo `_utc`) + data local de negócio (America/Sao_Paulo) para relacionar à dimensão Data.
 *  - Nulos permanecem nulos (nunca convertidos em zero) — o BI decide como exibir "Sem dados".
 *  - Durações derivadas são colunas de conveniência; a fonte da verdade é FatoMarcoTempo.
 *  - Linhas excluídas logicamente são exportadas com `excluido = true` para auditoria do BI.
 */
import type { IntegrationExport, IntegrationRow } from '../repository';
import type { DemoDb } from '../mock/db';
import { effectiveMilestones, computeDurations } from '../../domain/milestones';
import { toLocalInputValue } from '../../domain/time';
import { STATUS_LABEL, STATUS_ORDER } from '../../domain/status';
import { MILESTONE_LABEL, MILESTONE_ORDER } from '../../domain/milestones';

export const SCHEMA_VERSION = '1.0.0';

const localDate = (iso: string | null) => (iso ? toLocalInputValue(iso).slice(0, 10) : null);

export function buildIntegrationExport(db: DemoDb, now: Date): IntegrationExport {
  const c = db.catalog;
  const msBy = new Map<string, typeof db.milestones>();
  for (const m of db.milestones) msBy.set(m.incidentId, [...(msBy.get(m.incidentId) ?? []), m]);
  const count = <T extends { incidentId: string; isDeleted: boolean }>(rows: T[], id: string) => rows.filter((r) => r.incidentId === id && !r.isDeleted).length;

  const fatoOcorrencia: IntegrationRow[] = db.incidents.map((i) => {
    const eff = effectiveMilestones(msBy.get(i.id) ?? []);
    const durations = Object.fromEntries(computeDurations(c.durations, eff).map((d) => [`min_${d.definition.id.replace('dur-', '')}`, d.minutes === null ? null : Math.round(d.minutes * 10) / 10]));
    return {
      ocorrencia_id: i.id,
      protocolo: i.protocol,
      status_codigo: i.status,
      categoria_id: i.categoryId,
      prioridade_codigo: i.priority,
      fase_codigo: i.phase,
      canal_codigo: i.channel,
      area_id: i.areaId,
      local_id: i.locationId,
      base_sugerida_id: i.suggestedBaseId,
      base_responsavel_id: i.responsibleBaseId,
      equipe_id: i.teamId,
      chamado_utc: i.callReceivedAtUTC,
      data_chamado_local: localDate(i.callReceivedAtUTC),
      encerramento_utc: i.closedAtUTC,
      data_encerramento_local: localDate(i.closedAtUTC),
      ha_vitimas: i.hasVictims,
      qtd_vitimas_informada: i.victimCount,
      qtd_vitimas_detalhadas: count(db.victims, i.id),
      qtd_viaturas: count(db.vehicles, i.id),
      qtd_efetivo: count(db.personnel, i.id),
      qtd_anexos: count(db.attachments, i.id),
      area_afetada_m2: i.affectedAreaM2,
      ocorrencia_atendida: i.attended,
      ...durations,
      criado_utc: i.createdAtUTC,
      atualizado_utc: i.updatedAtUTC,
      origem: i.source,
      is_demo: i.isDemo,
      versao_linha: i.rowVersion,
      excluido: i.isDeleted,
    };
  });

  const tables: IntegrationExport['tables'] = [
    { name: 'FatoOcorrencia', kind: 'fato', rows: fatoOcorrencia },
    {
      name: 'FatoHistoricoStatus',
      kind: 'fato',
      rows: db.statusHistory.map((h) => ({
        historico_id: h.id, ocorrencia_id: h.incidentId, status_anterior: h.fromStatus, status_novo: h.toStatus,
        ocorrido_utc: h.atUTC, data_local: localDate(h.atUTC), perfil_autor: h.actorRole, justificativa: h.reason || null,
      })),
    },
    {
      name: 'FatoMarcoTempo',
      kind: 'fato',
      rows: db.milestones.map((m) => ({
        marco_id: m.id, ocorrencia_id: m.incidentId, marco_codigo: m.type, ocorrido_utc: m.atUTC, viatura_id: m.vehicleId,
        registrado_utc: m.recordedAtUTC, excluido: m.isDeleted,
      })),
    },
    {
      name: 'FatoAcionamento',
      kind: 'fato',
      rows: db.notifications.map((n) => ({ acionamento_id: n.id, ocorrencia_id: n.incidentId, orgao_id: n.targetId, ocorrido_utc: n.atUTC, excluido: n.isDeleted })),
    },
    {
      name: 'PonteOcorrenciaViatura',
      kind: 'ponte',
      rows: db.vehicles.map((v) => ({ vinculo_id: v.id, ocorrencia_id: v.incidentId, viatura_id: v.vehicleId, km_inicial: v.kmStart, km_final: v.kmEnd, excluido: v.isDeleted })),
    },
    {
      name: 'PonteOcorrenciaEfetivo',
      kind: 'ponte',
      rows: db.personnel.map((p) => ({ vinculo_id: p.id, ocorrencia_id: p.incidentId, pessoa_id: p.personId, funcao: p.functionInIncident, excluido: p.isDeleted })),
    },
    {
      name: 'FatoVitima',
      kind: 'fato',
      rows: db.victims.map((v) => ({ vitima_id: v.id, ocorrencia_id: v.incidentId, condicao_codigo: v.condition, destino_codigo: v.destination, vinculo_codigo: v.bond, excluido: v.isDeleted })),
    },
    { name: 'DimCategoria', kind: 'dimensao', rows: c.categories.map((x) => ({ categoria_id: x.id, codigo: x.code, nome: x.name, prioridade_padrao: x.defaultPriority, fase_padrao: x.defaultPhase, ativo: x.active })) },
    { name: 'DimArea', kind: 'dimensao', rows: c.areas.map((x) => ({ area_id: x.id, codigo: x.code, nome: x.name, area_negocio: x.businessUnit, base_preferencial_id: x.preferredBaseId })) },
    { name: 'DimLocal', kind: 'dimensao', rows: c.locations.map((x) => ({ local_id: x.id, area_id: x.areaId, nome: x.name, tem_posicao: x.point !== null, x_esquematico: x.point?.x ?? null, y_esquematico: x.point?.y ?? null })) },
    { name: 'DimBase', kind: 'dimensao', rows: c.bases.map((x) => ({ base_id: x.id, codigo: x.code, nome: x.name, posto_avancado: x.isAdvancedPost, tem_posicao: x.point !== null })) },
    { name: 'DimEquipe', kind: 'dimensao', rows: c.teams.map((x) => ({ equipe_id: x.id, codigo: x.code, nome: x.name })) },
    { name: 'DimViatura', kind: 'dimensao', rows: c.vehicles.map((x) => ({ viatura_id: x.id, codigo: x.code, tipo: x.type, descricao: x.description, base_id: x.baseId, ativo: x.active })) },
    { name: 'DimOrgaoAcionamento', kind: 'dimensao', rows: c.notificationTargets.map((x) => ({ orgao_id: x.id, codigo: x.code, nome: x.name, ordem: x.order })) },
    { name: 'DimStatus', kind: 'dimensao', rows: [...STATUS_ORDER, 'CANCELADA' as const].map((s, idx) => ({ status_codigo: s, nome: STATUS_LABEL[s], ordem: idx + 1, final: s === 'ENCERRADA' || s === 'CANCELADA' })) },
    { name: 'DimMarco', kind: 'dimensao', rows: MILESTONE_ORDER.map((m, idx) => ({ marco_codigo: m, nome: MILESTONE_LABEL[m], ordem: idx + 1 })) },
    { name: 'DimDefinicaoTempo', kind: 'dimensao', rows: c.durations.map((d) => ({ definicao_id: d.id, nome: d.label, marco_inicio: d.from, marco_fim: d.to, meta_min: d.targetMinutes, descricao: d.description })) },
    {
      name: 'Auditoria',
      kind: 'auditoria',
      rows: db.auditLog.map((a) => ({ auditoria_id: a.id, operacao_id: a.operationId, entidade: a.entity, registro_id: a.entityId, acao: a.action, campo: a.field, valor_anterior: a.oldValue, valor_novo: a.newValue, justificativa: a.reason || null, perfil: a.actorRole, ocorrido_utc: a.atUTC })),
    },
  ];

  return { generatedAtUTC: now.toISOString(), schemaVersion: SCHEMA_VERSION, tables };
}

/** CSV (RFC 4180, separador ";" para Excel pt-BR, BOM UTF-8). */
export function toCsv(rows: IntegrationRow[]): string {
  if (rows.length === 0) return '﻿';
  const headers = Object.keys(rows[0] as IntegrationRow);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\r\n');
}
