import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog, Channel, Incident, IncidentInput, Priority } from '../../domain/types';
import { useCatalog, useMutation, useRepo, useSession } from '../../app/services';
import { navigate, Link } from '../../app/router';
import { PageHeader, Card } from '../../ui/layout';
import { Button } from '../../ui/Button';
import { SelectField, TextArea, TextField, YesNo, Field } from '../../ui/fields';
import { Alert, ForbiddenState, PriorityBadge, SkeletonBlock, ValidationSummary, ErrorState } from '../../ui/feedback';
import { Icon } from '../../ui/Icon';
import { SchematicMap } from '../../ui/SchematicMap';
import { useToast } from '../../ui/Toast';
import { Dialog } from '../../ui/Dialog';
import { uuid } from '../../domain/ids';
import { fromLocalInputValue, toLocalInputValue, formatDateTime } from '../../domain/time';
import { validateIncidentInput, type FieldError, type SaveMode } from '../../domain/validation';
import { ValidationFailedError, toUserMessage } from '../../data/errors';
import { suggestBase } from './suggestions';

interface FormState {
  callReceivedLocal: string;
  channel: Channel;
  categoryId: string;
  priority: Priority;
  priorityTouched: boolean;
  description: string;
  areaId: string;
  locationId: string;
  reference: string;
  hasVictims: boolean | null;
  victimCount: string;
  victimConditionSummary: string;
  callerName: string;
  callerPhone: string;
  responsibleBaseId: string;
}

const emptyForm = (): FormState => ({
  callReceivedLocal: toLocalInputValue(new Date().toISOString()),
  channel: 'RAMAL_EMERGENCIA',
  categoryId: '',
  priority: 'P2',
  priorityTouched: false,
  description: '',
  areaId: '',
  locationId: '',
  reference: '',
  hasVictims: null,
  victimCount: '',
  victimConditionSummary: '',
  callerName: '',
  callerPhone: '',
  responsibleBaseId: '',
});

function toInput(f: FormState, catalog: Catalog): IncidentInput {
  const cat = catalog.categories.find((c) => c.id === f.categoryId);
  const sug = suggestBase(catalog, f.areaId || null, f.locationId || null);
  const count = f.victimCount.trim() === '' ? null : Number(f.victimCount);
  return {
    callReceivedAtUTC: fromLocalInputValue(f.callReceivedLocal) ?? 'invalida',
    channel: f.channel,
    categoryId: f.categoryId,
    priority: f.priority,
    phase: cat?.defaultPhase ?? 'REATIVA',
    title: '',
    description: f.description.trim(),
    callerName: f.callerName.trim(),
    callerPhone: f.callerPhone.trim(),
    hasVictims: f.hasVictims === true,
    victimCount: f.hasVictims ? (Number.isFinite(count) ? count : NaN) : null,
    victimConditionSummary: f.hasVictims ? f.victimConditionSummary.trim() : '',
    areaId: f.areaId || null,
    locationId: f.locationId || null,
    reference: f.reference.trim(),
    suggestedBaseId: sug?.base.id ?? null,
    responsibleBaseId: f.responsibleBaseId || null,
    teamId: null,
  };
}

export function NewIncidentPage() {
  const catalog = useCatalog();
  const { can } = useSession();
  if (!can('incident.create')) {
    return (
      <>
        <PageHeader title="Novo chamado" crumbs={[{ label: 'Central', to: '/' }, { label: 'Novo chamado' }]} />
        <div className="card">
          <ForbiddenState action="registrar chamados" />
        </div>
      </>
    );
  }
  if (catalog.error && !catalog.data) return <ErrorState message={catalog.error} onRetry={catalog.reload} />;
  if (!catalog.data) {
    return (
      <div className="card card-body">
        <SkeletonBlock lines={8} />
      </div>
    );
  }
  return <NewIncidentForm catalog={catalog.data} />;
}

