/**
 * Modelo do relatório da ocorrência — função PURA (testável) que decide o conteúdo.
 * O desenho em PDF fica em incidentPdf.ts.
 */
import type { Catalog, IncidentAggregate } from '../../../domain/types';
import { computeDurations, effectiveMilestones, MILESTONE_LABEL, MILESTONE_ORDER } from '../../../domain/milestones';
import { formatDateTime, formatDuration } from '../../../domain/time';
import { STATUS_LABEL } from '../../../domain/status';
import { ROLE_LABEL } from '../../../domain/permissions';
import { OTHER_RESOURCE_LABEL, VICTIM_BOND_LABEL, VICTIM_CONDITION_LABEL, VICTIM_DESTINATION_LABEL } from '../../../domain/labels';

export interface ReportKV {
  label: string;
  value: string;
}

export interface ReportModel {
  protocol: string;
  status: string;
  title: string;
  identification: ReportKV[];
  location: ReportKV[];
  facts: ReportKV[];
  description: string;
  milestones: string[][];
  durations: string[][];
  vehicles: string[][];
  personnel: string[][];
  otherResources: string[][];
  combat: ReportKV[];
  victims: string[][];
  witnesses: string[][];
  notifications: string[][];
  history: string[][];
  photos: { caption: string; dataUrl: string; mimeType: string }[];
  closing: { summary: string; closedAt: string; closedBy: string; cancelReason: string };
  signatures: { role: string; name: string; at: string }[];
}

const v = (s: string | null | undefined, empty = 'Não informado') => (s && String(s).trim() ? String(s) : empty);

