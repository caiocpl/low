import { useRepoQuery, useSession } from '../../../app/services';
import { ROLE_LABEL } from '../../../domain/permissions';
import { STATUS_LABEL } from '../../../domain/status';
import { formatDateTime } from '../../../domain/time';
import { Alert, SkeletonBlock, StatusBadge } from '../../../ui/feedback';
import { useDetail } from './context';

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  TRANSITION: 'Mudança de status',
  ADD_CHILD: 'Inclusão',
  REMOVE_CHILD: 'Remoção lógica',
  CORRECTION: 'Correção pós-encerramento',
  RESET: 'Reinício',
};

export function HistoryTab() {
  const { agg } = useDetail();
  const { can } = useSession();
  const audit = useRepoQuery((r) => (can('audit.view') ? r.listAudit(agg.incident.id) : Promise.resolve(null)), [agg.incident.id, agg.incident.updatedAtUTC, can('audit.view')]);
  return (
    <div className="stack">
      <section>
        <h3 className="section-title">Histórico de status</h3>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Histórico de status</caption>
            <thead>
              <tr>
                <th scope="col">Quando</th>
                <th scope="col">De</th>
                <th scope="col">Para</th>
                <th scope="col">Autor</th>
                <th scope="col">Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {agg.statusHistory.map((h) => (
                <tr key={h.id}>
                  <td className="nowrap">{formatDateTime(h.atUTC, true)}</td>
                  <td>{h.fromStatus ? STATUS_LABEL[h.fromStatus] : '—'}</td>
                  <td>
                    <StatusBadge status={h.toStatus} />
                  </td>
                  <td>
                    {h.actorName}
                    <div className="cell-sub">{ROLE_LABEL[h.actorRole]}</div>
                  </td>
                  <td>{h.reason || <span className="subtle">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="section-title">Trilha de auditoria (campo a campo)</h3>
        {!can('audit.view') ? (
          <Alert tone="info">A trilha detalhada é visível para Coordenador e Administrador.</Alert>
        ) : !audit.data ? (
          <SkeletonBlock lines={4} />
        ) : audit.data.length === 0 ? (
          <p className="muted">Sem alterações registradas nesta sessão de demonstração (registros do seed não têm trilha).</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Auditoria</caption>
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Ação</th>
                  <th scope="col">Campo</th>
                  <th scope="col">Anterior → Novo</th>
                  <th scope="col">Autor</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{formatDateTime(a.atUTC, true)}</td>
                    <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                    <td className="mono">{a.field ?? a.entity}</td>
                    <td style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>
                      <span className="subtle">{a.oldValue ?? '∅'}</span> → <strong>{a.newValue ?? '∅'}</strong>
                      {a.reason ? <div className="cell-sub">Motivo: {a.reason}</div> : null}
                    </td>
                    <td>
                      {a.actorName}
                      <div className="cell-sub">{ROLE_LABEL[a.actorRole]}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
