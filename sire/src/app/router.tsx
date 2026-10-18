/**
 * Roteador mínimo baseado em hash (#/rota). Sem dependências: compatível com hospedagem
 * estática do Power Apps Code App e evita a superfície de ataque de bibliotecas de roteamento.
 */
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export interface Location {
  path: string;
  query: URLSearchParams;
}

function parse(hash: string): Location {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path && path.startsWith('/') ? path : `/${path ?? ''}`, query: new URLSearchParams(qs ?? '') };
}

export function currentLocation(): Location {
  return parse(window.location.hash);
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = `#${to.startsWith('/') ? to : `/${to}`}`;
  if (opts.replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useLocation(): Location {
  const [loc, setLoc] = useState(currentLocation);
  useEffect(() => {
    const on = () => setLoc(currentLocation());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return loc;
}

/** Casa um padrão "/ocorrencias/:id" com o caminho; devolve os parâmetros ou null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i] as string;
    const val = s[i] as string;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const href = `#${to}`;
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
