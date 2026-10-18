import { useMemo, useState } from 'react';
import { useRepoQuery, useSession } from '../../app/services';
import { Link } from '../../app/router';
import { PageHeader, Card } from '../../ui/layout';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Alert, ForbiddenState, SkeletonBlock, ErrorState } from '../../ui/feedback';
import { SelectField } from '../../ui/fields';
import { toCsv, SCHEMA_VERSION } from '../../data/export/integration';
import { DATAVERSE_TABLES } from '../../data/dataverse/schema';
import { formatDateTime } from '../../domain/time';
import { isActive } from '../../domain/status';
import type { IntegrationExport } from '../../data/repository';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function IntegrationPage() {
  const { can, actor } = useSession();
  const allowed = can('integration.export');
  const exp = useRepoQuery((r) => (allowed ? r.exportIntegration(actor) : Promise.resolve(null as IntegrationExport | null)), [allowed, actor.userId]);
  const ds = useRepoQuery((r) => r.getOperationalDataset(), []);
  const [selected, setSelected] = useState('');

  const recent = useMemo(
    () => (ds.data?.incidents ?? []).filter((i) => i.source === 'SIRE_APP').sort((a, b) => Date.parse(b.createdAtUTC) - Date.parse(a.createdAtUTC)),
    [ds.data],
  );
  const latest = recent[0];
  const chosenId = selected || latest?.id || '';
  const fato = exp.data?.tables.find((t) => t.name === 'FatoOcorrencia')?.rows.find((r) => r.ocorrencia_id === chosenId);
  const marcos = exp.data?.tables.find((t) => t.name === 'FatoMarcoTempo')?.rows.filter((r) => r.ocorrencia_id === chosenId) ?? [];

  const steps = [
    { n: '01', title: 'Registro no app', text: latest ? `Último criado: ${latest.protocol} (${formatDateTime(latest.createdAtUTC)})` : 'Crie um chamado em “Novo chamado”.', done: Boolean(latest) },
    { n: '02', title: 'Persistência', text: 'Demo: armazenamento local do navegador (MockRepository). Produção: tabelas Dataverse sire_*.', done: Boolean(latest) },
    { n: '03', title: 'App atualizado', text: latest ? `Visível na fila e nos indicadores (${ds.data?.incidents.filter((i) => isActive(i.status)).length ?? 0} ativas).` : 'Aparece na fila assim que gravado.', done: Boolean(latest) },
    { n: '04', title: 'Registro de integração', text: 'Linha “achatada” no contrato de BI (fatos + dimensões), exportável em CSV/JSON.', done: Boolean(fato) },
    { n: '05', title: 'Power BI (futuro)', text: 'O relatório existente se conectará ao Dataverse. Ainda NÃO integrado.', done: false, future: true },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Central', to: '/' }, { label: 'Integração Power BI' }]}
        title="Cadeia de dados e integração"
        description="Como um registro sai do aplicativo e fica pronto para o Power BI gerencial já existente — sem alterar o relatório e sem usar o Power BI como base transacional."
      />
      <div className="stack">
        <Card title="Cadeia de dados" icon="link" subtitle="Power Apps → Dataverse (registro persistido) → Power BI conectado à origem">
          <div className="chain" data-testid="data-chain">
            {steps.map((s) => (
              <div key={s.n} className={`chain-step ${s.done ? 'done' : ''} ${s.future ? 'future' : ''}`}>
                <div className="chain-num">ETAPA {s.n}</div>
                <div className="row" style={{ gap: 6, margin: '4px 0' }}>
                  <Icon name={s.done ? 'checkCircle' : s.future ? 'clock' : 'info'} size={16} />
                  <strong>{s.title}</strong>
                </div>
                <div className="subtle">{s.text}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Alert tone="info" title="Atualização no Power BI — expectativa realista">
              Uma gravação aparece imediatamente nas telas do app. No Power BI, a latência depende do modo de conexão: em <strong>Importação</strong>, só após atualizar o modelo semântico; em <strong>DirectQuery</strong> ao Dataverse com atualização automática de página, o intervalo mínimo depende da capacidade (compartilhada: 30 min; dedicada: definido pelo administrador). Detalhes em <span className="mono">docs/CONTRATO_POWER_BI.md</span>.
            </Alert>
          </div>
        </Card>

        {!allowed ? (
          <div className="card">
            <ForbiddenState action="exportar dados de integração (Coordenador ou Administrador)" />
          </div>
        ) : exp.error && !exp.data ? (
          <ErrorState message={exp.error} onRetry={exp.reload} />
        ) : !exp.data ? (
          <div className="card card-body">
            <SkeletonBlock lines={8} />
          </div>
        ) : (
          <>
            <Card
              title="Inspecionar registro de integração"
              icon="eye"
              subtitle="Selecione uma ocorrência criada nesta demonstração para ver a linha que o BI consumirá."
            >
              {recent.length === 0 ? (
                <Alert tone="info">
                  Nenhuma ocorrência criada pelo app ainda. <Link to="/ocorrencias/nova">Registre um chamado</Link> e volte aqui para ver a cadeia completa.
                </Alert>
              ) : (
                <div className="stack">
                  <SelectField
                    label="Ocorrência"
                    value={chosenId}
                    onChange={(e) => setSelected(e.target.value)}
                    options={recent.map((i) => ({ value: i.id, label: `${i.protocol} · ${i.title}` }))}
                  />
                  <div className="grid grid-2">
                    <div>
                      <h3 className="section-title">FatoOcorrencia (1 linha)</h3>
                      <pre className="code-block" data-testid="integration-row">{JSON.stringify(fato ?? {}, null, 2)}</pre>
                    </div>
                    <div>
                      <h3 className="section-title">FatoMarcoTempo ({marcos.length} linha(s))</h3>
                      <pre className="code-block">{JSON.stringify(marcos, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card
              title="Tabelas do contrato"
              icon="database"
              subtitle={`Versão do esquema ${SCHEMA_VERSION} · gerado em ${formatDateTime(exp.data.generatedAtUTC)}`}
              actions={
                <Button icon="download" onClick={() => download(`sire_integracao_${SCHEMA_VERSION}.json`, JSON.stringify(exp.data, null, 2), 'application/json')}>
                  Baixar tudo (JSON)
                </Button>
              }
              bodyClass="tight"
            >
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">Tabelas exportáveis</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tabela (BI)</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Linhas</th>
                      <th scope="col">Origem Dataverse proposta</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {exp.data.tables.map((t) => (
                      <tr key={t.name}>
                        <td className="mono">{t.name}</td>
                        <td>
                          <span className={`badge ${t.kind === 'fato' ? 'tone-info' : t.kind === 'dimensao' ? 'tone-neutral' : t.kind === 'ponte' ? 'tone-muted' : 'tone-warning'}`}>{t.kind}</span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{t.rows.length}</td>
                        <td className="mono subtle">{originOf(t.name)}</td>
                        <td>
                          <Button size="sm" icon="download" onClick={() => download(`${t.name}.csv`, toCsv(t.rows), 'text/csv;charset=utf-8')}>
                            CSV
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function originOf(table: string): string {
  const map: Record<string, string> = {
    FatoOcorrencia: DATAVERSE_TABLES.Incident,
    FatoHistoricoStatus: DATAVERSE_TABLES.IncidentStatusHistory,
    FatoMarcoTempo: DATAVERSE_TABLES.IncidentMilestone,
    FatoAcionamento: DATAVERSE_TABLES.IncidentNotification,
    PonteOcorrenciaViatura: DATAVERSE_TABLES.IncidentVehicle,
    PonteOcorrenciaEfetivo: DATAVERSE_TABLES.IncidentPersonnel,
    FatoVitima: DATAVERSE_TABLES.IncidentVictim,
    DimCategoria: DATAVERSE_TABLES.IncidentCategory,
    DimArea: DATAVERSE_TABLES.Area,
    DimLocal: DATAVERSE_TABLES.Location,
    DimBase: DATAVERSE_TABLES.Base,
    DimEquipe: DATAVERSE_TABLES.Team,
    DimViatura: DATAVERSE_TABLES.Vehicle,
    DimOrgaoAcionamento: DATAVERSE_TABLES.NotificationTarget,
    DimDefinicaoTempo: DATAVERSE_TABLES.DurationDefinition,
    DimStatus: 'escolha global sire_incidentstatus',
    DimMarco: 'escolha global sire_milestonetype',
    Auditoria: DATAVERSE_TABLES.AuditLogEntry,
  };
  return map[table] ?? '—';
}
