import { useEffect, useState } from 'react';
import { useCatalog, useMutation, useRepo, useRepoQuery, useSession } from '../../app/services';
import { PageHeader, Card } from '../../ui/layout';
import { Button } from '../../ui/Button';
import { ConfirmationDialog } from '../../ui/Dialog';
import { Alert, ForbiddenState, PriorityBadge, SkeletonBlock } from '../../ui/feedback';
import { useToast } from '../../ui/Toast';
import { MockRepository } from '../../data/mock/MockRepository';
import { toUserMessage } from '../../data/errors';
import { detectPlatform, type PlatformInfo } from '../../platform/powerPlatform';
import { MILESTONE_LABEL } from '../../domain/milestones';
import { ALL_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from '../../domain/permissions';
import { formatDateTime } from '../../domain/time';
import { Icon } from '../../ui/Icon';

export function AdminPage() {
  const { can, actor } = useSession();
  const repo = useRepo();
  const toast = useToast();
  const catalog = useCatalog();
  const stats = useRepoQuery(async (r) => {
    const ds = await r.getOperationalDataset();
    return { incidents: ds.incidents.length, appCreated: ds.incidents.filter((i) => i.source === 'SIRE_APP').length, milestones: ds.milestones.length };
  }, []);
  const [confirmReset, setConfirmReset] = useState(false);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [outage, setOutage] = useState(repo instanceof MockRepository ? repo.simulatedOutage : false);

  useEffect(() => {
    let alive = true;
    void detectPlatform().then((p) => alive && setPlatform(p));
    return () => {
      alive = false;
    };
  }, []);

  const reset = useMutation(async () => {
    try {
      await repo.resetDemo(actor);
      toast.success('Demonstração reiniciada', 'Dados sintéticos recriados a partir do seed.');
      setConfirmReset(false);
    } catch (e) {
      toast.error('Não foi possível reiniciar', toUserMessage(e));
    }
  });

  const toggleOutage = () => {
    if (!(repo instanceof MockRepository)) return;
    repo.setSimulatedOutage(!outage);
    setOutage(!outage);
    toast.info(!outage ? 'Indisponibilidade simulada ATIVADA' : 'Indisponibilidade simulada desativada', !outage ? 'Gravações e leituras falharão até desativar.' : undefined);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Central', to: '/' }, { label: 'Administração' }]}
        title="Administração"
        description="Ambiente, perfis de demonstração e parametrizações. A edição completa das parametrizações chega na Etapa 3."
      />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card title="Ambiente de execução" icon="settings">
            <dl className="kv">
              <div>
                <dt>Host</dt>
                <dd>{platform ? (platform.host === 'power-apps' ? 'Power Apps (Code App)' : 'Execução local — fora do Power Apps') : 'Detectando…'}</dd>
              </div>
              <div>
                <dt>Fonte de dados</dt>
                <dd>{repo.kind === 'mock' ? 'MockRepository (navegador)' : 'Dataverse'}</dd>
              </div>
              <div>
                <dt>Publicação Power Apps</dt>
                <dd>Pendente (sem ambiente/credenciais)</dd>
              </div>
              <div>
                <dt>Power BI</dt>
                <dd>Integração futura — contrato pronto</dd>
              </div>
              <div>
                <dt>Registros na base</dt>
                <dd>{stats.data ? `${stats.data.incidents} ocorrências (${stats.data.appCreated} criadas no app)` : '…'}</dd>
              </div>
              <div>
                <dt>Usuário Power Platform</dt>
                <dd className={platform?.userName ? undefined : 'empty'}>{platform?.userName ?? 'Não disponível fora do host'}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Demonstração" icon="refresh">
            {!can('admin.reset') ? (
              <ForbiddenState action="reiniciar a demonstração ou simular falhas (apenas Administrador)" />
            ) : (
              <div className="stack">
                <div className="row-between">
                  <div>
                    <div className="item-title">Reiniciar demonstração</div>
                    <div className="item-sub">Apaga os registros locais e recria os dados sintéticos reproduzíveis (seed fixo).</div>
                  </div>
                  <Button variant="danger-outline" icon="refresh" onClick={() => setConfirmReset(true)} data-testid="btn-reset">
                    Reiniciar
                  </Button>
                </div>
                <hr className="divider" />
                <div className="row-between">
                  <div>
                    <div className="item-title">Simular indisponibilidade de dados</div>
                    <div className="item-sub">Exercita os estados de erro: nenhuma gravação é feita enquanto ativo.</div>
                  </div>
                  <Button variant={outage ? 'danger' : 'secondary'} icon="cloudOff" onClick={toggleOutage} aria-pressed={outage} data-testid="btn-outage">
                    {outage ? 'Desativar falha' : 'Ativar falha'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Perfis de demonstração" icon="users" subtitle="Login simulado — não é controle de acesso real">
            <ul className="list">
              {ALL_ROLES.map((r) => (
                <li key={r} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <Icon name={r === actor.role ? 'checkCircle' : 'user'} />
                  <div className="grow">
                    <div className="item-title">{ROLE_LABEL[r]}</div>
                    <div className="item-sub">{ROLE_DESCRIPTION[r]}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="subtle" style={{ marginTop: 8 }}>
              As permissões são verificadas na camada de dados (repositório), não só escondendo botões. Em produção, usar funções de segurança do Dataverse.
            </p>
          </Card>
        </div>

        <div className="stack">
          <Card title="Categorias e orientações" icon="clipboard" subtitle="Exemplos configuráveis — não são instruções operacionais validadas">
            {!catalog.data ? (
              <SkeletonBlock lines={6} />
            ) : (
              <ul className="list">
                {catalog.data.categories.map((c) => (
                  <li key={c.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <PriorityBadge priority={c.defaultPriority} />
                    <div className="grow">
                      <div className="item-title">{c.name}</div>
                      <div className="item-sub">
                        {c.suggestedResources.map((r) => `${r.quantity} ${r.label}`).join(' · ')}
                      </div>
                      <div className="item-sub">Exigido no encerramento: {c.requiredForClosure.length ? c.requiredForClosure.join(', ') : 'regras gerais'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Definições de tempo" icon="clock" subtitle="Parametrizáveis e documentadas (não presumidas)">
            {!catalog.data ? (
              <SkeletonBlock lines={5} />
            ) : (
              <ul className="list">
                {catalog.data.durations.map((d) => (
                  <li key={d.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="item-title">{d.label}</div>
                      <div className="item-sub">
                        {MILESTONE_LABEL[d.from]} → {MILESTONE_LABEL[d.to]} · {d.targetMinutes !== null ? `meta de exemplo ${d.targetMinutes} min` : 'sem meta'}
                      </div>
                      <div className="item-sub">{d.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Alert tone="info" title="Próxima etapa (3)">
            Edição de categorias, campos obrigatórios por categoria, órgãos de acionamento, bases, equipes, viaturas, turnos e modelos de relatório — com auditoria. Base atual gerada em {formatDateTime(new Date().toISOString()).slice(0, 10)}.
          </Alert>
        </div>
      </div>

      <ConfirmationDialog
        open={confirmReset}
        tone="danger"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void reset.run()}
        loading={reset.pending}
        title="Reiniciar a demonstração?"
        description="Todos os registros criados neste navegador serão substituídos pelos dados sintéticos originais. Esta ação não pode ser desfeita."
        confirmLabel="Reiniciar demonstração"
      />
    </>
  );
}
