import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface FieldShellProps {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Estrutura acessível de campo: label associado, dica e erro ligados via aria-describedby. */
export function Field({ label, required, optional, hint, error, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className ?? ''}`} data-field-error={error ? 'true' : undefined}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? (
          <span className="req" aria-hidden>
            *
          </span>
        ) : null}
        {optional ? <span className="opt">(opcional)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field-error" id={errId} role="alert">
          <Icon name="alert" size={14} />
          {error}
        </span>
      ) : null}
    </div>
  );
}

type BaseProps = { label: string; required?: boolean; optional?: boolean; hint?: ReactNode; error?: string; className?: string };

export function TextField({ label, required, optional, hint, error, className, ...input }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <input id={id} className="input" aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} {...input} />
      )}
    </Field>
  );
}

export function TextArea({ label, required, optional, hint, error, className, ...input }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} className="textarea" aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} {...input} />
      )}
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  required,
  optional,
  hint,
  error,
  className,
  options,
  placeholder,
  ...select
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  return (
    <Field label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <select id={id} className="select" aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required={required || undefined} {...select}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Escolha binária grande (Sim/Não), operável por teclado e leitor de tela. */
export function YesNo({
  label,
  value,
  onChange,
  error,
  required,
  yesLabel = 'Sim',
  noLabel = 'Não',
  danger,
  name,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  error?: string;
  required?: boolean;
  yesLabel?: string;
  noLabel?: string;
  danger?: boolean;
  name: string;
}) {
  const id = useId();
  return (
    <div className="field" role="group" aria-labelledby={`${id}-l`} data-field-error={error ? 'true' : undefined}>
      <span className="field-label" id={`${id}-l`}>
        {label}
        {required ? <span className="req" aria-hidden>*</span> : null}
      </span>
      <div className={`segmented ${danger ? 'danger' : ''}`} role="radiogroup" aria-labelledby={`${id}-l`}>
        {[
          { v: false, l: noLabel },
          { v: true, l: yesLabel },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            name={name}
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
          >
            {o.l}
          </button>
        ))}
      </div>
      {error ? (
        <span className="field-error" role="alert">
          <Icon name="alert" size={14} />
          {error}
        </span>
      ) : null}
    </div>
  );
}
