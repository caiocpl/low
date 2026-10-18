import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SireRepository } from '../data/repository';
import { MockRepository } from '../data/mock/MockRepository';
import type { Actor, Catalog, Role } from '../domain/types';
import { can, ROLE_LABEL, type Permission } from '../domain/permissions';
import { toUserMessage } from '../data/errors';

// ---------------------------------------------------------------- repositório

const RepoContext = createContext<SireRepository | null>(null);

/** Latência simulada para tornar visíveis os estados de carregamento (0 em testes). */
const DEMO_LATENCY_MS = 220;

export function createDefaultRepository(): SireRepository {
  return new MockRepository({ latencyMs: DEMO_LATENCY_MS });
}

export function RepositoryProvider({ repo, children }: { repo: SireRepository; children: ReactNode }) {
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): SireRepository {
  const r = useContext(RepoContext);
  if (!r) throw new Error('useRepo fora de RepositoryProvider');
  return r;
}

// ---------------------------------------------------------------- sessão (perfil demo)

const ROLE_KEY = 'sire.demo.role';

/** Usuários fictícios por perfil — AUTENTICAÇÃO SIMULADA, não é controle de acesso real. */
const DEMO_USERS: Record<Role, Actor> = {
  OPERADOR: { userId: 'demo-op', name: 'Lia Monteiro (demo)', role: 'OPERADOR' },
  COORDENADOR: { userId: 'demo-co', name: 'Hélio Batista (demo)', role: 'COORDENADOR' },
  INSPETOR: { userId: 'demo-in', name: 'Caio Rangel (demo)', role: 'INSPETOR' },
  ADMIN: { userId: 'demo-ad', name: 'Administração (demo)', role: 'ADMIN' },
  VISUALIZADOR: { userId: 'demo-vi', name: 'Visitante (demo)', role: 'VISUALIZADOR' },
};

interface Session {
  actor: Actor;
  setRole: (r: Role) => void;
  can: (p: Permission) => boolean;
  roleLabel: string;
}

const SessionContext = createContext<Session | null>(null);

function readRole(): Role {
  try {
    const v = window.localStorage.getItem(ROLE_KEY) as Role | null;
    if (v && v in DEMO_USERS) return v;
  } catch {
    /* armazenamento bloqueado: usa padrão */
  }
  return 'OPERADOR';
}

export function SessionProvider({ children, initialRole }: { children: ReactNode; initialRole?: Role }) {
  const [role, setRoleState] = useState<Role>(() => initialRole ?? readRole());
  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      window.localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignora */
    }
  }, []);
  const value = useMemo<Session>(
    () => ({ actor: DEMO_USERS[role], setRole, can: (p) => can(role, p), roleLabel: ROLE_LABEL[role] }),
    [role, setRole],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession fora de SessionProvider');
  return s;
}

// ---------------------------------------------------------------- hooks de dados

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Carrega dados do repositório e recarrega automaticamente quando há gravação
 * (inclusive em outra aba). Mantém o último dado durante recargas para evitar "piscar".
 */
export function useRepoQuery<T>(fn: (repo: SireRepository) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const repo = useRepo();
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => repo.subscribe(() => setTick((t) => t + 1)), [repo]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fnRef
      .current(repo)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState((s) => ({ data: s.data, error: toUserMessage(e), loading: false })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useCatalog(): AsyncState<Catalog> {
  return useRepoQuery((r) => r.getCatalog(), []);
}

/**
 * Executa uma mutação com proteção contra envio duplo: enquanto `pending`,
 * novas chamadas são ignoradas (o botão também fica desabilitado).
 */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      return await fnRef.current(...args);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);
  return { run, pending };
}

/** Atualiza "agora" periodicamente (contadores relativos, idade de ocorrências). */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
