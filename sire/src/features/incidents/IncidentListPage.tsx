import { useEffect, useMemo, useState } from 'react';
import type { IncidentStatus, Priority } from '../../domain/types';
import { useCatalog, useNow, useRepoQuery, useSession } from '../../app/services';
import { Link, navigate, useLocation } from '../../app/router';
import { PageHeader } from '../../ui/layout';
import { DataTable, Pagination, type Column } from '../../ui/DataTable';
import { EmptyState, ErrorState, PriorityBadge, SkeletonBlock, StatusBadge } from '../../ui/feedback';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { STATUS_LABEL, STATUS_ORDER } from '../../domain/status';
import { formatDateTime, formatRelative, fromLocalInputValue } from '../../domain/time';
import type { Incident } from '../../domain/types';
import type { IncidentQuery } from '../../data/repository';

const PRESETS: { id: string; label: string; statuses: IncidentStatus[] }[] = [
  { id: 'ativas', label: 'Ativas', statuses: ['REGISTRADA', 'EM_TRIAGEM', 'ACIONADA', 'EM_DESLOCAMENTO', 'EM_ATENDIMENTO', 'CONTROLADA'] },
  { id: 'rascunhos', label: 'Rascunhos', statuses: ['RASCUNHO'] },
  { id: 'encerradas', label: 'Encerradas', statuses: ['ENCERRADA'] },
  { id: 'canceladas', label: 'Canceladas', statuses: ['CANCELADA'] },
  { id: 'todas', label: 'Todas', statuses: [] },
];