function NewIncidentForm({ catalog }: { catalog: Catalog }) {
  const repo = useRepo();
  const { actor } = useSession();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [idempotencyKey, setIdempotencyKey] = useState(uuid);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [dirty, setDirty] = useState(false);
  const [created, setCreated] = useState<Incident | null>(null);
  const [pendingAction, setPendingAction] = useState<'draft' | 'register' | 'continue' | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  // Protege contra perda de dados ao fechar/recarregar a aba com o formulário preenchido.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const category = catalog.categories.find((c) => c.id === form.categoryId);
  const locations = catalog.locations.filter((l) => l.areaId === form.areaId);
  const suggestion = suggestBase(catalog, form.areaId || null, form.locationId || null);
  const errorOf = (field: string) => errors.find((e) => e.field === field)?.message;
  const targets = useMemo(
    () => (category?.suggestedTargets ?? []).map((id) => catalog.notificationTargets.find((t) => t.id === id)).filter(Boolean),
    [category, catalog.notificationTargets],
  );

  const pickCategory = (id: string) => {
    const cat = catalog.categories.find((c) => c.id === id);
    setForm((f) => ({ ...f, categoryId: id, priority: f.priorityTouched ? f.priority : cat?.defaultPriority ?? f.priority }));
    setDirty(true);
  };

  const save = useMutation(async (mode: SaveMode, after: 'stay' | 'open') => {
    const input = toInput(form, catalog);
    const clientErrors = validateIncidentInput(input, mode, catalog, new Date());
    if (mode === 'register' && form.hasVictims === null) {
      clientErrors.push({ field: 'hasVictims', message: 'Responda se há vítimas (Sim ou Não).' });
    }
    if (clientErrors.length) {
      setErrors(clientErrors);
      window.setTimeout(() => summaryRef.current?.querySelector<HTMLElement>('[data-testid="validation-summary"]')?.focus(), 0);
      return;
    }
    setErrors([]);
    try {
      const inc = await repo.createIncident(actor, input, { mode, idempotencyKey });
      setDirty(false);
      if (mode === 'draft') {
        toast.success(`Rascunho ${inc.protocol} salvo`, 'Ainda NÃO é uma ocorrência registrada.');
        navigate(`/ocorrencias/${inc.id}`);
      } else if (after === 'open') {
        toast.success(`Ocorrência ${inc.protocol} registrada`, 'Continue a triagem e o acionamento.');
        navigate(`/ocorrencias/${inc.id}`);
      } else {
        setCreated(inc);
      }
    } catch (e) {
      if (e instanceof ValidationFailedError) {
        setErrors(e.errors);
      } else {
        toast.error('Não foi possível gravar', toUserMessage(e));
      }
    }
  });

  const run = (action: 'draft' | 'register' | 'continue') => {
    setPendingAction(action);
    void save.run(action === 'draft' ? 'draft' : 'register', action === 'register' ? 'stay' : 'open').finally(() => setPendingAction(null));
  };

  const startNew = () => {
    setCreated(null);
    setForm(emptyForm());
    setIdempotencyKey(uuid());
    setErrors([]);
    setDirty(false);
    window.scrollTo({ top: 0 });
  };

  const markers = form.locationId ? [{ id: 'novo', locationId: form.locationId, label: 'Local informado', tone: 'critical' as const }] : [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Central', to: '/' }, { label: 'Novo chamado' }]}
        title="Novo chamado · Pré-atendimento"
        description="Protocolo de acionamento do Plano de Atendimento à Emergência (PAE). Campos com * são obrigatórios para registrar; o rascunho aceita o mínimo."
        meta={
          <div className="row subtle" style={{ marginTop: 8 }}>
            <Icon name="user" size={14} /> Operador: <strong>{actor.name}</strong>
            <span aria-hidden>·</span>
            <Icon name="clock" size={14} /> Data/hora preenchida automaticamente (editável)
          </div>
        }
      />
      <div ref={summaryRef} style={{ marginBottom: errors.length ? 16 : 0 }}>
        <ValidationSummary errors={errors} />
      </div>

      <form
        className="layout-main-side"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run('continue');
        }}
        aria-label="Formulário de novo chamado"
      >
        <div className="stack">
          <Card title="Qual é a emergência?" icon="siren" subtitle="Selecione a hipótese acidental — ela orienta prioridade, recursos e acionamentos sugeridos.">
            <div className="stack">
              <div data-anchor="categoryId">
                <div className="choice-grid" role="radiogroup" aria-label="O que aconteceu?" aria-invalid={Boolean(errorOf('categoryId')) || undefined} data-testid="category-grid">
                  {catalog.categories
                    .filter((c) => c.active)
                    .map((c) => (
                      <button key={c.id} type="button" role="radio" aria-checked={form.categoryId === c.id} className="choice" onClick={() => pickCategory(c.id)}>
                        <span className="choice-title">
                          {c.name}
                          <PriorityBadge priority={c.defaultPriority} />
                        </span>
                        <span className="choice-sub">{c.prompt}</span>
                      </button>
                    ))}
                </div>
                {errorOf('categoryId') ? (
                  <span className="field-error" role="alert" style={{ marginTop: 6 }}>
                    <Icon name="alert" size={14} />
                    {errorOf('categoryId')}
                  </span>
                ) : null}
              </div>
              <div className="form-grid">
                <div className="col-4" data-anchor="priority">
                  <Field label="Prioridade" required hint={form.priorityTouched ? 'Definida pelo operador' : 'Sugerida pela categoria — ajuste se necessário'}>
                    {({ id }) => (
                      <div className="segmented" role="radiogroup" aria-labelledby={id} id={id}>
                        {catalog.priorities.map((p) => (
                          <button
                            key={p.code}
                            type="button"
                            role="radio"
                            aria-checked={form.priority === p.code}
                            title={p.description}
                            onClick={() => setForm((f) => ({ ...f, priority: p.code, priorityTouched: true }))}
                          >
                            {p.code}
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>
                <div className="col-4" data-anchor="channel">
                  <SelectField
                    label="Canal de entrada"
                    required
                    value={form.channel}
                    onChange={(e) => set('channel', e.target.value as Channel)}
                    options={catalog.channels.map((c) => ({ value: c.code, label: c.label }))}
                    error={errorOf('channel')}
                  />
                </div>
                <div className="col-4" data-anchor="callReceivedAtUTC">
                  <TextField
                    label="Data/hora do chamado"
                    required
                    type="datetime-local"
                    value={form.callReceivedLocal}
                    onChange={(e) => set('callReceivedLocal', e.target.value)}
                    error={errorOf('callReceivedAtUTC')}
                    hint="Horário de Brasília (America/Sao_Paulo)"
                  />
                </div>
                <div className="col-12" data-anchor="description">
                  <TextArea
                    label="Descrição do incidente"
                    required
                    placeholder="Relato do solicitante: o que está acontecendo, há fogo/fumaça, produto, pessoas na área…"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    error={errorOf('description')}
                    maxLength={2000}
                    hint={`${form.description.trim().length}/2000 · mínimo 10 caracteres`}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Dados de localidade" icon="pin">
            <div className="form-grid">
              <div className="col-6" data-anchor="areaId">
                <SelectField
                  label="Macroárea"
                  required
                  placeholder="Selecione a macroárea"
                  value={form.areaId}
                  onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value, locationId: '', responsibleBaseId: '' }))}
                  options={catalog.areas.map((a) => ({ value: a.id, label: a.name }))}
                  error={errorOf('areaId')}
                />
              </div>
              <div className="col-6" data-anchor="locationId">
                <SelectField
                  label="Local da ocorrência"
                  required
                  placeholder={form.areaId ? 'Selecione o local' : 'Escolha a macroárea primeiro'}
                  disabled={!form.areaId}
                  value={form.locationId}
                  onChange={(e) => set('locationId', e.target.value)}
                  options={locations.map((l) => ({ value: l.id, label: l.point ? l.name : `${l.name} (sem posição no mapa)` }))}
                  error={errorOf('locationId')}
                />
              </div>
              <div className="col-12">
                <TextField label="Ponto de referência" optional value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Ex.: em frente à sala de controle, lado do portão 3" maxLength={200} />
              </div>
              <div className="col-12">
                <div className="resource-row" data-testid="base-suggestion">
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <Icon name="shield" />
                      <strong>Base sugerida:</strong> {suggestion ? suggestion.base.name : form.areaId ? 'Sem sugestão — defina na triagem' : 'Aguardando o local'}
                    </div>
                    <div className="subtle">{suggestion ? `${suggestion.reason}. Sugestão ilustrativa — requer confirmação humana.` : form.areaId ? 'Macroárea sem base preferencial e local sem posição na planta.' : 'Selecione a macroárea e o local para ver a base sugerida (ilustrativa).'}</div>
                  </div>
                  {suggestion ? (
                    form.responsibleBaseId === suggestion.base.id ? (
                      <span className="badge tone-success">
                        <Icon name="check" size={14} /> Confirmada
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => set('responsibleBaseId', suggestion.base.id)}>
                        Confirmar como responsável
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-2">
            <Card title="Dados da vítima" icon="activity">
              <div className="stack">
                <div data-anchor="hasVictims">
                  <YesNo
                    name="hasVictims"
                    label="Há vítimas?"
                    required
                    error={errorOf('hasVictims')}
                    value={form.hasVictims}
                    danger
                    onChange={(v) => setForm((f) => ({ ...f, hasVictims: v, victimCount: v ? f.victimCount || '1' : '', victimConditionSummary: v ? f.victimConditionSummary : '' }))}
                  />
                </div>
                {form.hasVictims ? (
                  <>
                    <div data-anchor="victimCount">
                      <TextField
                        label="Quantas?"
                        required
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={500}
                        value={form.victimCount}
                        onChange={(e) => set('victimCount', e.target.value)}
                        error={errorOf('victimCount')}
                      />
                    </div>
                    <div data-anchor="victimConditionSummary">
                      <TextArea
                        label="Estado da(s) vítima(s)"
                        required
                        rows={3}
                        value={form.victimConditionSummary}
                        onChange={(e) => set('victimConditionSummary', e.target.value)}
                        error={errorOf('victimConditionSummary')}
                        placeholder="Consciente? Respira? Sangramento?"
                        hint="Não registre nomes: o detalhamento usa pseudônimos (minimização de dados)."
                      />
                    </div>
                  </>
                ) : (
                  <p className="subtle">{form.hasVictims === false ? 'Sem vítimas informadas.' : 'Pergunte ao solicitante se há pessoas feridas.'}</p>
                )}
              </div>
            </Card>
            <Card title="Solicitante / denunciante" icon="phone">
              <div className="stack">
                <div data-anchor="callerName">
                  <TextField
                    label="Nome completo"
                    required
                    value={form.callerName}
                    onChange={(e) => set('callerName', e.target.value)}
                    error={errorOf('callerName')}
                    placeholder="Nome ou função de quem ligou"
                    maxLength={120}
                  />
                  <button type="button" className="link" style={{ fontSize: 13, marginTop: 6 }} onClick={() => set('callerName', 'Não identificado')}>
                    Solicitante não se identificou
                  </button>
                </div>
                <div data-anchor="callerPhone">
                  <TextField
                    label="Telefone"
                    optional
                    type="tel"
                    inputMode="tel"
                    value={form.callerPhone}
                    onChange={(e) => set('callerPhone', e.target.value)}
                    error={errorOf('callerPhone')}
                    placeholder="(00) 90000-0000"
                    hint="Dado sintético na demo. Nenhuma ligação é feita pelo sistema."
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="form-actions" role="group" aria-label="Ações do chamado">
            <span className="subtle status-text" aria-live="polite">
              {save.pending
                ? 'Gravando…'
                : dirty
                  ? 'Alterações ainda não gravadas'
                  : 'Nenhuma alteração'}
            </span>
            <Button onClick={() => run('draft')} loading={pendingAction === 'draft'} loadingText="Salvando…" disabled={save.pending} icon="note" data-testid="btn-draft">
              Salvar rascunho
            </Button>
            <Button variant="secondary" onClick={() => run('register')} loading={pendingAction === 'register'} loadingText="Registrando…" disabled={save.pending} icon="check" data-testid="btn-register">
              Registrar ocorrência
            </Button>
            <Button variant="primary" type="submit" loading={pendingAction === 'continue'} loadingText="Registrando…" disabled={save.pending} iconRight="arrowRight" data-testid="btn-register-continue">
              Registrar e continuar
            </Button>
          </div>
        </div>

        <aside className="stack" aria-label="Suporte à triagem">
          <Card title="Suporte à triagem" icon="clipboard" subtitle="Sugestões configuráveis — nada é executado sem confirmação humana.">
            {category ? (
              <div className="stack">
                <div className="guidance" data-testid="guidance">
                  <strong>Orientações · {category.name}</strong>
                  <ol>
                    {category.guidance.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ol>
                  <div className="subtle" style={{ marginTop: 8 }}>
                    Exemplos configuráveis, não instruções operacionais validadas.
                  </div>
                </div>
                <div>
                  <h3 className="section-title">Recursos sugeridos</h3>
                  <div className="suggest-list">
                    {category.suggestedResources.map((r) => (
                      <div key={r.label} className="suggest-item">
                        <span className="qty">{String(r.quantity).padStart(2, '0')}</span>
                        <Icon name={r.kind === 'VIATURA' ? 'truck' : 'users'} size={16} />
                        <span>{r.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="section-title">Acionamentos sugeridos</h3>
                  <div className="chip-row">
                    {targets.map((t) => (
                      <span key={t?.id} className="badge tone-info">
                        {t?.name}
                      </span>
                    ))}
                  </div>
                  <p className="subtle" style={{ marginTop: 8 }}>
                    Horários de acionamento são registrados na ocorrência (simulado — sem envio de mensagens).
                  </p>
                </div>
              </div>
            ) : (
              <p className="muted">Selecione “Qual é a emergência?” para ver orientações, recursos e acionamentos sugeridos.</p>
            )}
          </Card>
          <Card title="Localização" icon="map">
            <SchematicMap catalog={catalog} markers={markers} highlightLocationId={form.locationId || null} compact />
          </Card>
        </aside>
      </form>

      <Dialog
        open={Boolean(created)}
        onClose={startNew}
        title="Ocorrência registrada"
        description="O registro foi gravado e já aparece na lista e nos indicadores da central."
        icon={
          <div className="empty-icon" style={{ width: 40, height: 40, margin: 0, background: 'var(--success-50)', color: 'var(--success-700)' }}>
            <Icon name="checkCircle" />
          </div>
        }
        footer={
          <>
            <Button onClick={startNew} icon="plus">
              Novo chamado
            </Button>
            <Button variant="primary" iconRight="arrowRight" onClick={() => created && navigate(`/ocorrencias/${created.id}`)} data-autofocus>
              Abrir ocorrência
            </Button>
          </>
        }
      >
        {created ? (
          <div className="stack-sm" data-testid="created-confirmation">
            <div className="row">
              <span className="incident-protocol" style={{ fontSize: 18 }} data-testid="created-protocol">
                {created.protocol}
              </span>
              <PriorityBadge priority={created.priority} />
            </div>
            <div>{created.title}</div>
            <div className="subtle">
              Chamado às {formatDateTime(created.callReceivedAtUTC)} · ID <span className="mono">{created.id}</span>
            </div>
            <Alert tone="info">
              Próximo passo: triagem e confirmação do acionamento. <Link to={`/ocorrencias/${created.id}`}>Ir para a ocorrência</Link>
            </Alert>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
