import { useRef, useState } from 'react';
import { AttachmentGallery } from '../../../ui/AttachmentGallery';
import { Button } from '../../../ui/Button';
import { SelectField, TextField } from '../../../ui/fields';
import { Alert } from '../../../ui/feedback';
import { useToast } from '../../../ui/Toast';
import { useDetail, useRepoAction } from './context';
import { ALL_SCENES, SCENE_CAPTIONS, syntheticPhoto, type SyntheticScene } from '../../../data/seed/syntheticImages';
import type { ChildKind } from '../../../data/repository';
import { ConfirmationDialog } from '../../../ui/Dialog';
import { TextArea } from '../../../ui/fields';

const MAX_DIM = 1280;

/** Reduz e recomprime a imagem no navegador (JPEG ~0,8) para caber no armazenamento local da demo. */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Imagem inválida'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AttachmentsTab() {
  const { agg, writable } = useDetail();
  const { act, pending } = useRepoAction();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scene, setScene] = useState<SyntheticScene>('viatura');
  const [caption, setCaption] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const items = agg.attachments.filter((a) => !a.isDeleted);
  const inc = agg.incident;

  const addSynthetic = async () => {
    const dataUrl = syntheticPhoto(scene, items.length + 1);
    await act(
      (repo, a) => repo.addChild(a, inc.id, { kind: 'attachment', fileName: `sintetica-${scene}-${items.length + 1}.svg`, caption: caption.trim() || SCENE_CAPTIONS[scene], mimeType: 'image/svg+xml', dataUrl, isSynthetic: true }),
      { success: 'Imagem sintética anexada' },
    );
    setCaption('');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error('Formato não suportado', 'Use PNG, JPEG ou WEBP.');
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      await act(
        (repo, a) => repo.addChild(a, inc.id, { kind: 'attachment', fileName: file.name.replace(/\.[^.]+$/, '.jpg'), caption: caption.trim() || file.name, mimeType: 'image/jpeg', dataUrl, isSynthetic: false }),
        { success: 'Imagem anexada', successDetail: `Comprimida para ${Math.round((dataUrl.length * 0.75) / 1024)} KB.` },
      );
      setCaption('');
    } catch {
      toast.error('Não foi possível ler a imagem', 'O arquivo pode estar corrompido.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!removing) return;
    const ok = await act((repo, a) => repo.removeChild(a, inc.id, 'attachment' as ChildKind, removing, reason), { success: 'Imagem removida (mantida na auditoria)' });
    if (ok) {
      setRemoving(null);
      setReason('');
    }
  };

  return (
    <div className="stack">
      <Alert tone="warning" title="Somente imagens sintéticas ou autorizadas">
        Não envie fotos internas reais. Na demonstração, as imagens ficam apenas neste navegador (limite de 8 por ocorrência).
      </Alert>
      {writable ? (
        <div className="inline-form">
          <TextField label="Legenda" optional value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ex.: Equipe realizando linha preventiva" maxLength={120} />
          <SelectField label="Cena sintética" value={scene} onChange={(e) => setScene(e.target.value as SyntheticScene)} options={ALL_SCENES.map((s) => ({ value: s, label: SCENE_CAPTIONS[s] }))} />
          <Button icon="image" onClick={addSynthetic} loading={pending} data-testid="btn-add-synthetic">
            Gerar imagem sintética
          </Button>
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="file-upload" onChange={(e) => void onFile(e.target.files?.[0])} />
            <label htmlFor="file-upload" className="btn btn-secondary" style={{ width: '100%' }} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}>
              Enviar imagem
            </label>
          </div>
        </div>
      ) : null}
      <AttachmentGallery items={items} renderActions={writable ? (a) => <Button size="sm" variant="ghost" iconOnly icon="trash" aria-label={`Remover ${a.caption}`} onClick={() => setRemoving(a.id)} /> : undefined} />
      <ConfirmationDialog
        open={Boolean(removing)}
        tone="danger"
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={pending}
        confirmDisabled={reason.trim().length < 5}
        title="Remover imagem?"
        description="Exclusão lógica: a imagem sai do relatório, mas o registro permanece na auditoria."
        confirmLabel="Remover"
      >
        <TextArea label="Motivo" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus />
      </ConfirmationDialog>
    </div>
  );
}
