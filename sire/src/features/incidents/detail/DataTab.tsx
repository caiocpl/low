import { useMemo, useState } from 'react';
import type { Incident, IncidentPatch, Phase, Priority } from '../../../domain/types';
import { canEditIncident } from '../../../domain/permissions';
import { MIN_REASON_LENGTH } from '../../../domain/status';
import type { FieldError } from '../../../domain/validation';
import { useSession } from '../../../app/services';
import { Button } from '../../../ui/Button';
import { KeyValue } from '../../../ui/layout';
import { SelectField, TextArea, TextField, YesNo } from '../../../ui/fields';
import { Alert, ValidationSummary } from '../../../ui/feedback';
import { useDetail, useRepoAction } from './context';

type Draft = {
  categoryId: string;
  priority: Priority;
  phase: Phase;
  classification: string;
  unfolding: string;
  paeItem: string;
  areaId: string;
  locationId: string;
  reference: string;
  responsibleBaseId: string;
  teamId: string;
  callerName: string;
  callerPhone: string;
  description: string;
  hasVictims: boolean;
  victimCount: string;
  victimConditionSummary: string;
  extinguishingAgent: string;
  extinguishingQty: string;
  affectedAreaM2: string;
  chemicalProduct: string;
  attended: boolean | null;
};

const toDraft = (i: Incident): Draft => ({
  categoryId: i.categoryId,
  priority: i.priority,
  phase: i.phase,
  classification: i.classification,
  unfolding: i.unfolding,
  paeItem: i.paeItem,
  areaId: i.areaId ?? '',
  locationId: i.locationId ?? '',
  reference: i.reference,
  responsibleBaseId: i.responsibleBaseId ?? '',
  teamId: i.teamId ?? '',
  callerName: i.callerName,
  callerPhone: i.callerPhone,
  description: i.description,
  hasVictims: i.hasVictims,
  victimCount: i.victimCount === null ? '' : String(i.victimCount),
  victimConditionSummary: i.victimConditionSummary,
  extinguishingAgent: i.extinguishingAgent,
  extinguishingQty: i.extinguishingQty,
  affectedAreaM2: i.affectedAreaM2 === null ? '' : String(i.affectedAreaM2),
  chemicalProduct: i.chemicalProduct,
  attended: i.attended,
});

function toPatch(d: Draft, i: Incident): IncidentPatch {
  const full: IncidentPatch = {
    categoryId: d.categoryId,
    priority: d.priority,
    phase: d.phase,
    classification: d.classification.trim(),
    unfolding: d.unfolding.trim(),
    paeItem: d.paeItem.trim(),
    areaId: d.areaId || null,
    locationId: d.locationId || null,
    reference: d.reference.trim(),
    responsibleBaseId: d.responsibleBaseId || null,
    teamId: d.teamId || null,
    callerName: d.callerName.trim(),
    callerPhone: d.callerPhone.trim(),
    description: d.description.trim(),
    hasVictims: d.hasVictims,
    victimCount: d.hasVictims ? (d.victimCount.trim() === '' ? null : Number(d.victimCount)) : null,
    victimConditionSummary: d.hasVictims ? d.victimConditionSummary.trim() : '',
    extinguishingAgent: d.extinguishingAgent.trim(),
    extinguishingQty: d.extinguishingQty.trim(),
    affectedAreaM2: d.affectedAreaM2.trim() === '' ? null : Number(d.affectedAreaM2.replace(',', '.')),
    chemicalProduct: d.chemicalProduct.trim(),
    attended: d.attended,
  };
  // Envia somente o que mudou (auditoria campo a campo fica precisa).
  return Object.fromEntries(Object.entries(full).filter(([k, v]) => JSON.stringify((i as unknown as Record<string, unknown>)[k]) !== JSON.stringify(v))) as IncidentPatch;
}

