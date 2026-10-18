import type { IncidentAggregate } from '../../domain/types';
import { Icon, type IconName } from '../../ui/Icon';
import { STATUS_LABEL } from '../../domain/status';
import { MILESTONE_LABEL } from '../../domain/milestones';
import { formatDateTime } from '../../domain/time';
import { ROLE_LABEL } from '../../domain/permissions';

export interface TimelineEntry {
  id: string;
  atUTC: string;
  kind: 'status' | 'milestone' | 'event' | 'correction' | 'alert';
  icon: IconName;
  title: string;
  text?: string;
  meta: string;
}

/** Linha do tempo unificada e somente-acréscimo: status, marcos e eventos em ordem cronológica. */
export function buildTimeline(agg: IncidentAggregate, vehicleName: (id: string | null) => string | null): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const h of agg.statusHistory) {
    entries.push({
      id: h.id,
      atUTC: h.atUTC,
      kind: h.toStatus === 'CANCELADA' ? 'alert' : 'status',
      icon: h.toStatus === 'CANCELADA' ? 'xCircle' : 'arrowRight',
      title: h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ${STATUS_LABEL[h.toStatus]}` : `Criada como ${STATUS_LABEL[h.toStatus]}`,
      text: h.reason || undefined,
      meta: `${h.actorName} · ${ROLE_LABEL[h.actorRole]}`,
    });
  }
  for (const m of agg.milestones) {
    const v = vehicleName(m.vehicleId);
    entries.push({
      id: m.id,
      atUTC: m.atUTC,
      kind: m.isDeleted ? 'correction' : 'milestone',
      icon: 'clock',
      title: `${MILESTONE_LABEL[m.type]}${m.isDeleted ? ' (desconsiderado)' : ''}`,
      text: v ? `Viatura: ${v}` : undefined,
      meta: `${m.actorName} · lançado em ${formatDateTime(m.recordedAtUTC)}`,
    });
  }
  for (const e of agg.events) {
    if (e.type === 'SISTEMA' && e.text.startsWith('Status alterado')) continue; // já representado pelo histórico de status
    entries.push({
      id: e.id,
      atUTC: e.atUTC,
      kind: e.type === 'CORRECAO' ? 'correction' : 'event',
      icon: e.type === 'NOTA' ? 'note' : e.type === 'ANEXO' ? 'image' : e.type === 'ACIONAMENTO' ? 'phone' : e.type === 'CORRECAO' ? 'edit' : e.type === 'RECURSO' ? 'truck' : 'info',
      title: e.type === 'NOTA' ? 'Anotação' : e.type === 'CORRECAO' ? 'Correção' : e.type === 'ANEXO' ? 'Anexo' : e.type === 'ACIONAMENTO' ? 'Acionamento' : e.type === 'RECURSO' ? 'Recurso' : 'Sistema',
      text: e.text,
      meta: e.actorName,
    });
  }
  return entries.sort((a, b) => Date.parse(a.atUTC) - Date.parse(b.atUTC) || a.kind.localeCompare(b.kind));
}

export function IncidentTimeline({ entries, order = 'asc' }: { entries: TimelineEntry[]; order?: 'asc' | 'desc' }) {
  const list = order === 'desc' ? [...entries].reverse() : entries;
  if (list.length === 0) return <p className="muted">Sem eventos registrados.</p>;
  return (
    <ol className="timeline" aria-label="Linha do tempo da ocorrência">
      {list.map((e) => (
        <li key={e.id} className={`tl-item k-${e.kind}`}>
          <span className="tl-dot" aria-hidden>
            <Icon name={e.icon} size={15} />
          </span>
          <div>
            <div className="tl-head">
              <time className="tl-time" dateTime={e.atUTC}>
                {formatDateTime(e.atUTC)}
              </time>
              <span className="tl-title">{e.title}</span>
            </div>
            {e.text ? <div className="tl-text">{e.text}</div> : null}
            <div className="tl-meta">{e.meta}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
