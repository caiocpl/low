import { useEffect, useMemo, useState } from 'react';
import type { IncidentStatus } from '../../../domain/types';
import { ADVANCE_ACTION_LABEL, cancelAllowedFor, MIN_REASON_LENGTH, nextStatus, STATUS_LABEL, STATUS_MILESTONES } from '../../../domain/status';
import { MILESTONE_LABEL, effectiveMilestones } from '../../../domain/milestones';
import { closureChecklist, isClosureReady, type FieldError } from '../../../domain/validation';
import { fromLocalInputValue, toLocalInputValue } from '../../../domain/time';
import { useSession } from '../../../app/services';
import { Button } from '../../../ui/Button';
import { ConfirmationDialog, Dialog } from '../../../ui/Dialog';
import { SelectField, TextArea, TextField } from '../../../ui/fields';
import { Alert, ValidationSummary } from '../../../ui/feedback';
import { Icon } from '../../../ui/Icon';
import { useDetail, useRepoAction } from './context';
import { TransitionError } from '../../../data/errors';
import { suggestBase } from '../suggestions';

export function StatusActions({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const { agg } = useDetail();
  const { can, actor } = useSession();
  const inc = agg.incident;
  const next = nextStatus(inc.status);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const canAdvance = next && (next === 'ENCERRADA' ? can('incident.close') : can('incident.advance'));
  const canCancel = cancelAllowedFor(actor.role, inc.status);

  return (
    <>
      {canCancel ? (
        <Button variant="danger-outline" icon="xCircle" onClick={() => setCancelOpen(true)} data-testid="btn-cancel">
          Cancelar ocorrência
        </Button>
      ) : null}
      {next ? (
        canAdvance ? (
          <Button
            variant="primary"
            icon={next === 'ENCERRADA' ? 'checkCircle' : 'arrowRight'}
            onClick={() => (next === 'ENCERRADA' ? setCloseOpen(true) : setAdvanceOpen(true))}
            data-testid="btn-advance"
          >
            {ADVANCE_ACTION_LABEL[inc.status]}
          </Button>
        ) : (
          <span className="badge tone-muted" title="Ação indisponível para o perfil atual" data-testid="advance-locked">
            <Icon name="lock" size={14} />
            {next === 'ENCERRADA' ? 'Encerramento exige Coordenador' : 'Perfil somente leitura'}
          </span>
        )
      ) : null}
      {advanceOpen && next && next !== 'ENCERRADA' ? <AdvanceDialog to={next} onClose={() => setAdvanceOpen(false)} /> : null}
      {closeOpen ? <CloseDialog onClose={() => setCloseOpen(false)} onOpenTab={onOpenTab} /> : null}
      {cancelOpen ? <CancelDialog onClose={() => setCancelOpen(false)} /> : null}
    </>
  );
}

const nowLocal = () => toLocalInputValue(new Date().toISOString());

function AdvanceDialog({ to, onClose }: { to: IncidentStatus; onClose: () => void }) {
  const { agg, catalog } = useDetail();
  const inc = agg.incident;
  const { act, pending } = useRepoAction();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const milestones = STATUS_MILESTONES[to] ?? [];
  const eff = effectiveMilestones(agg.milestones);
  const sug = suggestBase(catalog, inc.areaId, inc.locationId);
  const [baseId, setBaseId] = useState(inc.responsibleBaseId ?? sug?.base.id ?? '');
  const [teamId, setTeamId] = useState(inc.teamId ?? '');
  const [time, setTime] = useState(nowLocal);
  const [arrival, setArrival] = useState(nowLocal);
  const linkedVehicles = new Set(agg.vehicles.filter((v) => !v.isDeleted).map((v) => v.vehicleId));
  const [vehicleId, setVehicleId] = useState('');
  const needsBase = to === 'ACIONADA';
  const isArrival = to === 'EM_ATENDIMENTO' && !eff.CHEGADA_LOCAL;

  const descriptions: Partial<Record<IncidentStatus, string>> = {
    REGISTRADA: 'Converte o rascunho em ocorrência registrada. Todos os campos obrigatórios do pré-atendimento serão validados.',
    EM_TRIAGEM: 'Indica que a central está avaliando a ocorrência, a base responsável e os recursos.',
    ACIONADA: 'Confirma o acionamento da equipe. Registra o marco "Acionamento da equipe".',
    EM_DESLOCAMENTO: 'Registra a saída da primeira viatura da base.',
    EM_ATENDIMENTO: 'Registra a chegada no local e o início do atendimento.',
    CONTROLADA: 'Declara a situação sob controle. Início da fase proativa (rescaldo, vigilância, desmobilização).',
  };

  const confirm = async () => {
    setErrors([]);
    const atUTC = fromLocalInputValue(time);
    if (milestones.length && !atUTC) {
      setErrors([{ field: 'atUTC', message: 'Informe um horário válido.' }]);
      return;
    }
    if (needsBase && (!baseId || !teamId)) {
      setErrors([
        ...(!baseId ? [{ field: 'base', message: 'Selecione a base responsável.' }] : []),
        ...(!teamId ? [{ field: 'team', message: 'Selecione a equipe acionada.' }] : []),
      ]);
      return;
    }
    const ok = await act(
      async (repo, actor) => {
        let version = inc.rowVersion;
        if (needsBase && (baseId !== inc.responsibleBaseId || teamId !== inc.teamId)) {
          const u = await repo.updateIncident(actor, inc.id, { responsibleBaseId: baseId, teamId }, { expectedVersion: version });
          version = u.rowVersion;
        }
        if (isArrival) {
          const arr = fromLocalInputValue(arrival);
          if (!arr) throw new TransitionError('Horário de chegada inválido.');
          await repo.recordMilestone(actor, inc.id, { type: 'CHEGADA_LOCAL', atUTC: arr, vehicleId: null });
        }
        if (to === 'EM_DESLOCAMENTO' && vehicleId && !linkedVehicles.has(vehicleId)) {
          await repo.addChild(actor, inc.id, { kind: 'vehicle', vehicleId, kmStart: null, kmEnd: null });
        }
        await repo.transitionIncident(actor, inc.id, to, { expectedVersion: version, atUTC: atUTC ?? undefined, vehicleId: vehicleId || null });
      },
      { success: `Status: ${STATUS_LABEL[to]}`, successDetail: `${inc.protocol} atualizado.`, onFieldErrors: setErrors },
    );
    if (ok) onClose();
  };

  const baseVehicles = catalog.vehicles.filter((v) => v.active && (!baseId || v.baseId === (inc.responsibleBaseId ?? baseId)));

  return (
    <ConfirmationDialog
      open
      onClose={onClose}
      onConfirm={confirm}
      loading={pending}
      title={ADVANCE_ACTION_LABEL[inc.status] ?? `Avançar para ${STATUS_LABEL[to]}`}
      description={descriptions[to]}
      confirmLabel={`Confirmar · ${STATUS_LABEL[to]}`}
    >
      <div className="stack">
        <ValidationSummary errors={errors} title="Não foi possível avançar" />
        {needsBase ? (
          <div className="grid grid-2">
            <SelectField
              label="Base responsável"
              required
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              placeholder="Selecione"
              options={catalog.bases.map((b) => ({ value: b.id, label: b.id === sug?.base.id ? `${b.name} (sugerida)` : b.name }))}
              error={errors.find((e) => e.field === 'base')?.message}
              hint={sug ? 'Sugestão ilustrativa — confirme ou altere.' : undefined}
            />
            <SelectField
              label="Equipe acionada"
              required
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              placeholder="Selecione"
              options={catalog.teams.map((t) => ({ value: t.id, label: t.name }))}
              error={errors.find((e) => e.field === 'team')?.message}
            />
          </div>
        ) : null}
        {isArrival ? (
          <TextField label="Chegada no local" required type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} hint="Horário de Brasília" />
        ) : null}
        {milestones.length ? (
          <TextField
            label={milestones.filter((m) => !(m === 'CHEGADA_LOCAL' && isArrival)).map((m) => MILESTONE_LABEL[m]).join(' / ')}
            required
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            hint="Padrão: agora. Ajuste se o registro estiver sendo feito com atraso."
          />
        ) : null}
        {to === 'EM_DESLOCAMENTO' ? (
          <SelectField
            label="Viatura que saiu"
            optional
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            placeholder="Não informar agora"
            options={baseVehicles.map((v) => ({ value: v.id, label: `${v.code} · ${v.description}${linkedVehicles.has(v.id) ? ' (já vinculada)' : ''}` }))}
            hint="Se escolhida, a viatura é vinculada automaticamente à ocorrência."
          />
        ) : null}
        <p className="subtle">
          <Icon name="history" size={14} /> A mudança é registrada no histórico com autor e horário — a linha do tempo nunca é sobrescrita.
        </p>
      </div>
    </ConfirmationDialog>
  );
}

