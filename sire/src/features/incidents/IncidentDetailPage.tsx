import { useEffect, useMemo, useState } from 'react';
import { navigate, useLocation } from '../../app/router';
import { useCatalog, useNow, useRepoQuery, useSession } from '../../app/services';
import { PageHeader, Card, Tabs } from '../../ui/layout';
import { Alert, EmptyState, ErrorState, PriorityBadge, SkeletonBlock, StatusBadge } from '../../ui/feedback';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Dialog } from '../../ui/Dialog';
import { SchematicMap, incidentMarker } from '../../ui/SchematicMap';
import { useToast } from '../../ui/Toast';
import { STATUS_LABEL, STATUS_ORDER } from '../../domain/status';
import { computeDurations, effectiveMilestones, validateChronology } from '../../domain/milestones';
import { formatDateTime, formatDuration, formatRelative } from '../../domain/time';
import { NotFoundError } from '../../data/errors';
import type { Catalog, IncidentAggregate } from '../../domain/types';
import { DetailContext, computeWritable } from './detail/context';
import { StatusActions } from './detail/StatusActions';
import { DataTab } from './detail/DataTab';
import { TimeTab } from './detail/TimeTab';
import { NotificationsTab, OtherResourcesTab, PersonnelTab, VehiclesTab, VictimsTab, WitnessesTab } from './detail/ResourceTabs';
import { AttachmentsTab } from './detail/AttachmentsTab';
import { HistoryTab } from './detail/HistoryTab';
import { ContactsList } from '../contacts/ContactsList';
import { buildReportModel } from './report/reportModel';

type TabId = 'dados' | 'tempo' | 'viaturas' | 'efetivo' | 'vitimas' | 'testemunhas' | 'recursos' | 'acionamentos' | 'anexos' | 'historico' | 'contatos';

export function IncidentDetailPage({ id }: { id: string }) {
  const catalog = useCatalog();
  const agg = useRepoQuery((r) => r.getIncident(id).catch((e) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  }), [id]);

  if (agg.data === null) {
    return (
      <div className="card">
        <EmptyState icon="search" title="Ocorrência não encontrada" action={<Button onClick={() => navigate('/ocorrencias')}>Voltar à lista</Button>}>
          O endereço pode estar incorreto ou a demonstração foi reiniciada.
        </EmptyState>
      </div>
    );
  }
  if ((agg.error && !agg.data) || (catalog.error && !catalog.data)) return <ErrorState message={agg.error ?? catalog.error ?? ''} onRetry={() => { agg.reload(); catalog.reload(); }} />;
  if (!agg.data || !catalog.data) {
    return (
      <div className="stack">
        <div className="card card-body">
          <SkeletonBlock lines={5} />
        </div>
        <div className="card card-body">
          <SkeletonBlock lines={8} />
        </div>
      </div>
    );
  }
  return <Detail agg={agg.data} catalog={catalog.data} reload={agg.reload} stale={Boolean(agg.error)} />;
}