export function buildReportModel(agg: IncidentAggregate, catalog: Catalog): ReportModel {
  const inc = agg.incident;
  const find = <T extends { id: string }>(arr: T[], id: string | null) => arr.find((x) => x.id === id);
  const cat = find(catalog.categories, inc.categoryId);
  const eff = effectiveMilestones(agg.milestones);
  const closeEntry = [...agg.statusHistory].reverse().find((h) => h.toStatus === 'ENCERRADA' || h.toStatus === 'CANCELADA');
  const createdEntry = agg.statusHistory[0];

  return {
    protocol: inc.protocol,
    status: STATUS_LABEL[inc.status],
    title: inc.title,
    identification: [
      { label: 'Protocolo', value: inc.protocol },
      { label: 'Status', value: STATUS_LABEL[inc.status] },
      { label: 'Data/hora do chamado', value: formatDateTime(inc.callReceivedAtUTC) },
      { label: 'Canal', value: v(catalog.channels.find((c) => c.code === inc.channel)?.label) },
      { label: 'Tipo / hipótese', value: v(cat?.name) },
      { label: 'Prioridade', value: v(catalog.priorities.find((p) => p.code === inc.priority)?.label) },
      { label: 'Fase', value: inc.phase === 'REATIVA' ? 'Reativa' : 'Proativa' },
      { label: 'Operador', value: v(inc.operatorName) },
    ],
    location: [
      { label: 'Macroárea', value: v(find(catalog.areas, inc.areaId)?.name) },
      { label: 'Local', value: v(find(catalog.locations, inc.locationId)?.name) },
      { label: 'Ponto de referência', value: v(inc.reference) },
      { label: 'Base responsável', value: v(find(catalog.bases, inc.responsibleBaseId)?.name) },
      { label: 'Equipe', value: v(find(catalog.teams, inc.teamId)?.name) },
      { label: 'Solicitante', value: v(inc.callerName) },
    ],
    facts: [
      { label: 'Classificação', value: v(inc.classification) },
      { label: 'Desdobramento', value: v(inc.unfolding) },
      { label: 'Item PAE', value: v(inc.paeItem) },
      { label: 'Ocorrência atendida?', value: inc.attended === null ? 'Não respondido' : inc.attended ? 'Sim' : 'Não' },
    ],
    description: v(inc.description, 'Sem descrição.'),
    milestones: MILESTONE_ORDER.map((m) => [MILESTONE_LABEL[m], eff[m] ? formatDateTime(eff[m]) : '—']),
    durations: computeDurations(catalog.durations, eff).map((d) => [
      d.definition.label,
      `${MILESTONE_LABEL[d.definition.from]} → ${MILESTONE_LABEL[d.definition.to]}`,
      d.status === 'SEM_DADOS' ? 'Sem dados' : formatDuration(d.minutes),
      d.definition.targetMinutes !== null ? `${d.definition.targetMinutes} min` : '—',
    ]),
    vehicles: agg.vehicles
      .filter((x) => !x.isDeleted)
      .map((x) => {
        const veh = find(catalog.vehicles, x.vehicleId);
        const km = x.kmStart !== null && x.kmEnd !== null ? String(x.kmEnd - x.kmStart) : '—';
        return [v(veh?.code), v(veh?.description), x.kmStart === null ? '—' : String(x.kmStart), x.kmEnd === null ? '—' : String(x.kmEnd), km];
      }),
    personnel: agg.personnel.filter((x) => !x.isDeleted).map((x) => [v(find(catalog.people, x.personId)?.name), x.functionInIncident]),
    otherResources: agg.otherResources.filter((x) => !x.isDeleted).map((x) => [OTHER_RESOURCE_LABEL[x.category], x.description, String(x.quantity)]),
    combat: [
      { label: 'Agente extintor', value: v(inc.extinguishingAgent, 'N/A') },
      { label: 'Qtd. utilizada', value: v(inc.extinguishingQty, 'N/A') },
      { label: 'Área afetada', value: inc.affectedAreaM2 === null ? 'N/A' : `${inc.affectedAreaM2.toLocaleString('pt-BR')} m²` },
      { label: 'Produto químico', value: v(inc.chemicalProduct, 'N/A') },
    ],
    victims: agg.victims
      .filter((x) => !x.isDeleted)
      .map((x) => [x.pseudonym, VICTIM_CONDITION_LABEL[x.condition], VICTIM_DESTINATION_LABEL[x.destination], VICTIM_BOND_LABEL[x.bond]]),
    witnesses: agg.witnesses.filter((x) => !x.isDeleted).map((x) => [x.name, formatDateTime(x.takenAtUTC), x.statement]),
    notifications: agg.notifications
      .filter((x) => !x.isDeleted)
      .sort((a, b) => Date.parse(a.atUTC) - Date.parse(b.atUTC))
      .map((x) => [v(find(catalog.notificationTargets, x.targetId)?.name), formatDateTime(x.atUTC), x.actorName]),
    history: [
      ...agg.statusHistory.map((h) => ({ at: h.atUTC, row: [formatDateTime(h.atUTC), h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ${STATUS_LABEL[h.toStatus]}` : `Criada (${STATUS_LABEL[h.toStatus]})`, `${h.actorName} (${ROLE_LABEL[h.actorRole]})${h.reason ? ` — ${h.reason}` : ''}`] })),
      ...agg.events.filter((e) => e.type === 'NOTA' || e.type === 'CORRECAO').map((e) => ({ at: e.atUTC, row: [formatDateTime(e.atUTC), e.type === 'NOTA' ? 'Anotação' : 'Correção', `${e.text} — ${e.actorName}`] })),
    ]
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .map((x) => x.row),
    photos: agg.attachments.filter((a) => !a.isDeleted).map((a) => ({ caption: a.caption, dataUrl: a.dataUrl, mimeType: a.mimeType })),
    closing: {
      summary: inc.closingSummary,
      closedAt: inc.closedAtUTC ? formatDateTime(inc.closedAtUTC) : '',
      closedBy: closeEntry ? `${closeEntry.actorName} (${ROLE_LABEL[closeEntry.actorRole]})` : '',
      cancelReason: inc.cancelReason,
    },
    signatures: [
      { role: 'Operador(a) da central', name: inc.operatorName, at: createdEntry ? formatDateTime(createdEntry.atUTC) : '' },
      { role: 'Coordenação', name: closeEntry?.toStatus === 'ENCERRADA' ? closeEntry.actorName : 'Pendente de encerramento', at: closeEntry?.toStatus === 'ENCERRADA' ? formatDateTime(closeEntry.atUTC) : '' },
    ],
  };
}
