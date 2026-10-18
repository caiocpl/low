import { PageHeader, Card } from '../../ui/layout';
import { Icon, type IconName } from '../../ui/Icon';

const MODULES: Record<string, { title: string; icon: IconName; stage: string; summary: string; items: string[]; refs: string }> = {
  turnos: {
    title: 'Registro diário de turno',
    icon: 'calendar',
    stage: 'Etapa 3',
    summary: 'Abertura e fechamento de turno por base e equipe, quadro de ativos (pessoas e viaturas fictícias), passagem de serviço e assinaturas simuladas.',
    items: [
      'Lista de registros com filtros por base, equipe, status e período (Em aberto · Disponível para assinar · Assinado)',
      'Quadro de ativos: incluir empregado/viatura, início e fim de turno individual',
      'Troca de turno: atividades da equipe, intercorrências e atividades pendentes',
      'Assinaturas do fiscal e da coordenação — SIMULADAS, sem validade jurídica',
      'PDF do posto de trabalho e mapa esquemático de bases/postos',
    ],
    refs: 'Referência: APP Gestão de Atendimentos, slide 6',
  },
  prontidao: {
    title: 'Prontidão preventiva SPE/SHP',
    icon: 'extinguisher',
    stage: 'Etapa 4',
    summary: 'Domínio complementar ao atendimento: ativos → rotas → programação → inspeção → pendências → indicadores. Registros separados das ocorrências.',
    items: [
      'Catálogo de extintores (SPE), hidrantes/abrigos e mangueiras (SHP) com códigos fictícios',
      'Rotas internas e associação simulada a planos de manutenção; alertas de rota sem ativos',
      'Kanban semanal S+1/S+2: Programada · Oficializada · Em execução · Concluída · Reprogramada',
      'Checklist OK / NC / NA por tipo de equipamento, quadro resumo e QR Code simulado',
      'Pendências (NC e vencimentos) agrupáveis em novas rotas, com trilha de origem',
      'Indicadores: previsto × realizado (Curva S), 52 semanas, desvios com premissas de custo sintéticas, HHT, status SHP',
    ],
    refs: 'Referências: APP SPE_SHP (13 telas) e APP SHP_SPE Gerência (16 slides)',
  },
  qualidade: {
    title: 'Qualidade dos dados',
    icon: 'quality',
    stage: 'Etapa 4',
    summary: 'Regras de qualidade de cadastro com sugestão de correção — nunca limpeza silenciosa.',
    items: [
      'Áreas, centros e áreas de negócio ausentes',
      'Coordenadas vazias (mapa usa lista alternativa)',
      'Registros de teste em ambiente de produção',
      'Rotas sem ativos e programações sem equipe',
      'Datas impossíveis, protocolos duplicados e vínculos quebrados',
    ],
    refs: 'Referência: APP SHP_SPE Gerência, slide 15 (pontos de atenção)',
  },
};

export function PlannedModulePage({ module }: { module: keyof typeof MODULES }) {
  const m = MODULES[module];
  if (!m) return null;
  return (
    <>
      <PageHeader crumbs={[{ label: 'Central', to: '/' }, { label: m.title }]} title={m.title} description={m.summary} />
      <Card title={`Planejado · ${m.stage}`} icon={m.icon} subtitle={m.refs}>
        <div className="stack">
          <div className="alert tone-info" role="status">
            <Icon name="info" />
            <div>
              Este módulo ainda <strong>não foi implementado</strong>. A Etapa 2 priorizou o fluxo completo de resposta à ocorrência. Escopo previsto:
            </div>
          </div>
          <ul className="check-list">
            {m.items.map((it) => (
              <li key={it}>
                <Icon name="clock" className="subtle" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}

export type PlannedModule = keyof typeof MODULES;