export function DataTab() {
  const { agg, catalog } = useDetail();
  const { actor } = useSession();
  const inc = agg.incident;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(inc));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const { act, pending } = useRepoAction();
  const editable = canEditIncident(actor.role, inc.status);
  const isCorrection = inc.status === 'ENCERRADA';
  const name = useMemo(
    () => ({
      cat: catalog.categories.find((c) => c.id === inc.categoryId)?.name,
      area: catalog.areas.find((a) => a.id === inc.areaId)?.name,
      loc: catalog.locations.find((l) => l.id === inc.locationId)?.name,
      base: catalog.bases.find((b) => b.id === inc.responsibleBaseId)?.name,
      sugBase: catalog.bases.find((b) => b.id === inc.suggestedBaseId)?.name,
      team: catalog.teams.find((t) => t.id === inc.teamId)?.name,
      channel: catalog.channels.find((c) => c.code === inc.channel)?.label,
    }),
    [catalog, inc],
  );
  const err = (f: string) => errors.find((e) => e.field === f)?.message;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const start = () => {
    setDraft(toDraft(inc));
    setErrors([]);
    setReason('');
    setEditing(true);
  };

  const save = async () => {
    const patch = toPatch(draft, inc);
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    if (isCorrection && reason.trim().length < MIN_REASON_LENGTH) {
      setErrors([{ field: 'reason', message: `Informe a justificativa da correção (mín. ${MIN_REASON_LENGTH} caracteres).` }]);
      return;
    }
    const ok = await act((repo, a) => repo.updateIncident(a, inc.id, patch, { expectedVersion: inc.rowVersion, reason }), {
      success: isCorrection ? 'Correção registrada com auditoria' : 'Dados salvos',
      successDetail: `${Object.keys(patch).length} campo(s) alterado(s).`,
      onFieldErrors: setErrors,
    });
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <div className="stack">
        <div className="row-between">
          <h3 className="section-title" style={{ margin: 0 }}>
            Dados da ocorrência
          </h3>
          {editable ? (
            <Button icon="edit" onClick={start} data-testid="btn-edit-data">
              {isCorrection ? 'Corrigir dados (auditado)' : 'Editar dados'}
            </Button>
          ) : null}
        </div>
        <KeyValue
          items={[
            { label: 'Tipo / hipótese', value: name.cat },
            { label: 'Prioridade', value: catalog.priorities.find((p) => p.code === inc.priority)?.label },
            { label: 'Fase', value: inc.phase === 'REATIVA' ? 'Reativa' : 'Proativa' },
            { label: 'Classificação', value: inc.classification },
            { label: 'Desdobramento', value: inc.unfolding },
            { label: 'Item PAE', value: inc.paeItem },
            { label: 'Canal', value: name.channel },
            { label: 'Macroárea', value: name.area },
            { label: 'Local', value: name.loc },
            { label: 'Ponto de referência', value: inc.reference },
            { label: 'Base sugerida (ilustrativa)', value: name.sugBase },
            { label: 'Base responsável', value: name.base, empty: 'A definir' },
            { label: 'Equipe', value: name.team, empty: 'A definir' },
            { label: 'Solicitante', value: inc.callerName },
            { label: 'Telefone (sintético)', value: inc.callerPhone },
            { label: 'Há vítimas?', value: inc.hasVictims ? `Sim · ${inc.victimCount ?? '?'} informada(s)` : 'Não' },
            { label: 'Estado das vítimas', value: inc.victimConditionSummary },
            { label: 'Agente extintor', value: inc.extinguishingAgent },
            { label: 'Qtd. utilizada', value: inc.extinguishingQty },
            { label: 'Área afetada', value: inc.affectedAreaM2 === null ? '' : `${inc.affectedAreaM2.toLocaleString('pt-BR')} m²` },
            { label: 'Produto químico', value: inc.chemicalProduct },
            { label: 'Ocorrência atendida?', value: inc.attended === null ? '' : inc.attended ? 'Sim' : 'Não', empty: 'Não respondido' },
          ]}
        />
        <div>
          <h3 className="section-title">Descrição do incidente</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{inc.description || <span className="subtle">Sem descrição.</span>}</p>
        </div>
        {inc.closingSummary ? (
          <div>
            <h3 className="section-title">Resumo de encerramento</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{inc.closingSummary}</p>
          </div>
        ) : null}
        {inc.cancelReason ? <Alert tone="warning" title="Justificativa do cancelamento">{inc.cancelReason}</Alert> : null}
      </div>
    );
  }

  const locations = catalog.locations.filter((l) => l.areaId === draft.areaId);
  return (
    <form
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-label="Editar dados da ocorrência"
    >
      <ValidationSummary errors={errors} />
      {isCorrection ? <Alert tone="warning" title="Correção pós-encerramento">Cada campo alterado gera registro de auditoria com valor anterior, novo valor, autor e justificativa.</Alert> : null}
      <div className="form-grid">
        <div className="col-4" data-anchor="categoryId">
          <SelectField label="Tipo / hipótese" required value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)} options={catalog.categories.map((c) => ({ value: c.id, label: c.name }))} error={err('categoryId')} />
        </div>
        <div className="col-4">
          <SelectField label="Prioridade" required value={draft.priority} onChange={(e) => set('priority', e.target.value as Priority)} options={catalog.priorities.map((p) => ({ value: p.code, label: p.label }))} />
        </div>
        <div className="col-4">
          <SelectField label="Fase" value={draft.phase} onChange={(e) => set('phase', e.target.value as Phase)} options={[{ value: 'REATIVA', label: 'Reativa' }, { value: 'PROATIVA', label: 'Proativa' }]} hint="Definição parametrizável — ver tempos ao lado" />
        </div>
        <div className="col-4">
          <TextField label="Classificação" value={draft.classification} onChange={(e) => set('classification', e.target.value)} maxLength={120} />
        </div>
        <div className="col-4">
          <TextField label="Desdobramento" value={draft.unfolding} onChange={(e) => set('unfolding', e.target.value)} maxLength={160} />
        </div>
        <div className="col-4">
          <TextField label="Item PAE" value={draft.paeItem} onChange={(e) => set('paeItem', e.target.value)} maxLength={60} hint="Referência ilustrativa" />
        </div>
        <div className="col-4" data-anchor="areaId">
          <SelectField label="Macroárea" required value={draft.areaId} onChange={(e) => setDraft((d) => ({ ...d, areaId: e.target.value, locationId: '' }))} placeholder="Selecione" options={catalog.areas.map((a) => ({ value: a.id, label: a.name }))} error={err('areaId')} />
        </div>
        <div className="col-4" data-anchor="locationId">
          <SelectField label="Local" required value={draft.locationId} onChange={(e) => set('locationId', e.target.value)} placeholder="Selecione" options={locations.map((l) => ({ value: l.id, label: l.name }))} error={err('locationId')} />
        </div>
        <div className="col-4">
          <TextField label="Ponto de referência" value={draft.reference} onChange={(e) => set('reference', e.target.value)} maxLength={200} />
        </div>
        <div className="col-6">
          <SelectField label="Base responsável" value={draft.responsibleBaseId} onChange={(e) => set('responsibleBaseId', e.target.value)} placeholder="A definir" options={catalog.bases.map((b) => ({ value: b.id, label: b.name }))} />
        </div>
        <div className="col-6">
          <SelectField label="Equipe" value={draft.teamId} onChange={(e) => set('teamId', e.target.value)} placeholder="A definir" options={catalog.teams.map((t) => ({ value: t.id, label: t.name }))} />
        </div>
        <div className="col-6" data-anchor="callerName">
          <TextField label="Solicitante" required value={draft.callerName} onChange={(e) => set('callerName', e.target.value)} error={err('callerName')} />
        </div>
        <div className="col-6" data-anchor="callerPhone">
          <TextField label="Telefone" optional value={draft.callerPhone} onChange={(e) => set('callerPhone', e.target.value)} error={err('callerPhone')} />
        </div>
        <div className="col-12" data-anchor="description">
          <TextArea label="Descrição do incidente" required value={draft.description} onChange={(e) => set('description', e.target.value)} error={err('description')} />
        </div>
        <div className="col-4">
          <YesNo name="edit-victims" label="Há vítimas?" value={draft.hasVictims} onChange={(v) => setDraft((d) => ({ ...d, hasVictims: v, victimCount: v ? d.victimCount || '1' : '' }))} danger />
        </div>
        {draft.hasVictims ? (
          <>
            <div className="col-3" data-anchor="victimCount">
              <TextField label="Quantidade" required type="number" min={1} value={draft.victimCount} onChange={(e) => set('victimCount', e.target.value)} error={err('victimCount')} />
            </div>
            <div className="col-12" data-anchor="victimConditionSummary">
              <TextField label="Estado das vítimas" required value={draft.victimConditionSummary} onChange={(e) => set('victimConditionSummary', e.target.value)} error={err('victimConditionSummary')} />
            </div>
          </>
        ) : null}
        <div className="col-3">
          <TextField label="Agente extintor" value={draft.extinguishingAgent} onChange={(e) => set('extinguishingAgent', e.target.value)} placeholder="Água, PQS, CO₂, espuma…" />
        </div>
        <div className="col-3">
          <TextField label="Qtd. utilizada" value={draft.extinguishingQty} onChange={(e) => set('extinguishingQty', e.target.value)} placeholder="Ex.: 400 L" />
        </div>
        <div className="col-3" data-anchor="affectedAreaM2">
          <TextField label="Área afetada (m²)" type="number" min={0} step="any" value={draft.affectedAreaM2} onChange={(e) => set('affectedAreaM2', e.target.value)} error={err('affectedAreaM2')} />
        </div>
        <div className="col-3">
          <TextField label="Produto químico" value={draft.chemicalProduct} onChange={(e) => set('chemicalProduct', e.target.value)} placeholder="Se aplicável" />
        </div>
        <div className="col-6">
          <YesNo name="attended" label="Ocorrência atendida?" value={draft.attended} onChange={(v) => set('attended', v)} />
        </div>
        {isCorrection ? (
          <div className="col-12" data-anchor="reason">
            <TextArea label="Justificativa da correção" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} error={err('reason')} />
          </div>
        ) : null}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => setEditing(false)} disabled={pending}>
          Descartar alterações
        </Button>
        <Button variant="primary" type="submit" icon="check" loading={pending} loadingText="Salvando…" data-testid="btn-save-data">
          Salvar dados
        </Button>
      </div>
    </form>
  );
}
