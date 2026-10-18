import { useMemo, useState } from 'react';
import { useCatalog } from '../../app/services';
import { Icon } from '../../ui/Icon';
import { Alert, SkeletonBlock } from '../../ui/feedback';

/** Diretório fictício (DDD 00). Telefones apenas como texto — sem discagem. */
export function ContactsList({ autoFocus = false }: { autoFocus?: boolean }) {
  const catalog = useCatalog();
  const [term, setTerm] = useState('');
  const groups = useMemo(() => {
    const t = term.trim().toLocaleLowerCase('pt-BR');
    const rows = (catalog.data?.contacts ?? []).filter((c) => !t || `${c.group} ${c.role} ${c.name} ${c.occupancy}`.toLocaleLowerCase('pt-BR').includes(t));
    const map = new Map<string, typeof rows>();
    for (const r of rows) map.set(r.group, [...(map.get(r.group) ?? []), r]);
    return [...map.entries()];
  }, [catalog.data, term]);

  return (
    <div className="stack">
      <Alert tone="info">Diretório fictício para demonstração. Os números usam DDD inexistente (00) e não há discagem pelo sistema.</Alert>
      <div className="input-icon">
        <Icon name="search" />
        <input className="input" placeholder="Filtrar por função, nome ou grupo" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Filtrar contatos" data-autofocus={autoFocus || undefined} />
      </div>
      {catalog.loading && !catalog.data ? <SkeletonBlock lines={6} /> : null}
      {groups.length === 0 && catalog.data ? <p className="muted">Nenhum contato encontrado.</p> : null}
      {groups.map(([group, rows]) => (
        <section key={group}>
          <h3 className="section-title">{group}</h3>
          <ul className="list">
            {rows.map((c) => (
              <li key={c.id} className="list-item">
                <span className="avatar" aria-hidden>
                  {c.name
                    .split(' ')
                    .slice(0, 2)
                    .map((s) => s[0])
                    .join('')}
                </span>
                <div className="grow">
                  <div className="item-title">{c.role}</div>
                  <div className="item-sub">
                    {c.name} · {c.occupancy}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono">{c.phone}</div>
                  {c.extension ? <div className="subtle">Ramal {c.extension}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
