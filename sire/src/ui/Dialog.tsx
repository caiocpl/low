import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { Icon } from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Prende o foco dentro do contêiner, fecha com Esc e devolve o foco ao elemento de origem. */
function useFocusTrap(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement>) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0] as HTMLElement;
      const lastEl = items[items.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, ref]);
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  wide,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`dialog ${wide ? 'wide' : ''} ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={description ? `${id}-d` : undefined}
      >
        <div className="dialog-head">
          {icon}
          <div className="grow">
            <h2 className="dialog-title" id={`${id}-t`}>
              {title}
            </h2>
            {description ? (
              <p className="muted" id={`${id}-d`} style={{ marginTop: 4 }}>
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" iconOnly icon="x" aria-label="Fechar" onClick={onClose} />
        </div>
        {children ? <div className="dialog-body">{children}</div> : null}
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmação explícita para ações irreversíveis ou de alto impacto. */
export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  loading,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  loading?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      icon={
        <div className={`empty-icon`} style={{ width: 40, height: 40, margin: 0, background: tone === 'danger' ? 'var(--critical-50)' : 'var(--brand-50)', color: tone === 'danger' ? 'var(--critical-700)' : 'var(--brand-700)' }}>
          <Icon name={tone === 'danger' ? 'alert' : 'checkCircle'} />
        </div>
      }
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} loadingText="Gravando…" disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

export function Drawer({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(open, onClose, ref);
  if (!open) return null;
  return createPortal(
    <>
      <div className="drawer-backdrop" onMouseDown={onClose} />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <div className="drawer-head">
          <h2 className="card-title grow" id={`${id}-t`}>
            {title}
          </h2>
          {actions}
          <Button variant="ghost" iconOnly icon="x" aria-label="Fechar" onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}
