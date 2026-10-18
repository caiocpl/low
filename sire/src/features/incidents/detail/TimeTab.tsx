import { useMemo, useState } from 'react';
import type { MilestoneType } from '../../../domain/types';
import { effectiveMilestones, MILESTONE_LABEL, MILESTONE_ORDER, validateChronology } from '../../../domain/milestones';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '../../../domain/time';
import type { FieldError } from '../../../domain/validation';
import { Button } from '../../../ui/Button';
import { SelectField, TextArea, TextField } from '../../../ui/fields';
import { Alert, ValidationSummary } from '../../../ui/feedback';
import { ConfirmationDialog } from '../../../ui/Dialog';
import { Icon } from '../../../ui/Icon';
import { useDetail, useRepoAction } from './context';
import { buildTimeline, IncidentTimeline } from '../IncidentTimeline';

/** Aba "Deslocamentos e linha do tempo": marcos de tempo + evolução cronológica + anotações. */
export function TimeTab() {
  const { agg, catalog, writable } = useDetail();
  const inc = agg.incident;
  const { act, pending } = useRepoAction();
  const eff = effectiveMilestones(agg.milestones);
  const issues = validateChronology(eff, new Date());
  const nextMissing = MILESTONE_ORDER.find((m) => !eff[m]) ?? 'SAIDA_LOCAL';
  const [type, setType] = useState<MilestoneType>(nextMissing);
  const [time, setTime] = useState(() => toLocalInputValue(new Date().toISOString()));
  const [vehicleId, setVehicleId] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<{ id: string; label: string } | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  const vehicleName = useMemo(() => {
    const map = new Map(catalog.vehicles.map((v) => [v.id, `${v.code} · ${v.description}`]));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [catalog.vehicles]);
  const timeline = useMemo(() => buildTimeline(agg, vehicleName), [agg, vehicleName]);
  const linked = agg.vehicles.filter((v) => !v.isDeleted);

  const record = async () => {
    setErrors([]);
    const atUTC = fromLocalInputValue(time);
    if (!atUTC) {
      setErrors([{ field: 'atUTC', message: 'Informe data e hora válidas.' }]);
      return;
    }
    const ok = await act((repo, a) => repo.recordMilestone(a, inc.id, { type, atUTC, vehicleId: vehicleId || null }), {
      success: `${MILESTONE_LABEL[type]} registrado`,
      onFieldErrors: setErrors,
    });
    if (ok) {
      setTime(toLocalInputValue(new Date().toISOString()));
      const after = MILESTONE_ORDER[MILESTONE_ORDER.indexOf(type) + 1];
      if (after) setType(after);
    }
  };

  const addNote = async () => {
    const ok = await act((repo, a) => repo.addNote(a, inc.id, note), { success: 'Anotação registrada' });
    if (ok) setNote('');
  };

  const remove = async () => {
    if (!removing) return;
    const ok = await act((repo, a) => repo.removeMilestone(a, inc.id, removing.id, removeReason), { success: 'Marco desconsiderado (mantido na auditoria)' });
    if (ok) {
      setRemoving(null);
      setRemoveReason('');
    }
  };

  return (
    <div className="stack">
      {issues.length ? (
        <Alert tone="critical" title="Linha do tempo inconsistente" role="alert">
          <ul>
            {issues.map((i) => (
              <li key={i.type}>{i.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section>
        <h3 className="section-title">Marcos de tempo</h3>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Marcos de tempo da ocorrência</caption>
            <thead>
              <tr>
                <th scope="col">Marco</th>
                <th scope="col">Horário (Brasília)</th>
                <th scope="col">Viatura / autor</th>
                {writable ? <th scope="col" style={{ width: 60 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {MILESTONE_ORDER.map((m) => {
                const rows = agg.milestones.filter((x) => x.type === m && !x.isDeleted).sort((a, b) => Date.parse(a.atUTC) - Date.parse(b.atUTC));
                if (rows.length === 0) {
                  return (
                    <tr key={m}>
                      <td>{MILESTONE_LABEL[m]}</td>
                      <td className="subtle">Não registrado</td>
                      <td />
                      {writable ? <td /> : null}
                    </tr>
                  );
                }
                return rows.map((r, idx) => (
                  <tr key={r.id}>
                    <td>
                      {MILESTONE_LABEL[m]}
                      {idx > 0 ? <span className="subtle"> (adicional)</span> : null}
                    </td>
                    <td className="nowrap" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: idx === 0 ? 600 : 400 }}>
                      {formatDateTime(r.atUTC)}
                    </td>
                    <td className="subtle">
                      {vehicleName(r.vehicleId) ?? '—'} · {r.actorName}
                    </td>
                    {writable ? (
                      <td>
                        <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Desconsiderar ${MILESTONE_LABEL[m]}`} onClick={() => setRemoving({ id: r.id, label: MILESTONE_LABEL[m] })} />
                      </td>
                    ) : null}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        <p className="subtle" style={{ marginTop: 8 }}>
          Quando há mais de um lançamento do mesmo marco (ex.: várias viaturas), os indicadores usam o mais antigo.
        </p>
      </section>

      {writable && inc.status !== 'RASCUNHO' ? (
        <section aria-label="Registrar deslocamento ou marco">
          <h3 className="section-title">Registrar deslocamento / marco</h3>
          <ValidationSummary errors={errors} title="Marco não registrado" />
          <div className="inline-form" style={{ marginTop: errors.length ? 12 : 0 }}>
            <SelectField label="Marco" value={type} onChange={(e) => setType(e.target.value as MilestoneType)} options={MILESTONE_ORDER.map((m) => ({ value: m, label: `${MILESTONE_LABEL[m]}${eff[m] ? ' ✓' : ''}` }))} />
            <div data-anchor="atUTC">
              <TextField label="Data/hora" type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <SelectField
              label="Viatura"
              optional
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              placeholder="—"
              options={linked.map((v) => ({ value: v.vehicleId, label: vehicleName(v.vehicleId) ?? v.vehicleId }))}
            />
            <Button variant="primary" icon="plus" onClick={record} loading={pending} loadingText="Registrando…" data-testid="btn-add-milestone">
              Registrar
            </Button>
          </div>
        </section>
      ) : inc.status === 'RASCUNHO' ? (
        <Alert tone="info">Registre a ocorrência para lançar marcos de tempo.</Alert>
      ) : null}

      <section>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h3 className="section-title" style={{ margin: 0 }}>
            Evolução da ocorrência
          </h3>
          <span className="subtle">
            <Icon name="lock" size={14} /> Registro somente-acréscimo
          </span>
        </div>
        {writable ? (
          <div className="stack-sm" style={{ marginBottom: 16 }}>
            <TextArea label="Nova anotação" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Informações do campo, decisões, comunicações…" maxLength={1000} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button icon="send" onClick={addNote} disabled={note.trim().length < 3} loading={pending} data-testid="btn-add-note">
                Registrar anotação
              </Button>
            </div>
          </div>
        ) : null}
        <IncidentTimeline entries={timeline} />
      </section>

      <ConfirmationDialog
        open={Boolean(removing)}
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={pending}
        confirmDisabled={removeReason.trim().length < 5}
        title={`Desconsiderar "${removing?.label}"?`}
        description="O lançamento deixa de contar nos tempos, mas permanece visível na linha do tempo e na auditoria."
        confirmLabel="Desconsiderar marco"
      >
        <TextArea label="Motivo" required rows={3} value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} hint="Mínimo 5 caracteres" data-autofocus />
      </ConfirmationDialog>
    </div>
  );
}
