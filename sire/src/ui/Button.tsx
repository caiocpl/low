import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  loadingText?: string;
  iconOnly?: boolean;
  children?: ReactNode;
}

/**
 * Botão padrão. Em `loading`, fica desabilitado e anuncia o estado (aria-busy),
 * protegendo o operador contra cliques duplicados.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  loadingText,
  iconOnly = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, size !== 'md' ? `btn-${size}` : '', iconOnly ? 'btn-icon' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {iconOnly ? null : loading && loadingText ? loadingText : children}
      {iconRight && !loading ? <Icon name={iconRight} size={16} /> : null}
    </button>
  );
}
