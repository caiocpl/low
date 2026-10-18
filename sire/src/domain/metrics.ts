import type {
  Catalog,
  Incident,
  IncidentMilestone,
  IncidentStatusHistory,
  IncidentVehicle,
  IsoUtc,
} from './types';
import { effectiveMilestones, mean, median, validateChronology } from './milestones';
import { diffMinutes, formatDuration, startOfLocalDay } from './time';
import { isActive } from './status';

export interface OperationalDataset {
  incidents: Incident[];
  milestones: IncidentMilestone[];
  statusHistory: IncidentStatusHistory[];
  vehicles: IncidentVehicle[];
}

export interface MetricsFilter {
  fromUTC: IsoUtc | null;
  toUTC: IsoUtc | null;
  areaId: string | null;
  categoryId: string | null;
}

export interface DurationStat {
  mean: number | null;
  median: number | null;
  n: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  incidentId: string;
  protocol: string;
  message: string;
}

export interface OperationalMetrics {
  active: number;
  registered: number;
  inTransit: number;
  onScene: number;
  controlled: number;
  closedToday: number;
  drafts: number;
  totalInPeriod: number;
  mobilization: DurationStat;
  response: DurationStat;
  byCategory: { categoryId: string; name: string; count: number }[];
  alerts: OperationalAlert[];
  recent: (IncidentStatusHistory & { protocol: string })[];
}

const DRAFT_STALE_MIN = 30;
const OPEN_TOO_LONG_MIN = 240;

function stat(values: number[]): DurationStat {
  const valid = values.filter((v) => Number.isFinite(v) && v >= 0);
  return { mean: mean(valid), median: median(valid), n: valid.length };
}

export function inFilter(inc: Incident, f: MetricsFilter): boolean {
  const t = Date.parse(inc.callReceivedAtUTC);
  if (f.fromUTC && t < Date.parse(f.fromUTC)) return false;
  if (f.toUTC && t > Date.parse(f.toUTC)) return false;
  if (f.areaId && inc.areaId !== f.areaId) return false;
  if (f.categoryId && inc.categoryId !== f.categoryId) return false;
  return true;
}

