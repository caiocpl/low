import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { STATUS_LABEL, STATUS_TONE, type StatusTone } from '../domain/status';
import type { IncidentStatus, Priority } from '../domain/types';
import type { FieldError } from '../domain/validation';

export function Badge({ tone, children, dot = false, title }: { tone: StatusTone; children: ReactNode; dot?: boolean; title?: string }) {
  return (
    <span className={`badge tone-${tone}`} title={title}>
      {dot ? <span className="dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

const PRIORITY_TITLE: Record<Priority, string> = { P1: 'Crítica', P2: 'Alta', P3: 'Moderada', P4: 'Baixa' };

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`prio prio-${priority}`} title={`Prioridade ${PRIORITY_TITLE[priority]}`} aria-label={`Prioridade ${priority} — ${PRIORITY_TITLE[priority]}`}>
      {priority}
    </span>
  );
}

const ALERT_ICON: Record<'info' | 'success' | 'warning' | 'critical', IconName> = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  critical: 'xCircle',
};

export function Alert({
  tone,
  title,
  children,
  role,
}: {
  tone: 'info' | 'success' | 'warning' | 'critical';
  title?: ReactNode;
  children?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div className={`alert tone-${tone}`} role={role}>
      <Icon name={ALERT_ICON[tone]} />
      <div className="grow">
        {title ? <div className="alert-title">{title}</div> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  categoryId: 'O que aconteceu?',
  priority: 'Prioridade',
  channel: 'Canal de entrada',
  description: 'Descrição do incidente',
  areaId: 'Macroárea',
  locationId: 'Local',
  callerName: 'Nome do solicitante',
  callerPhone: 'Telefone',
  callReceivedAtUTC: 'Data/hora do chamado',
  hasVictims: 'Há vítimas?',
  victimCount: 'Quantidade de vítimas',
  victimConditionSummary: 'Estado das vítimas',
  reason: 'Justificativa',
  atUTC: 'Horário',
  affectedAreaM2: 'Área afetada',
};

/**
 * Resumo de validação no topo do formulário. Cada item leva o foco ao campo com erro
 * (padrão GOV.UK de "error summary"), útil sob pressão e para leitores de tela.
 */
export function ValidationSummary({ errors, title = 'Corrija os campos abaixo para continuar' }: { errors: FieldError[]; title?: string }) {
  if (errors.length === 0) return null;
  const focusField = (field: string) => {
    const el = document.querySelector<HTMLElement>(`[data-anchor="${field}"] input, [data-anchor="${field}"] select, [data-anchor="${field}"] textarea, [data-anchor="${field}"] button`);
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  return (
    <div className="alert tone-critical" role="alert" tabIndex={-1} data-testid="validation-summary">
      <Icon name="xCircle" />
      <div className="grow">
        <div className="alert-title">{title}</div>
        <ul>
          {errors.map((e, i) => (
            <li key={`${e.field}-${i}`}>
              <button type="button" className="link" onClick={() => focusField(e.field)}>
                {FIELD_LABELS[e.field] ? `${FIELD_LABELS[e.field]}: ` : ''}
                {e.message}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'layers', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={24} />
      </div>
      <div className="empty-title">{title}</div>
      {children ? <div className="empty-desc">{children}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState icon="cloudOff" title="Não foi possível carregar" action={onRetry ? <button className="btn btn-secondary" onClick={onRetry}>Tentar novamente</button> : null}>
      {message}
    </EmptyState>
  );
}

export function ForbiddenState({ action }: { action: string }) {
  return (
    <EmptyState icon="lock" title="Acesso restrito ao seu perfil">
      Seu perfil atual não pode {action}. Troque o perfil de demonstração no topo da tela para continuar.
    </EmptyState>
  );
}

export function Skeleton({ width = '100%', height = 14, style }: { width?: number | string; height?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, ...style }} aria-hidden />;
}

export function SkeletonBlock({ lines = 4 }: { lines?: number }) {
  return (
    <div className="stack-sm" role="status" aria-label="Carregando">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${90 - (i % 3) * 18}%`} height={i === 0 ? 20 : 14} />
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
