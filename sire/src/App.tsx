import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { matchPath, useLocation } from './app/router';
import { AppShell } from './app/AppShell';
import { RepositoryProvider, SessionProvider } from './app/services';
import type { SireRepository } from './data/repository';
import type { Role } from './domain/types';
import { ToastProvider } from './ui/Toast';
import { EmptyState } from './ui/feedback';
import { OperationsCenterPage } from './features/operations/OperationsCenterPage';
import { IncidentListPage } from './features/incidents/IncidentListPage';
import { NewIncidentPage } from './features/incidents/NewIncidentPage';
import { IncidentDetailPage } from './features/incidents/IncidentDetailPage';
import { IntegrationPage } from './features/integration/IntegrationPage';
import { AdminPage } from './features/admin/AdminPage';
import { PlannedModulePage } from './features/planned/PlannedModulePage';
import { Link } from './app/router';

const TITLES: [string, string][] = [
  ['/', 'Central de operações'],
  ['/ocorrencias/nova', 'Novo chamado'],
  ['/ocorrencias/:id', 'Ocorrência'],
  ['/ocorrencias', 'Ocorrências'],
  ['/integracao', 'Integração Power BI'],
  ['/admin', 'Administração'],
  ['/turnos', 'Registro de turno'],
  ['/prontidao', 'Prontidão SPE/SHP'],
  ['/qualidade', 'Qualidade dos dados'],
];

function Routes() {
  const { path } = useLocation();
  useEffect(() => {
    const t = TITLES.find(([p]) => matchPath(p, path))?.[1] ?? 'Página não encontrada';
    document.title = `${t} · SIRE (demo)`;
    window.scrollTo({ top: 0 });
  }, [path]);

  if (path === '/') return <OperationsCenterPage />;
  if (path === '/ocorrencias') return <IncidentListPage />;
  if (path === '/ocorrencias/nova') return <NewIncidentPage />;
  const detail = matchPath('/ocorrencias/:id', path);
  if (detail?.id) return <IncidentDetailPage key={detail.id} id={detail.id} />;
  if (path === '/integracao') return <IntegrationPage />;
  if (path === '/admin') return <AdminPage />;
  if (path === '/turnos') return <PlannedModulePage module="turnos" />;
  if (path === '/prontidao') return <PlannedModulePage module="prontidao" />;
  if (path === '/qualidade') return <PlannedModulePage module="qualidade" />;
  return (
    <div className="card">
      <EmptyState icon="search" title="Página não encontrada" action={<Link to="/" className="btn btn-primary">Ir para a Central</Link>}>
        O endereço “{path}” não existe nesta demonstração.
      </EmptyState>
    </div>
  );
}

/** Captura falhas inesperadas de renderização sem expor detalhes técnicos ao operador. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha de renderização', error, info.componentStack);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="card" style={{ margin: 24 }}>
          <EmptyState icon="alert" title="Algo deu errado nesta tela" action={<button className="btn btn-primary" onClick={() => { this.setState({ failed: false }); window.location.hash = '#/'; }}>Voltar à Central</button>}>
            Nenhum dado foi perdido: as gravações já confirmadas permanecem salvas.
          </EmptyState>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App({ repo, initialRole }: { repo: SireRepository; initialRole?: Role }) {
  return (
    <RepositoryProvider repo={repo}>
      <SessionProvider initialRole={initialRole}>
        <ToastProvider>
          <AppShell>
            <ErrorBoundary>
              <Routes />
            </ErrorBoundary>
          </AppShell>
        </ToastProvider>
      </SessionProvider>
    </RepositoryProvider>
  );
}