export function IncidentListPage() {
  const { query } = useLocation();
  const { can } = useSession();
  const catalog = useCatalog();
  const now = useNow();
  const [preset, setPreset] = useState(query.get('status') ?? 'ativas');
  const [search, setSearch] = useState(query.get('q') ?? '');
  const [debounced, setDebounced] = useState(search);
  const [categoryId, setCategoryId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<NonNullable<IncidentQuery['sort']>>('recent');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 200);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [preset, debounced, categoryId, areaId, priority, from, to, sort]);
  useEffect(() => {
    const qs = new URLSearchParams();
    if (preset !== 'ativas') qs.set('status', preset);
    if (debounced) qs.set('q', debounced);
    const target = `/ocorrencias${qs.toString() ? `?${qs}` : ''}`;
    if (`#${target}` !== window.location.hash) navigate(target, { replace: true });
  }, [preset, debounced]);

  const statuses = PRESETS.find((p) => p.id === preset)?.statuses ?? [];
  const q: IncidentQuery = {
    search: debounced,
    statuses,
    categoryId: categoryId || null,
    areaId: areaId || null,
    priority: (priority || null) as Priority | null,
    fromUTC: from ? fromLocalInputValue(`${from}T00:00`) : null,
    toUTC: to ? fromLocalInputValue(`${to}T23:59`) : null,
    sort,
    page,
    pageSize: 15,
  };
  const result = useRepoQuery((r) => r.listIncidents(q), [JSON.stringify(q)]);
  const counts = useRepoQuery(async (r) => {
    const ds = await r.getOperationalDataset();
    return Object.fromEntries(PRESETS.map((p) => [p.id, ds.incidents.filter((i) => !i.isDeleted && (p.statuses.length === 0 || p.statuses.includes(i.status))).length]));
  }, []);

  const cat = catalog.data;
  const name = useMemo(() => {
    const loc = new Map(cat?.locations.map((l) => [l.id, l.name]));
    const area = new Map(cat?.areas.map((a) => [a.id, a.name]));
    const base = new Map(cat?.bases.map((b) => [b.id, b.name]));
    const category = new Map(cat?.categories.map((c) => [c.id, c.name]));
    return { loc, area, base, category };
  }, [cat]);

  const hasFilters = Boolean(search || categoryId || areaId || priority || from || to);
  const clear = () => {
    setSearch('');
    setCategoryId('');
    setAreaId('');
    setPriority('');
    setFrom('');
    setTo('');
  };

  const columns: Column<Incident>[] = [
    {
      key: 'protocol',
      header: 'Protocolo',
      sortKey: 'recent',
      render: (i) => (
        <div>
          <Link to={`/ocorrencias/${i.id}`} className="cell-title mono">
            {i.protocol}
          </Link>
          <div className="cell-sub">{i.channel === 'RADIO' ? 'Rádio' : i.channel === 'SISTEMA' ? 'Sistema' : 'Central'}</div>
        </div>
      ),
    },
    { key: 'prio', header: 'Prior.', sortKey: 'priority', render: (i) => <PriorityBadge priority={i.priority} />, width: 70 },
    {
      key: 'title',
      header: 'Ocorrência',
      render: (i) => (
        <div style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 600 }}>{name.category.get(i.categoryId) ?? 'Sem categoria'}</div>
          <div className="cell-sub">{i.locationId ? name.loc.get(i.locationId) : 'Local não informado'}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortKey: 'status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'base', header: 'Base', render: (i) => (i.responsibleBaseId ? name.base.get(i.responsibleBaseId) : <span className="subtle">A definir</span>) },
    {
      key: 'call',
      header: 'Chamado',
      render: (i) => (
        <div className="nowrap">
          <div>{formatDateTime(i.callReceivedAtUTC)}</div>
          <div className="cell-sub">{formatRelative(i.callReceivedAtUTC, now)}</div>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Central', to: '/' }, { label: 'Ocorrências' }]}
        title="Ocorrências"
        description="Fila de atendimento com histórico completo. Clique em uma linha para abrir a ocorrência."
        actions={
          can('incident.create') ? (
            <Button variant="primary" icon="plus" onClick={() => navigate('/ocorrencias/nova')}>
              Novo chamado
            </Button>
          ) : null
        }
      />
      <section className="card" aria-label="Lista de ocorrências">
        <div className="filter-bar" style={{ alignItems: 'center', paddingBottom: 0, borderBottom: 0 }}>
          <div className="chip-row" role="group" aria-label="Situação">
            {PRESETS.map((p) => (
              <button key={p.id} className="chip" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)}>
                {p.label}
                {counts.data ? <span className="count">{counts.data[p.id]}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-bar" role="search">
          <div className="field search">
            <label className="field-label" htmlFor="f-search">
              Buscar
            </label>
            <div className="input-icon">
              <Icon name="search" />
              <input id="f-search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Protocolo, local, descrição ou solicitante" />
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-cat">
              Categoria
            </label>
            <select id="f-cat" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {cat?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-area">
              Macroárea
            </label>
            <select id="f-area" className="select" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Todas</option>
              {cat?.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 130 }}>
            <label className="field-label" htmlFor="f-prio">
              Prioridade
            </label>
            <select id="f-prio" className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Todas</option>
              {cat?.priorities.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ maxWidth: 170 }}>
            <label className="field-label" htmlFor="f-from">
              De
            </label>
            <input id="f-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 170 }}>
            <label className="field-label" htmlFor="f-to">
              Até
            </label>
            <input id="f-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 190 }}>
            <label className="field-label" htmlFor="f-sort">
              Ordenar por
            </label>
            <select id="f-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="priority">Prioridade</option>
              <option value="status">Etapa do fluxo</option>
            </select>
          </div>
          {hasFilters ? (
            <Button variant="ghost" icon="x" onClick={clear}>
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {result.error && !result.data ? (
          <ErrorState message={result.error} onRetry={result.reload} />
        ) : !result.data ? (
          <div className="card-body">
            <SkeletonBlock lines={8} />
          </div>
        ) : (
          <div aria-busy={result.loading}>
            {result.error ? (
              <div className="alert tone-warning" role="alert" style={{ margin: 16 }}>
                <Icon name="cloudOff" />
                <div>Falha ao atualizar a lista: {result.error} Exibindo a última versão carregada.</div>
              </div>
            ) : null}
            <DataTable
              caption="Ocorrências"
              columns={columns}
              rows={result.data.items}
              rowKey={(i) => i.id}
              onRowClick={(i) => navigate(`/ocorrencias/${i.id}`)}
              sort={sort}
              onSort={(k) => setSort(k as typeof sort)}
              empty={
                <EmptyState icon="search" title="Nenhuma ocorrência encontrada" action={hasFilters ? <Button onClick={clear}>Limpar filtros</Button> : null}>
                  {preset === 'ativas' && !hasFilters ? 'Não há ocorrências ativas no momento.' : 'Ajuste a busca ou os filtros.'}
                </EmptyState>
              }
              mobileRender={(i) => (
                <Link to={`/ocorrencias/${i.id}`} className="mobile-card">
                  <div className="row-between">
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {i.protocol}
                    </span>
                    <StatusBadge status={i.status} />
                  </div>
                  <div className="row">
                    <PriorityBadge priority={i.priority} />
                    <strong>{name.category.get(i.categoryId) ?? 'Sem categoria'}</strong>
                  </div>
                  <div className="subtle">
                    {i.locationId ? name.loc.get(i.locationId) : 'Local não informado'} · {formatRelative(i.callReceivedAtUTC, now)}
                  </div>
                </Link>
              )}
            />
            <Pagination page={result.data.page} pageSize={result.data.pageSize} total={result.data.total} onPage={setPage} />
          </div>
        )}
      </section>
      <p className="subtle" style={{ marginTop: 12 }}>
        Situações: {STATUS_ORDER.map((s) => STATUS_LABEL[s]).join(' → ')} · ou Cancelada (com justificativa).
      </p>
    </>
  );
}
