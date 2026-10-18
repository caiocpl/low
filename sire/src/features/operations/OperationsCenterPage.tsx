import { useMemo, useState } from 'react';
import { useCatalog, useNow, useRepoQuery, useSession } from '../../app/services';
import { Link, navigate } from '../../app/router';
import { PageHeader, MetricCard, Card } from '../../ui/layout';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { EmptyState, ErrorState, PriorityBadge, SkeletonBlock, StatusBadge } from '../../ui/feedback';
import { SchematicMap, incidentMarker } from '../../ui/SchematicMap';
import { computeOperationalMetrics, type MetricsFilter } from '../../domain/metrics';
import { ADVANCE_ACTION_LABEL, isActive, STATUS_LABEL, STATUS_ORDER } from '../../domain/status';
import { formatDateTime, formatDuration, formatRelative, formatTime, startOfLocalDay } from '../../domain/time';
import { ROLE_LABEL } from '../../domain/permissions';

type Period = 'hoje' | '24h' | '7d' | '14d';
const PERIOD_LABEL: Record<Period, string> = { hoje: 'Hoje', '24h': 'Últimas 24 h', '7d': '7 dias', '14d': '14 dias' };

export function OperationsCenterPage() {
  const catalog = useCatalog();
  const ds = useRepoQuery((r) => r.getOperationalDataset(), []);
  const now = useNow(15000);
  const { can } = useSession();
  const [period, setPeriod] = useState<Period>('7d');
  const [areaId, setAreaId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const filter: MetricsFilter = useMemo(() => {
    const fromUTC = period === 'hoje' ? startOfLocalDay(now) : new Date(now.getTime() - (period === '24h' ? 1 : period === '7d' ? 7 : 14) * 86400000).toISOString();
    return { fromUTC, toUTC: null, areaId: areaId || null, categoryId: categoryId || null };
  }, [now, period, areaId, categoryId]);

  const metrics = useMemo(() => (ds.data && catalog.data ? computeOperationalMetrics(ds.data, catalog.data, now, filter) : null), [ds.data, catalog.data, now, filter]);

  const activeList = useMemo(() => {
    if (!ds.data) return [];
    return ds.data.incidents
      .filter((i) => !i.isDeleted && isActive(i.status) && (!areaId || i.areaId === areaId) && (!categoryId || i.categoryId === categoryId))
      .sort((a, b) => a.priority.localeCompare(b.priority) || STATUS_ORDER.indexOf(b.status) - STATUS_ORDER.indexOf(a.status) || Date.parse(a.callReceivedAtUTC) - Date.parse(b.callReceivedAtUTC));
  }, [ds.data, areaId, categoryId]);

  if ((ds.error && !ds.data) || (catalog.error && !catalog.data)) {
    return <ErrorState message={ds.error ?? catalog.error ?? ''} onRetry={() => { ds.reload(); catalog.reload(); }} />;
  }

  const cat = catalog.data;
  const locName = (id: string | null) => cat?.locations.find((l) => l.id === id)?.name ?? 'Local não informado';
  const catName = (id: string) => cat?.categories.find((c) => c.id === id)?.name ?? 'Sem categoria';
  const maxCat = Math.max(1, ...(metrics?.byCategory.map((b) => b.count) ?? [1]));
  const stat = (s: { mean: number | null; median: number | null; n: number } | undefined) =>
    s && s.n ? formatDuration(s.median) : null;

  return (
    <>
      <PageHeader
        title="Central de operações"
        description="Situação operacional em tempo real das ocorrências. Painel do aplicativo para a operação — não substitui o Power BI gerencial."
        meta={
          <div className="row subtle" style={{ marginTop: 8 }}>
            <Icon name="clock" size={14} />
            <span aria-live="off">{formatDateTime(now.toISOString())} (Brasília)</span>
            <span aria-hidden>·</span>
            <span>Atualização automática a cada gravação</span>
          </div>
        }
        actions={
          can('incident.create') ? (
            <Button variant="primary" size="lg" icon="plus" onClick={() => navigate('/ocorrencias/nova')} data-testid="btn-new-call">
              Novo chamado <kbd style={{ marginLeft: 6, background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>Alt N</kbd>
            </Button>
          ) : null
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-bar" style={{ borderBottom: 0 }}>
          <div className="field" style={{ maxWidth: 'none', flex: '0 0 auto' }}>
            <span className="field-label" id="period-l">
              Período dos indicadores
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="period-l">
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}>
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ops-area">
              Macroárea
            </label>
            <select id="ops-area" className="select" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Todas</option>
              {cat?.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ops-cat">
              Categoria
            </label>
            <select id="ops-cat" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {cat?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!metrics ? (
        <div className="grid grid-metrics" style={{ marginBottom: 16 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card metric">
              <SkeletonBlock lines={2} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-metrics" style={{ marginBottom: 16 }} aria-label="Indicadores operacionais">
          <MetricCard label="Ocorrências ativas" value={metrics.active} icon="siren" accent="critical" to="/ocorrencias" testId="metric-active" foot={`${metrics.registered} em registro/triagem`} />
          <MetricCard label="Acionadas / em deslocamento" value={metrics.inTransit} icon="truck" accent="warning" to="/ocorrencias" testId="metric-transit" />
          <MetricCard label="Em atendimento" value={metrics.onScene} icon="flame" accent="critical" to="/ocorrencias" testId="metric-onscene" foot={`${metrics.controlled} controlada(s)`} />
          <MetricCard label="Encerradas hoje" value={metrics.closedToday} icon="checkCircle" accent="success" to="/ocorrencias?status=encerradas" testId="metric-closed-today" />
          <MetricCard
            label="Mobilização (mediana)"
            value={stat(metrics.mobilization)}
            icon="clock"
            accent="info"
            testId="metric-mobilization"
            foot={metrics.mobilization.n ? `Média ${formatDuration(metrics.mobilization.mean)} · n=${metrics.mobilization.n} · ${PERIOD_LABEL[period]}` : `Sem registros no período`}
          />
          <MetricCard
            label="Tempo de resposta (mediana)"
            value={stat(metrics.response)}
            icon="activity"
            accent="info"
            testId="metric-response"
            foot={metrics.response.n ? `Média ${formatDuration(metrics.response.mean)} · n=${metrics.response.n}` : 'Sem registros no período'}
          />
        </div>
      )}

      <div className="layout-main-side">
        <div className="stack">
          <Card
            title="Ocorrências ativas"
            icon="list"
            subtitle="Ordenadas por prioridade, etapa e tempo de espera"
            actions={
              <Link to="/ocorrencias" className="btn btn-ghost btn-sm">
                Ver fila completa <Icon name="chevronRight" size={14} />
              </Link>
            }
            bodyClass="tight"
          >
            {!ds.data ? (
              <SkeletonBlock lines={6} />
            ) : activeList.length === 0 ? (
              <EmptyState icon="checkCircle" title="Nenhuma ocorrência ativa">A central está sem atendimentos em andamento para os filtros selecionados.</EmptyState>
            ) : (
              <ul className="list" data-testid="active-list">
                {activeList.map((i) => (
                  <li key={i.id} className="list-item">
                    <PriorityBadge priority={i.priority} />
                    <div className="grow">
                      <Link to={`/ocorrencias/${i.id}`} className="cell-title">
                        {catName(i.categoryId)}
                      </Link>
                      <div className="item-sub">
                        <span className="mono">{i.protocol}</span> · {locName(i.locationId)} · {formatRelative(i.callReceivedAtUTC, now)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusBadge status={i.status} />
                      <div className="subtle" style={{ marginTop: 4 }}>
                        Próximo: {ADVANCE_ACTION_LABEL[i.status]?.toLowerCase() ?? '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Mapa operacional" icon="map" subtitle="Planta esquemática fictícia" bodyClass="tight">
            {cat ? <SchematicMap catalog={cat} markers={activeList.map(incidentMarker)} /> : <SkeletonBlock lines={6} />}
          </Card>
        </div>

        <aside className="stack">
          <Card title="Alertas de incompletude" icon="alert" subtitle="Regras de qualidade aplicadas aos registros" bodyClass="tight">
            {!metrics ? (
              <SkeletonBlock lines={4} />
            ) : metrics.alerts.length === 0 ? (
              <p className="muted">Nenhum alerta para os filtros atuais.</p>
            ) : (
              <ul className="list" data-testid="alerts">
                {metrics.alerts.slice(0, 8).map((a) => (
                  <li key={a.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <Icon name={a.severity === 'info' ? 'info' : 'alert'} className={a.severity === 'critical' ? 'nok' : undefined} />
                    <div className="grow">
                      <Link to={`/ocorrencias/${a.incidentId}`} className="cell-title mono">
                        {a.protocol}
                      </Link>
                      <div className="item-sub">{a.message}</div>
                    </div>
                    <span className={`badge tone-${a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info'}`}>{a.severity === 'critical' ? 'Crítico' : a.severity === 'warning' ? 'Atenção' : 'Info'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Últimos eventos" icon="history" bodyClass="tight">
            {!metrics ? (
              <SkeletonBlock lines={5} />
            ) : metrics.recent.length === 0 ? (
              <p className="muted">Sem eventos.</p>
            ) : (
              <ul className="list">
                {metrics.recent.map((h) => (
                  <li key={h.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <span className="mono subtle" style={{ minWidth: 42 }}>
                      {formatTime(h.atUTC)}
                    </span>
                    <div className="grow">
                      <Link to={`/ocorrencias/${h.incidentId}`} className="cell-title mono">
                        {h.protocol}
                      </Link>{' '}
                      <span className="item-sub">→ {STATUS_LABEL[h.toStatus]}</span>
                      <div className="item-sub">
                        {h.actorName} · {ROLE_LABEL[h.actorRole]}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Ocorrências por tipo" icon="layers" subtitle={`${PERIOD_LABEL[period]} · ${metrics?.totalInPeriod ?? 0} registro(s)`} bodyClass="tight">
            {!metrics ? (
              <SkeletonBlock lines={4} />
            ) : metrics.byCategory.length === 0 ? (
              <p className="muted">Sem dados no período.</p>
            ) : (
              <div className="bar-list">
                {metrics.byCategory.map((b) => (
                  <div key={b.categoryId} className="bar-row">
                    <span>{b.name}</span>
                    <strong style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b.count}</strong>
                    <div className="bar-track" aria-hidden>
                      <div className="bar-fill" style={{ width: `${(b.count / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
