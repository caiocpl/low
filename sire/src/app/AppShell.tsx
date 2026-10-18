import { useEffect, useState, type ReactNode } from 'react';
import { Link, navigate, useLocation } from './router';
import { Icon, type IconName } from '../ui/Icon';
import { useRepoQuery, useSession } from './services';
import { ALL_ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from '../domain/permissions';
import type { Role } from '../domain/types';
import { CommandPalette } from './CommandPalette';
import { ContactsDrawer } from '../features/contacts/ContactsDrawer';
import { isActive } from '../domain/status';
import { useToast } from '../ui/Toast';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  match: (path: string) => boolean;
  tag?: string;
  count?: number;
}

export const DEMO_NOTICE = 'Projeto demonstrativo · Dados fictícios · Não oficial';

export function AppShell({ children }: { children: ReactNode }) {
  const { path } = useLocation();
  const { actor, setRole, roleLabel, can } = useSession();
  const toast = useToast();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const active = useRepoQuery(async (r) => (await r.getOperationalDataset()).incidents.filter((i) => !i.isDeleted && isActive(i.status)).length, []);

  useEffect(() => setNavOpen(false), [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'n' && !typing) {
        e.preventDefault();
        navigate('/ocorrencias/nova');
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sections: { label: string; items: NavItem[] }[] = [
    {
      label: 'Resposta à emergência',
      items: [
        { to: '/', label: 'Central de operações', icon: 'dashboard', match: (p) => p === '/' },
        { to: '/ocorrencias/nova', label: 'Novo chamado', icon: 'plus', match: (p) => p === '/ocorrencias/nova' },
        { to: '/ocorrencias', label: 'Ocorrências', icon: 'list', match: (p) => p.startsWith('/ocorrencias') && p !== '/ocorrencias/nova', count: active.data },
        { to: '/turnos', label: 'Registro de turno', icon: 'calendar', match: (p) => p.startsWith('/turnos'), tag: 'Etapa 3' },
      ],
    },
    {
      label: 'Prontidão SPE/SHP',
      items: [
        { to: '/prontidao', label: 'Prontidão preventiva', icon: 'extinguisher', match: (p) => p.startsWith('/prontidao'), tag: 'Etapa 4' },
      ],
    },
    {
      label: 'Dados e governança',
      items: [
        { to: '/qualidade', label: 'Qualidade dos dados', icon: 'quality', match: (p) => p.startsWith('/qualidade'), tag: 'Etapa 4' },
        { to: '/integracao', label: 'Integração Power BI', icon: 'database', match: (p) => p.startsWith('/integracao') },
        { to: '/admin', label: 'Administração', icon: 'settings', match: (p) => p.startsWith('/admin') },
      ],
    },
  ];

  const initials = actor.name
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  const onRole = (r: Role) => {
    setRole(r);
    toast.info(`Perfil alterado para ${ROLE_LABEL[r]}`, ROLE_DESCRIPTION[r]);
  };

  return (
    <>
      <a href="#conteudo" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>
        Pular para o conteúdo
      </a>
      <div className="demo-banner" role="note" data-testid="demo-banner">
        <Icon name="info" size={14} />
        {DEMO_NOTICE}
      </div>
      <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
        <aside className="sidebar" aria-label="Menu principal">
          <Link to="/" className="brand" aria-label="SIRE — página inicial">
            <span className="brand-mark" aria-hidden>
              <Icon name="siren" size={20} />
            </span>
            <span>
              <span className="brand-name">SIRE</span>
              <span className="brand-sub" style={{ display: 'block' }}>
                Sistema Integrado de
                <br />
                Resposta à Emergência
              </span>
            </span>
          </Link>
          <nav>
            {sections.map((s) => (
              <div className="nav-section" key={s.label}>
                <div className="nav-label">{s.label}</div>
                {s.items.map((it) => (
                  <Link key={it.to} to={it.to} className="nav-link" aria-current={it.match(path) ? 'page' : undefined}>
                    <Icon name={it.icon} />
                    <span>{it.label}</span>
                    {it.count ? (
                      <span className="nav-count" aria-label={`${it.count} ativas`}>
                        {it.count}
                      </span>
                    ) : null}
                    {it.tag ? <span className="nav-tag">{it.tag}</span> : null}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            SIRE v0.1 · demonstração local
            <br />
            Fonte de dados: navegador (MockRepository)
            <br />
            Publicação Power Apps: pendente
          </div>
        </aside>
        <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />
        <div className="main">
          <header className="topbar">
            <button className="btn btn-ghost btn-icon menu-toggle" aria-label="Abrir menu" aria-expanded={navOpen} onClick={() => setNavOpen((v) => !v)}>
              <Icon name="menu" />
            </button>
            <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Busca universal (Ctrl+K)">
              <Icon name="search" />
              <span className="search-text">Buscar protocolo, local ou ação…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-spacer" />
            {can('contacts.view') ? (
              <button className="btn btn-secondary" onClick={() => setContactsOpen(true)} aria-label="Contatos de emergência (fictícios)">
                <Icon name="phone" />
                <span className="search-text">Contatos</span>
              </button>
            ) : null}
            <div className="role-switch">
              <label className="role-label subtle" htmlFor="role-select">
                Perfil
              </label>
              <select id="role-select" value={actor.role} onChange={(e) => onRole(e.target.value as Role)} aria-describedby="role-mock" data-testid="role-select">
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <span className="mock-chip" id="role-mock" title="Autenticação simulada para demonstração — não é controle de acesso real">
                login simulado
              </span>
              <span className="avatar" title={`${actor.name} · ${roleLabel}`} aria-hidden>
                {initials}
              </span>
            </div>
          </header>
          <main id="conteudo" className="content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ContactsDrawer open={contactsOpen} onClose={() => setContactsOpen(false)} />
    </>
  );
}
