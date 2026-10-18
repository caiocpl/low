import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { navigate } from './router';
import { useRepo, useSession } from './services';
import { Icon, type IconName } from '../ui/Icon';
import type { Incident } from '../domain/types';
import { STATUS_LABEL } from '../domain/status';
import { formatDateTime } from '../domain/time';

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

/** Busca universal (Ctrl+K): ações rápidas + ocorrências por protocolo, local ou descrição. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const repo = useRepo();
  const { can } = useSession();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Incident[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setCursor(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = window.setTimeout(() => {
      repo
        .listIncidents({ search: term, pageSize: 6, sort: 'recent' })
        .then((p) => alive && setResults(p.items))
        .catch(() => alive && setResults([]));
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [term, open, repo]);

  const go = (to: string) => () => {
    onClose();
    navigate(to);
  };

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      ...(can('incident.create') ? [{ id: 'new', group: 'Ações', label: 'Registrar novo chamado', hint: 'Alt+N', icon: 'plus' as const, run: go('/ocorrencias/nova') }] : []),
      { id: 'ops', group: 'Ações', label: 'Abrir Central de operações', icon: 'dashboard', run: go('/') },
      { id: 'list', group: 'Ações', label: 'Ver ocorrências ativas', icon: 'list', run: go('/ocorrencias?status=ativas') },
      { id: 'int', group: 'Ações', label: 'Cadeia de dados e integração Power BI', icon: 'database', run: go('/integracao') },
    ];
    const t = term.trim().toLowerCase();
    const filtered = t ? base.filter((c) => c.label.toLowerCase().includes(t)) : base;
    const incidents: Command[] = results.map((i) => ({
      id: i.id,
      group: 'Ocorrências',
      label: `${i.protocol} · ${i.title}`,
      hint: `${STATUS_LABEL[i.status]} · ${formatDateTime(i.callReceivedAtUTC)}`,
      icon: 'file',
      run: go(`/ocorrencias/${i.id}`),
    }));
    return [...filtered, ...incidents];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, results, can]);

  useEffect(() => setCursor(0), [term]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commands[cursor]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog palette" role="dialog" aria-modal="true" aria-label="Busca universal">
        <div className="input-icon">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            className="input palette-input"
            placeholder="Digite um protocolo (PAE-…), local ou ação"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={commands[cursor] ? `cmd-${commands[cursor]?.id}` : undefined}
            aria-autocomplete="list"
          />
        </div>
        <ul className="palette-list" id={listId} role="listbox">
          {commands.length === 0 ? <li className="subtle" style={{ padding: 16 }}>Nenhum resultado para “{term}”.</li> : null}
          {commands.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.id} role="presentation">
                {header ? <div className="palette-group">{header}</div> : null}
                <div
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === cursor}
                  className="palette-item"
                  onMouseEnter={() => setCursor(i)}
                  onClick={c.run}
                >
                  <Icon name={c.icon} />
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 600 }}>{c.label}</span>
                    {c.hint ? <span className="subtle">{c.hint}</span> : null}
                  </span>
                  {i === cursor ? <Icon name="arrowRight" size={16} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="dialog-foot" style={{ justifyContent: 'space-between' }}>
          <span className="subtle">
            <kbd>↑</kbd> <kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir · <kbd>Esc</kbd> fechar
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