function CloseDialog({ onClose, onOpenTab }: { onClose: () => void; onOpenTab: (tab: string) => void }) {
  const { agg, catalog } = useDetail();
  const inc = agg.incident;
  const { act, pending } = useRepoAction();
  const [summary, setSummary] = useState(inc.closingSummary);
  const [time, setTime] = useState(nowLocal);
  const [serverChecks, setServerChecks] = useState<{ id: string; label: string; ok: boolean; detail?: string }[] | null>(null);
  const checks = useMemo(() => closureChecklist(agg, catalog, new Date(), summary), [agg, catalog, summary]);
  const ready = isClosureReady(checks);
  useEffect(() => setServerChecks(null), [summary]);

  const tabFor: Record<string, string> = {
    location: 'dados', base: 'dados', classification: 'dados', attended: 'dados', milestones: 'tempo', chronology: 'tempo',
    vehicles: 'viaturas', personnel: 'efetivo', victimsCount: 'vitimas', 'cat-victims': 'vitimas', 'cat-witness': 'testemunhas',
    'cat-attachments': 'anexos', 'cat-extinguishingAgent': 'dados', 'cat-affectedAreaM2': 'dados', 'cat-chemicalProduct': 'dados',
  };

  const confirm = async () => {
    const atUTC = fromLocalInputValue(time);
    if (!atUTC) return;
    const ok = await act(
      async (repo, actor) => {
        try {
          await repo.transitionIncident(actor, inc.id, 'ENCERRADA', { expectedVersion: inc.rowVersion, atUTC, closingSummary: summary.trim() });
        } catch (e) {
          if (e instanceof TransitionError && e.checks.length) setServerChecks(e.checks);
          throw e;
        }
      },
      { success: `${inc.protocol} encerrada`, successDetail: 'Relatório PDF disponível.' },
    );
    if (ok) onClose();
  };

  const shown = serverChecks ?? checks;
  const pendingCount = shown.filter((c) => !c.ok).length;

  return (
    <Dialog
      open
      wide
      onClose={pending ? () => undefined : onClose}
      title="Encerrar ocorrência"
      description="O encerramento exige o checklist de completude. Após encerrar, alterações só por correção auditada (Coordenador)."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            Voltar
          </Button>
          <Button variant="primary" icon="checkCircle" onClick={confirm} loading={pending} loadingText="Encerrando…" disabled={!ready} data-testid="btn-confirm-close">
            Encerrar ocorrência
          </Button>
        </>
      }
    >
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <TextArea
            label="Resumo de encerramento"
            required
            rows={6}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            hint={`${summary.trim().length} caracteres · mínimo 20`}
            placeholder="Ações realizadas, resultado, recursos desmobilizados, pendências para a área…"
          />
          <TextField label="Término do atendimento" required type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} hint="Horário de Brasília" />
        </div>
        <div>
          <h3 className="section-title">
            Checklist de completude {pendingCount ? <span className="badge tone-critical">{pendingCount} pendente(s)</span> : <span className="badge tone-success">Completo</span>}
          </h3>
          <ul className="check-list" data-testid="closure-checklist">
            {shown.map((c) => (
              <li key={c.id}>
                <Icon name={c.ok ? 'checkCircle' : 'xCircle'} className={c.ok ? 'ok' : 'nok'} />
                <div>
                  <div>{c.label}</div>
                  {c.detail && !c.ok ? <div className="subtle">{c.detail}</div> : null}
                  {!c.ok && tabFor[c.id] ? (
                    <button
                      type="button"
                      className="link"
                      style={{ fontSize: 13 }}
                      onClick={() => {
                        onClose();
                        onOpenTab(tabFor[c.id] as string);
                      }}
                    >
                      Resolver
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

function CancelDialog({ onClose }: { onClose: () => void }) {
  const { agg } = useDetail();
  const inc = agg.incident;
  const { act, pending } = useRepoAction();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const valid = reason.trim().length >= MIN_REASON_LENGTH;
  const confirm = async () => {
    const ok = await act((repo, actor) => repo.transitionIncident(actor, inc.id, 'CANCELADA', { expectedVersion: inc.rowVersion, reason }), {
      success: `${inc.protocol} cancelada`,
      onFieldErrors: setErrors,
    });
    if (ok) onClose();
  };
  return (
    <ConfirmationDialog
      open
      tone="danger"
      onClose={onClose}
      onConfirm={confirm}
      loading={pending}
      confirmDisabled={!valid}
      title={`Cancelar ${inc.protocol}?`}
      description="O cancelamento é definitivo e fica registrado no histórico com autor, horário e justificativa."
      confirmLabel="Cancelar ocorrência"
    >
      <div className="stack">
        <ValidationSummary errors={errors} />
        <TextArea
          label="Justificativa"
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex.: chamado duplicado do protocolo PAE-…, alarme falso confirmado pelo solicitante…"
          hint={`${reason.trim().length}/${MIN_REASON_LENGTH} caracteres mínimos`}
          data-autofocus
        />
        <Alert tone="warning">Cancelar não apaga dados: a ocorrência continua consultável e auditável.</Alert>
      </div>
    </ConfirmationDialog>
  );
}
