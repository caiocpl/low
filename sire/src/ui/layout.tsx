import type { ReactNode } from 'react';
import { Link } from '../app/router';
import { Icon, type IconName } from './Icon';

export interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({ title, description, crumbs, actions, meta }: { title: ReactNode; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="grow">
        {crumbs?.length ? (
          <nav aria-label="Trilha de navegação" className="breadcrumbs">
            {crumbs.map((c, i) => (
              <span key={c.label} className="row" style={{ gap: 8 }}>
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                {i < crumbs.length - 1 ? <Icon name="chevronRight" size={14} /> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-desc">{description}</p> : null}
        {meta}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  foot,
  icon,
  accent,
  to,
  testId,
}: {
  label: string;
  value: number | string | null;
  foot?: ReactNode;
  icon?: IconName;
  accent?: 'critical' | 'warning' | 'info' | 'success';
  to?: string;
  testId?: string;
}) {
  const empty = value === null || value === '' || value === 'Sem dados';
  const body = (
    <>
      <span className="metric-label">
        {icon ? <Icon name={icon} size={16} /> : null}
        {label}
      </span>
      <span className={`metric-value ${empty ? 'is-empty' : ''}`} data-testid={testId}>
        {empty ? 'Sem dados' : value}
      </span>
      {foot ? <span className="metric-foot">{foot}</span> : null}
    </>
  );
  const cls = `card metric ${accent ? `accent-${accent}` : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Card({ title, subtitle, actions, children, footer, bodyClass, id, icon }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; footer?: ReactNode; bodyClass?: string; id?: string; icon?: IconName }) {
  return (
    <section className="card" id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {title ? (
        <div className="card-head">
          <div>
            <h2 className="card-title">
              {icon ? <Icon name={icon} /> : null}
              {title}
            </h2>
            {subtitle ? <div className="card-sub">{subtitle}</div> : null}
          </div>
          {actions ? <div className="row">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`card-body ${bodyClass ?? ''}`}>{children}</div>
      {footer ? <div className="card-foot">{footer}</div> : null}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange, label }: { tabs: { id: T; label: string; count?: number; icon?: IconName }[]; active: T; onChange: (id: T) => void; label: string }) {
  const onKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const t = tabs[next];
    if (t) {
      onChange(t.id);
      document.getElementById(`tab-${t.id}`)?.focus();
    }
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          className="tab"
          aria-selected={active === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={active === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.icon ? <Icon name={t.icon} size={16} /> : null}
          {t.label}
          {t.count !== undefined ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode; empty?: string }[] }) {
  return (
    <dl className="kv">
      {items.map((it) => {
        const isEmpty = it.value === null || it.value === undefined || it.value === '';
        return (
          <div key={it.label}>
            <dt>{it.label}</dt>
            <dd className={isEmpty ? 'empty' : undefined}>{isEmpty ? it.empty ?? 'Não informado' : it.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