function Detail({ agg, catalog, reload, stale }: { agg: IncidentAggregate; catalog: Catalog; reload: () => void; stale: boolean }) {
  const { can, actor } = useSession();
  const { query } = useLocation();
  const now = useNow(20000);
  const inc = agg.incident;
  const [tab, setTab] = useState<TabId>((query.get('aba') as TabId) || 'dados');
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const toast = useToast();
  const writable = computeWritable(agg, can);
  const cat = catalog.categories.find((c) => c.id === inc.categoryId);
  const eff = effectiveMilestones(agg.milestones);
  const durations = computeDurations(catalog.durations, eff);
  const chronology = validateChronology(eff, now);
  const loc = catalog.locations.find((l) => l.id === inc.locationId);
  const base = catalog.bases.find((b) => b.id === inc.responsibleBaseId);
  const count = <T extends { isDeleted: boolean }>(xs: T[]) => xs.filter((x) => !x.isDeleted).length;

  useEffect(() => () => {
    if (reportUrl) URL.revokeObjectURL(reportUrl);
  }, [reportUrl]);

  const statusTimes = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of agg.statusHistory) if (!map.has(h.toStatus)) map.set(h.toStatus, h.atUTC);
    return map;
  }, [agg.statusHistory]);

  const tabs: { id: TabId; label: string; count?: number; icon?: Parameters<typeof Tabs>[0]['tabs'][number]['icon'] }[] = [
    { id: 'dados', label: 'Dados' },
    { id: 'tempo', label: 'Deslocamentos e tempo', count: count(agg.milestones) },
    { id: 'viaturas', label: 'Viaturas', count: count(agg.vehicles) },
    { id: 'efetivo', label: 'Efetivo', count: count(agg.personnel) },
    { id: 'vitimas', label: 'Vítimas', count: count(agg.victims) },
    { id: 'testemunhas', label: 'Testemunhas', count: count(agg.witnesses) },
    { id: 'recursos', label: 'Outros recursos', count: count(agg.otherResources) },
    { id: 'acionamentos', label: 'Acionamentos', count: count(agg.notifications) },
    { id: 'anexos', label: 'Anexos', count: count(agg.attachments) },
    { id: 'historico', label: 'Histórico' },
    { id: 'contatos', label: 'Contatos' },
  ];

  const openTab = (t: string) => {
    setTab(t as TabId);
    window.setTimeout(() => document.getElementById(`tab-${t}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  };

  const makeReport = async () => {
    setReportBusy(true);
    try {
      const { openIncidentPdf } = await import('./report/incidentPdf');
      const url = await openIncidentPdf(buildReportModel(agg, catalog), actor.name);
      setReportUrl(url);
    } catch {
      toast.error('Não foi possível gerar o PDF', 'Tente novamente; nenhum dado foi alterado.');
    } finally {
      setReportBusy(false);
    }
  };

  const download = async () => {
    const { downloadIncidentPdf } = await import('./report/incidentPdf');
    await downloadIncidentPdf(buildReportModel(agg, catalog), actor.name);
  };

  const flowStatuses = STATUS_ORDER;
  const currentIdx = flowStatuses.indexOf(inc.status);

  return (
    <DetailContext.Provider value={{ agg, catalog, reload, writable }}>
      <PageHeader
        crumbs={[
          { label: 'Central', to: '/' },
          { label: 'Ocorrências', to: '/ocorrencias' },
          { label: inc.protocol },
        ]}
        title={<span className="sr-only">Ocorrência {inc.protocol}</span>}
      />
      {stale ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning" role="alert">Falha ao atualizar os dados; exibindo a última versão carregada.</Alert>
        </div>
      ) : null}
      <div className="stack">
        <section className="card" aria-label="Resumo da ocorrência">
          <div className="incident-hero">
            <div style={{ minWidth: 0 }}>
              <div className="row">
                <span className="incident-protocol" data-testid="detail-protocol">
                  {inc.protocol}
                </span>
                <StatusBadge status={inc.status} />
                <PriorityBadge priority={inc.priority} />
                <span className="badge tone-neutral">{inc.phase === 'REATIVA' ? 'Fase reativa' : 'Fase proativa'}</span>
              </div>
              <h1 className="incident-title">{cat?.name ?? 'Ocorrência sem categoria'}</h1>
              <div className="row subtle" style={{ gap: 12 }}>
                <span className="row" style={{ gap: 4 }}>
                  <Icon name="pin" size={14} /> {loc?.name ?? 'Local não informado'}
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <Icon name="clock" size={14} /> {formatDateTime(inc.callReceivedAtUTC)} ({formatRelative(inc.callReceivedAtUTC, now)})
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <Icon name="shield" size={14} /> {base?.name ?? 'Base a definir'}
                </span>
                {inc.hasVictims ? (
                  <span className="badge tone-critical">
                    <Icon name="activity" size={14} /> {inc.victimCount} vítima(s)
                  </span>
                ) : null}
              </div>
            </div>
            <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'flex-end' }}>
              {can('incident.report') ? (
                <Button icon="printer" onClick={makeReport} loading={reportBusy} loadingText="Gerando PDF…" data-testid="btn-report">
                  Relatório PDF
                </Button>
              ) : null}
              <StatusActions onOpenTab={openTab} />
            </div>
          </div>
          {inc.status !== 'CANCELADA' ? (
            <div style={{ padding: '0 24px 20px' }}>
              <div className="stepper" aria-label="Etapas do atendimento">
                {flowStatuses.map((s, i) => {
                  const cls = i < currentIdx ? 'done' : i === currentIdx ? 'current' : '';
                  const at = statusTimes.get(s);
                  return (
                    <div key={s} className={`step ${cls}`} aria-current={i === currentIdx ? 'step' : undefined}>
                      <div className="step-bar" />
                      <span className="step-label">{STATUS_LABEL[s]}</span>
                      <span className="step-time">{at && i <= currentIdx ? formatDateTime(at).slice(11) : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        {inc.status === 'RASCUNHO' ? (
          <Alert tone="warning" title="RASCUNHO — ainda não é uma ocorrência registrada" role="status">
            Complete os dados obrigatórios e use “Registrar ocorrência”. Rascunhos não entram nos indicadores nem na fila ativa.
          </Alert>
        ) : null}
        {inc.status === 'CANCELADA' ? (
          <Alert tone="critical" title={`Cancelada em ${formatDateTime(inc.closedAtUTC)}`}>
            {inc.cancelReason}
          </Alert>
        ) : null}
        {inc.status === 'ENCERRADA' ? (
          <Alert tone="success" title={`Encerrada em ${formatDateTime(inc.closedAtUTC)}`}>
            {can('incident.correctClosed') ? 'Correções são permitidas com justificativa e ficam na trilha de auditoria.' : 'Somente leitura para o seu perfil.'}
          </Alert>
        ) : null}
        {!writable && inc.status !== 'ENCERRADA' && inc.status !== 'CANCELADA' ? (
          <Alert tone="info" title="Modo leitura">
            Seu perfil ({actor.role === 'INSPETOR' ? 'Inspetor' : 'Visualizador'}) consulta a ocorrência mas não registra recursos ou eventos.
          </Alert>
        ) : null}

        <div className="layout-main-side">
          <section className="card" aria-label="Detalhes operacionais" style={{ minWidth: 0 }}>
            <Tabs label="Seções da ocorrência" tabs={tabs} active={tab} onChange={setTab} />
            <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
              {tab === 'dados' ? <DataTab key={inc.rowVersion} /> : null}
              {tab === 'tempo' ? <TimeTab /> : null}
              {tab === 'viaturas' ? <VehiclesTab /> : null}
              {tab === 'efetivo' ? <PersonnelTab /> : null}
              {tab === 'vitimas' ? <VictimsTab /> : null}
              {tab === 'testemunhas' ? <WitnessesTab /> : null}
              {tab === 'recursos' ? <OtherResourcesTab /> : null}
              {tab === 'acionamentos' ? <NotificationsTab /> : null}
              {tab === 'anexos' ? <AttachmentsTab /> : null}
              {tab === 'historico' ? <HistoryTab /> : null}
              {tab === 'contatos' ? <ContactsList /> : null}
            </div>
          </section>

          <aside className="stack" aria-label="Painel lateral">
            <Card title="Tempos" icon="clock" subtitle="Definições parametrizáveis (exemplos)" bodyClass="tight">
              {chronology.length ? (
                <div style={{ marginBottom: 12 }}>
                  <Alert tone="critical" title="Cronologia inconsistente">
                    {chronology[0]?.message}
                  </Alert>
                </div>
              ) : null}
              <ul className="list" data-testid="durations">
                {durations.map((d) => (
                  <li key={d.definition.id} className="list-item" title={d.definition.description}>
                    <div className="grow">
                      <div className="item-title">{d.definition.label}</div>
                      <div className="item-sub">{d.definition.targetMinutes !== null ? `Meta de exemplo: ${d.definition.targetMinutes} min` : 'Sem meta definida'}</div>
                    </div>
                    <span className={`badge ${d.status === 'OK' ? 'tone-success' : d.status === 'ACIMA_META' ? 'tone-warning' : d.status === 'INCONSISTENTE' ? 'tone-critical' : 'tone-muted'}`}>
                      {d.status === 'SEM_DADOS' ? 'Sem dados' : formatDuration(d.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            {cat ? (
              <Card title="Orientações" icon="clipboard" subtitle={`${cat.name} · exemplos configuráveis`} bodyClass="tight">
                <div className="guidance">
                  <ol style={{ marginTop: 0 }}>
                    {cat.guidance.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ol>
                </div>
                <p className="subtle" style={{ marginTop: 8 }}>
                  Não substituem planos formais aprovados.
                </p>
              </Card>
            ) : null}
            <Card title="Localização" icon="map" bodyClass="tight">
              <SchematicMap catalog={catalog} markers={[incidentMarker(inc)]} highlightLocationId={inc.locationId} compact />
            </Card>
          </aside>
        </div>
      </div>

      <Dialog
        open={Boolean(reportUrl)}
        onClose={() => setReportUrl(null)}
        wide
        title={`Relatório ${inc.protocol}`}
        description="Pré-visualização do PDF (documento de demonstração, dados fictícios)."
        footer={
          <>
            <Button onClick={() => setReportUrl(null)}>Fechar</Button>
            <Button variant="primary" icon="download" onClick={download} data-testid="btn-download-pdf">
              Baixar PDF
            </Button>
          </>
        }
      >
        {reportUrl ? <iframe title={`Relatório ${inc.protocol}`} src={reportUrl} style={{ width: '100%', height: '65vh', border: '1px solid var(--line)', borderRadius: 8 }} data-testid="pdf-preview" /> : null}
      </Dialog>
    </DetailContext.Provider>
  );
}
