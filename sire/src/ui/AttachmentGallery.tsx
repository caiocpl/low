import { useState, type ReactNode } from 'react';
import type { IncidentAttachment } from '../domain/types';
import { Dialog } from './Dialog';
import { formatDateTime } from '../domain/time';
import { EmptyState } from './feedback';

export function AttachmentGallery({ items, renderActions }: { items: IncidentAttachment[]; renderActions?: (a: IncidentAttachment) => ReactNode }) {
  const [preview, setPreview] = useState<IncidentAttachment | null>(null);
  if (items.length === 0) return <EmptyState icon="image" title="Nenhum registro fotográfico">Adicione imagens sintéticas ou autorizadas para compor o relatório.</EmptyState>;
  return (
    <>
      <div className="gallery" role="list">
        {items.map((a) => (
          <figure key={a.id} className="thumb" role="listitem" style={{ margin: 0 }}>
            <button type="button" onClick={() => setPreview(a)} style={{ border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }} aria-label={`Ampliar: ${a.caption}`}>
              <img src={a.dataUrl} alt={a.caption} loading="lazy" />
            </button>
            <figcaption className="thumb-cap">
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{a.caption}</span>
                <span className="subtle">
                  {a.isSynthetic ? 'Sintética' : 'Enviada'} · {formatDateTime(a.addedAtUTC)}
                </span>
              </span>
              {renderActions?.(a)}
            </figcaption>
          </figure>
        ))}
      </div>
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.caption ?? ''} wide description={preview ? `${preview.fileName} · ${Math.round(preview.sizeBytes / 1024)} KB · ${preview.actorName}` : undefined}>
        {preview ? <img src={preview.dataUrl} alt={preview.caption} style={{ width: '100%', borderRadius: 8 }} /> : null}
      </Dialog>
    </>
  );
}
