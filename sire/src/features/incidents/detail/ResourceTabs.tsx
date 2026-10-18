import { useMemo, useState, type ReactNode } from 'react';
import type { ChildKind } from '../../../data/repository';
import type { IncidentOtherResource, VictimBond, VictimCondition, VictimDestination } from '../../../domain/types';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '../../../domain/time';
import type { FieldError } from '../../../domain/validation';
import { Button } from '../../../ui/Button';
import { SelectField, TextArea, TextField } from '../../../ui/fields';
import { Alert, EmptyState, ValidationSummary } from '../../../ui/feedback';
import { ConfirmationDialog } from '../../../ui/Dialog';
import { Icon, type IconName } from '../../../ui/Icon';
import { useDetail, useRepoAction } from './context';
import { OTHER_RESOURCE_LABEL, VICTIM_BOND_LABEL, VICTIM_CONDITION_LABEL, VICTIM_DESTINATION_LABEL } from '../../../domain/labels';

// ---------------------------------------------------------------- utilitários

function RemoveButton({ kind, id, label }: { kind: ChildKind; id: string; label: string }) {
  const { agg } = useDetail();
  const { act, pending } = useRepoAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const confirm = async () => {
    const ok = await act((repo, a) => repo.removeChild(a, agg.incident.id, kind, id, reason), { success: 'Registro removido (mantido na auditoria)' });
    if (ok) {
      setOpen(false);
      setReason('');
    }
  };
  return (
    <>
      <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Remover ${label}`} onClick={() => setOpen(true)} />
      <ConfirmationDialog
        open={open}
        tone="danger"
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={pending}
        confirmDisabled={reason.trim().length < 5}
        title={`Remover ${label}?`}
        description="Exclusão lógica: o registro sai das contagens, mas permanece na auditoria."
        confirmLabel="Remover"
      >
        <TextArea label="Motivo" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="Mínimo 5 caracteres" data-autofocus />
      </ConfirmationDialog>
    </>
  );
}

function Row({ icon, title, sub, right, kind, id, removeLabel }: { icon: IconName; title: ReactNode; sub?: ReactNode; right?: ReactNode; kind: ChildKind; id: string; removeLabel: string }) {
  const { writable } = useDetail();
  return (
    <div className="resource-row">
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <span className="empty-icon" style={{ width: 36, height: 36, margin: 0, flex: 'none' }}>
          <Icon name={icon} size={18} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="item-title">{title}</div>
          {sub ? <div className="item-sub">{sub}</div> : null}
        </div>
      </div>
      <div className="row">
        {right}
        {writable ? <RemoveButton kind={kind} id={id} label={removeLabel} /> : null}
      </div>
    </div>
  );
}

function AddForm({ children, onSubmit, pending, label, errors }: { children: ReactNode; onSubmit: () => void; pending: boolean; label: string; errors: FieldError[] }) {
  const { writable } = useDetail();
  if (!writable) return null;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      aria-label={label}
    >
      <ValidationSummary errors={errors} title="Não foi possível adicionar" />
      <div className="inline-form" style={{ marginTop: errors.length ? 12 : 0 }}>
        {children}
        <Button type="submit" variant="primary" icon="plus" loading={pending} loadingText="Adicionando…">
          Adicionar
        </Button>
      </div>
    </form>
  );
}

const active = <T extends { isDeleted: boolean }>(rows: T[]) => rows.filter((r) => !r.isDeleted);

// ---------------------------------------------------------------- Viaturas

export function VehiclesTab() {
  const { agg, catalog } = useDetail();
  const { act, pending } = useRepoAction();
  const [vehicleId, setVehicleId] = useState('');
  const [kmStart, setKmStart] = useState('');
  const [kmEnd, setKmEnd] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const rows = active(agg.vehicles);
  const linked = new Set(rows.map((r) => r.vehicleId));
  const submit = async () => {
    setErrors([]);
    const ok = await act(
      (repo, a) => repo.addChild(a, agg.incident.id, { kind: 'vehicle', vehicleId, kmStart: kmStart ? Number(kmStart) : null, kmEnd: kmEnd ? Number(kmEnd) : null }),
      { success: 'Viatura vinculada', onFieldErrors: setErrors },
    );
    if (ok) {
      setVehicleId('');
      setKmStart('');
      setKmEnd('');
    }
  };
  return (
    <div className="stack">
      <AddForm onSubmit={submit} pending={pending} label="Vincular viatura" errors={errors}>
        <SelectField
          label="Viatura"
          required
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          placeholder="Selecione"
          options={catalog.vehicles.filter((v) => v.active).map((v) => ({ value: v.id, label: `${v.code} · ${v.description}`, disabled: linked.has(v.id) }))}
        />
        <TextField label="Km inicial" optional type="number" min={0} value={kmStart} onChange={(e) => setKmStart(e.target.value)} />
        <TextField label="Km final" optional type="number" min={0} value={kmEnd} onChange={(e) => setKmEnd(e.target.value)} />
      </AddForm>
      {rows.length === 0 ? (
        <EmptyState icon="truck" title="Nenhuma viatura vinculada">Vincule as viaturas empenhadas para compor o relatório e os indicadores.</EmptyState>
      ) : (
        <div>
          {rows.map((r) => {
            const v = catalog.vehicles.find((x) => x.id === r.vehicleId);
            const base = catalog.bases.find((b) => b.id === v?.baseId);
            const km = r.kmStart !== null && r.kmEnd !== null ? `${(r.kmEnd - r.kmStart).toLocaleString('pt-BR')} km rodados` : 'Km incompleto';
            return (
              <Row
                key={r.id}
                kind="vehicle"
                id={r.id}
                removeLabel={`viatura ${v?.code}`}
                icon="truck"
                title={`${v?.code ?? '?'} · ${v?.description ?? 'Viatura'}`}
                sub={`Placa ${v?.plate} (fictícia) · ${base?.name ?? 'Base ?'} · ${v?.waterTankL ? `água ${v.waterTankL} L` : 'sem tanque'}`}
                right={<span className="subtle nowrap">{r.kmStart ?? '—'} → {r.kmEnd ?? '—'} · {km}</span>}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Efetivo

export function PersonnelTab() {
  const { agg, catalog } = useDetail();
  const { act, pending } = useRepoAction();
  const [personId, setPersonId] = useState('');
  const [fn, setFn] = useState('Combatente / socorrista');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const rows = active(agg.personnel);
  const included = new Set(rows.map((r) => r.personId));
  const baseFirst = useMemo(
    () => [...catalog.people].sort((a, b) => Number(b.baseId === agg.incident.responsibleBaseId) - Number(a.baseId === agg.incident.responsibleBaseId) || a.name.localeCompare(b.name)),
    [catalog.people, agg.incident.responsibleBaseId],
  );
  const submit = async () => {
    setErrors([]);
    const ok = await act((repo, a) => repo.addChild(a, agg.incident.id, { kind: 'personnel', personId, functionInIncident: fn }), { success: 'Efetivo atualizado', onFieldErrors: setErrors });
    if (ok) setPersonId('');
  };
  return (
    <div className="stack">
      <AddForm onSubmit={submit} pending={pending} label="Incluir efetivo" errors={errors}>
        <SelectField
          label="Pessoa (fictícia)"
          required
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          placeholder="Selecione"
          options={baseFirst.map((p) => ({ value: p.id, label: `${p.name} · ${p.jobTitle}${p.baseId === agg.incident.responsibleBaseId ? ' (base resp.)' : ''}`, disabled: included.has(p.id) }))}
        />
        <SelectField
          label="Função na ocorrência"
          value={fn}
          onChange={(e) => setFn(e.target.value)}
          options={['Líder de equipe', 'Combatente / socorrista', 'Motorista operador', 'Resgatista', 'Apoio'].map((x) => ({ value: x, label: x }))}
        />
      </AddForm>
      {rows.length === 0 ? (
        <EmptyState icon="users" title="Efetivo não registrado">Inclua as pessoas empenhadas no atendimento.</EmptyState>
      ) : (
        rows.map((r) => {
          const p = catalog.people.find((x) => x.id === r.personId);
          return <Row key={r.id} kind="personnel" id={r.id} removeLabel={p?.name ?? 'pessoa'} icon="user" title={p?.name ?? '?'} sub={`${r.functionInIncident} · ${p?.jobTitle}`} />;
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Vítimas

const CONDITION = VICTIM_CONDITION_LABEL;
const DESTINATION = VICTIM_DESTINATION_LABEL;
const BOND = VICTIM_BOND_LABEL;

export function VictimsTab() {
  const { agg } = useDetail();
  const { act, pending } = useRepoAction();
  const rows = active(agg.victims);
  const [pseudonym, setPseudonym] = useState(`Vítima ${rows.length + 1}`);
  const [condition, setCondition] = useState<VictimCondition>('CONSCIENTE');
  const [destination, setDestination] = useState<VictimDestination>('ATENDIDA_NO_LOCAL');
  const [bond, setBond] = useState<VictimBond>('PROPRIO');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const inc = agg.incident;
  const submit = async () => {
    setErrors([]);
    const ok = await act((repo, a) => repo.addChild(a, inc.id, { kind: 'victim', data: { pseudonym, condition, destination, bond, notes } }), { success: 'Vítima detalhada', onFieldErrors: setErrors });
    if (ok) {
      setPseudonym(`Vítima ${rows.length + 2}`);
      setNotes('');
    }
  };
  return (
    <div className="stack">
      <Alert tone="info">Minimização de dados: identifique vítimas por pseudônimo. Dados pessoais e de saúde não são registrados na demo.</Alert>
      {!inc.hasVictims ? (
        <Alert tone="warning" title='"Há vítimas?" está marcado como Não'>Altere na aba Dados para detalhar vítimas.</Alert>
      ) : (
        <>
          <div className="row">
            <span className={`badge ${rows.length === inc.victimCount ? 'tone-success' : 'tone-warning'}`}>
              {rows.length} de {inc.victimCount ?? 0} vítima(s) detalhada(s)
            </span>
          </div>
          <AddForm onSubmit={submit} pending={pending} label="Detalhar vítima" errors={errors}>
            <TextField label="Pseudônimo" required value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} maxLength={40} />
            <SelectField label="Condição" value={condition} onChange={(e) => setCondition(e.target.value as VictimCondition)} options={Object.entries(CONDITION).map(([value, label]) => ({ value, label }))} />
            <SelectField label="Destino" value={destination} onChange={(e) => setDestination(e.target.value as VictimDestination)} options={Object.entries(DESTINATION).map(([value, label]) => ({ value, label }))} />
            <SelectField label="Vínculo" value={bond} onChange={(e) => setBond(e.target.value as VictimBond)} options={Object.entries(BOND).map(([value, label]) => ({ value, label }))} />
            <TextField label="Observações" optional value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
          </AddForm>
        </>
      )}
      {rows.length === 0 ? (
        <EmptyState icon="activity" title="Nenhuma vítima detalhada" />
      ) : (
        rows.map((v) => (
          <Row
            key={v.id}
            kind="victim"
            id={v.id}
            removeLabel={v.pseudonym}
            icon="activity"
            title={v.pseudonym}
            sub={`${CONDITION[v.condition]} · ${DESTINATION[v.destination]} · ${BOND[v.bond]}${v.notes ? ` · ${v.notes}` : ''}`}
          />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Testemunhas

export function WitnessesTab() {
  const { agg } = useDetail();
  const { act, pending } = useRepoAction();
  const [name, setName] = useState('');
  const [statement, setStatement] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const rows = active(agg.witnesses);
  const submit = async () => {
    setErrors([]);
    const ok = await act((repo, a) => repo.addChild(a, agg.incident.id, { kind: 'witness', name, statement, takenAtUTC: new Date().toISOString() }), {
      success: 'Depoimento registrado',
      onFieldErrors: setErrors,
    });
    if (ok) {
      setName('');
      setStatement('');
    }
  };
  return (
    <div className="stack">
      <AddForm onSubmit={submit} pending={pending} label="Registrar depoimento" errors={errors}>
        <TextField label="Testemunha (nome fictício)" required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <div style={{ gridColumn: '1 / -1' }}>
          <TextArea label="Depoimento" required rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} hint="Mínimo 10 caracteres" maxLength={2000} />
        </div>
      </AddForm>
      {rows.length === 0 ? (
        <EmptyState icon="note" title="Nenhum depoimento registrado" />
      ) : (
        rows.map((w) => (
          <Row key={w.id} kind="witness" id={w.id} removeLabel={`depoimento de ${w.name}`} icon="note" title={w.name} sub={<span style={{ whiteSpace: 'pre-wrap' }}>{`${formatDateTime(w.takenAtUTC)} — ${w.statement}`}</span>} />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Outros recursos

const OTHER_CAT = OTHER_RESOURCE_LABEL;

export function OtherResourcesTab() {
  const { agg } = useDetail();
  const { act, pending } = useRepoAction();
  const [category, setCategory] = useState<IncidentOtherResource['category']>('COMBATE');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const rows = active(agg.otherResources);
  const submit = async () => {
    setErrors([]);
    const ok = await act((repo, a) => repo.addChild(a, agg.incident.id, { kind: 'otherResource', data: { category, description, quantity: Number(quantity) } }), {
      success: 'Recurso registrado',
      onFieldErrors: setErrors,
    });
    if (ok) {
      setDescription('');
      setQuantity('1');
    }
  };
  return (
    <div className="stack">
      <AddForm onSubmit={submit} pending={pending} label="Registrar outro recurso" errors={errors}>
        <SelectField label="Categoria" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} options={Object.entries(OTHER_CAT).map(([value, label]) => ({ value, label }))} />
        <TextField label="Descrição" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: abafadores, bomba costal, tripé de resgate" maxLength={120} />
        <TextField label="Quantidade" required type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </AddForm>
      {rows.length === 0 ? (
        <EmptyState icon="layers" title="Nenhum outro recurso registrado" />
      ) : (
        rows.map((r) => <Row key={r.id} kind="otherResource" id={r.id} removeLabel={r.description} icon="layers" title={`${r.quantity} × ${r.description}`} sub={OTHER_CAT[r.category]} />)
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Acionamentos

export function NotificationsTab() {
  const { agg, catalog, writable } = useDetail();
  const { act, pending } = useRepoAction();
  const inc = agg.incident;
  const cat = catalog.categories.find((c) => c.id === inc.categoryId);
  const suggested = new Set(cat?.suggestedTargets ?? []);
  const rows = active(agg.notifications);
  const [time, setTime] = useState(() => toLocalInputValue(new Date().toISOString()));
  const [busyTarget, setBusyTarget] = useState<string | null>(null);

  const register = async (targetId: string) => {
    const atUTC = fromLocalInputValue(time);
    if (!atUTC) return;
    setBusyTarget(targetId);
    await act((repo, a) => repo.addChild(a, inc.id, { kind: 'notification', targetId, atUTC, note: '' }), { success: 'Horário de acionamento registrado', successDetail: 'Simulado — nenhuma mensagem foi enviada.' });
    setBusyTarget(null);
  };

  const targets = [...catalog.notificationTargets].sort((a, b) => Number(suggested.has(b.id)) - Number(suggested.has(a.id)) || a.order - b.order);
  return (
    <div className="stack">
      <Alert tone="info">Registro do horário em que cada órgão/função foi acionado. É apenas um registro: o sistema não liga, não envia e-mail nem mensagem.</Alert>
      {writable ? (
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <TextField label="Horário do acionamento" type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} hint="Padrão: agora" />
          <Button size="sm" variant="ghost" onClick={() => setTime(toLocalInputValue(new Date().toISOString()))}>
            Agora
          </Button>
        </div>
      ) : null}
      <div className="grid grid-2">
        {targets.map((t) => {
          const done = rows.filter((r) => r.targetId === t.id).sort((a, b) => Date.parse(a.atUTC) - Date.parse(b.atUTC));
          return (
            <div key={t.id} className="resource-row">
              <div>
                <div className="item-title row" style={{ gap: 6 }}>
                  {t.name}
                  {suggested.has(t.id) ? <span className="badge tone-info">sugerido</span> : null}
                </div>
                <div className="item-sub">
                  {done.length ? done.map((d) => formatDateTime(d.atUTC)).join(' · ') : t.description}
                </div>
              </div>
              {done.length ? (
                <span className="badge tone-success">
                  <Icon name="check" size={14} /> Acionado
                </span>
              ) : writable ? (
                <Button size="sm" onClick={() => register(t.id)} loading={pending && busyTarget === t.id} disabled={pending}>
                  Registrar
                </Button>
              ) : (
                <span className="subtle">Pendente</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