export function computeOperationalMetrics(
  ds: OperationalDataset,
  catalog: Catalog,
  now: Date,
  filter: MetricsFilter,
): OperationalMetrics {
  const all = ds.incidents.filter((i) => !i.isDeleted);
  const scoped = all.filter((i) => inFilter(i, filter));
  const todayStart = Date.parse(startOfLocalDay(now));

  const msByIncident = new Map<string, IncidentMilestone[]>();
  for (const m of ds.milestones) {
    const list = msByIncident.get(m.incidentId) ?? [];
    list.push(m);
    msByIncident.set(m.incidentId, list);
  }
  const vehiclesByIncident = new Map<string, number>();
  for (const v of ds.vehicles) {
    if (v.isDeleted) continue;
    vehiclesByIncident.set(v.incidentId, (vehiclesByIncident.get(v.incidentId) ?? 0) + 1);
  }

  // Situação atual: usa o universo filtrado por área/categoria, mas não por período
  // (uma ocorrência aberta ontem continua exigindo atenção hoje).
  const current = all.filter((i) => inFilter(i, { ...filter, fromUTC: null, toUTC: null }));

  const mobilization: number[] = [];
  const response: number[] = [];
  const alerts: OperationalAlert[] = [];

  for (const inc of scoped) {
    const eff = effectiveMilestones(msByIncident.get(inc.id) ?? []);
    if (eff.ACIONAMENTO && eff.SAIDA_BASE) mobilization.push(diffMinutes(eff.ACIONAMENTO, eff.SAIDA_BASE));
    if (eff.CHAMADO && eff.CHEGADA_LOCAL) response.push(diffMinutes(eff.CHAMADO, eff.CHEGADA_LOCAL));
  }

  for (const inc of current) {
    const eff = effectiveMilestones(msByIncident.get(inc.id) ?? []);
    const ageMin = (now.getTime() - Date.parse(inc.callReceivedAtUTC)) / 60000;
    const push = (severity: AlertSeverity, code: string, message: string) =>
      alerts.push({ id: `${inc.id}:${code}`, severity, incidentId: inc.id, protocol: inc.protocol, message });

    if (inc.status === 'RASCUNHO' && ageMin > DRAFT_STALE_MIN) {
      push('warning', 'draft', `Rascunho sem registro há ${formatDuration(ageMin)} — conclua ou cancele.`);
    }
    if (isActive(inc.status) || inc.status === 'ENCERRADA') {
      const issues = validateChronology(eff, now);
      if (issues.length) push('critical', 'chrono', `Linha do tempo inconsistente: ${issues[0]?.message}`);
    }
    if (!isActive(inc.status)) continue;
    if (['ACIONADA', 'EM_DESLOCAMENTO', 'EM_ATENDIMENTO', 'CONTROLADA'].includes(inc.status) && !inc.responsibleBaseId) {
      push('warning', 'base', 'Ocorrência acionada sem base responsável definida.');
    }
    if (['EM_DESLOCAMENTO', 'EM_ATENDIMENTO', 'CONTROLADA'].includes(inc.status) && !vehiclesByIncident.get(inc.id)) {
      push('warning', 'vehicle', 'Em campo sem viatura vinculada na aba Viaturas.');
    }
    if (inc.status !== 'CONTROLADA' && ageMin > OPEN_TOO_LONG_MIN) {
      push('info', 'long', `Aberta há ${formatDuration(ageMin)} sem declaração de controle.`);
    }
    const loc = catalog.locations.find((l) => l.id === inc.locationId);
    if (inc.locationId && loc && !loc.point) {
      push('info', 'coords', `Local "${loc.name}" sem posição cadastrada — mapa exibe lista alternativa.`);
    }
  }

  const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const byCategoryMap = new Map<string, number>();
  for (const inc of scoped) {
    if (inc.status === 'RASCUNHO' || inc.status === 'CANCELADA') continue;
    byCategoryMap.set(inc.categoryId, (byCategoryMap.get(inc.categoryId) ?? 0) + 1);
  }
  const byCategory = [...byCategoryMap.entries()]
    .map(([categoryId, count]) => ({
      categoryId,
      count,
      name: catalog.categories.find((c) => c.id === categoryId)?.name ?? 'Sem categoria',
    }))
    .sort((a, b) => b.count - a.count);

  const protocolById = new Map(all.map((i) => [i.id, i.protocol]));
  const currentIds = new Set(current.map((i) => i.id));
  const recent = ds.statusHistory
    .filter((h) => currentIds.has(h.incidentId))
    .sort((a, b) => Date.parse(b.atUTC) - Date.parse(a.atUTC))
    .slice(0, 8)
    .map((h) => ({ ...h, protocol: protocolById.get(h.incidentId) ?? '—' }));

  return {
    active: current.filter((i) => isActive(i.status)).length,
    registered: current.filter((i) => i.status === 'REGISTRADA' || i.status === 'EM_TRIAGEM').length,
    inTransit: current.filter((i) => i.status === 'ACIONADA' || i.status === 'EM_DESLOCAMENTO').length,
    onScene: current.filter((i) => i.status === 'EM_ATENDIMENTO').length,
    controlled: current.filter((i) => i.status === 'CONTROLADA').length,
    closedToday: current.filter((i) => i.status === 'ENCERRADA' && i.closedAtUTC && Date.parse(i.closedAtUTC) >= todayStart).length,
    drafts: current.filter((i) => i.status === 'RASCUNHO').length,
    totalInPeriod: scoped.filter((i) => i.status !== 'RASCUNHO').length,
    mobilization: stat(mobilization),
    response: stat(response),
    byCategory,
    alerts,
    recent,
  };
}
