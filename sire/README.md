# SIRE — Sistema Integrado de Resposta à Emergência (demo)

> **PROJETO DEMONSTRATIVO · DADOS FICTÍCIOS · NÃO OFICIAL**

App React + TypeScript + Vite, preparado como Power Apps Code App (`@microsoft/power-apps`).
Status: **demo local construída; publicação Power Apps pendente** (sem ambiente/credenciais). Power BI: integração futura (contrato de dados pronto em `src/data/export/integration.ts`).

## Como rodar
```bash
cd sire
npm install
npm run dev        # abre em http://127.0.0.1:3000
```
Build de produção: `npm run build` (gera `dist/`). Testes: `npm test` (unitários) e `npm run test:e2e` (Playwright).

## O que já funciona (Etapas 0–2)
- Central de operações: indicadores, fila ativa, alertas de incompletude, mapa esquemático fictício, últimos eventos.
- Novo chamado (PAE): rascunho × registro, protocolo `PAE-AAAA-NNNNNN`, UUID, idempotência (clique duplo não duplica), validações, orientações e recursos sugeridos (nunca executados sem confirmação).
- Ocorrência: status Rascunho → Registrada → Em triagem → Acionada → Em deslocamento → Em atendimento → Controlada → Encerrada (ou Cancelada com justificativa); marcos de tempo, viaturas, efetivo, vítimas (pseudônimos), testemunhas, outros recursos, acionamentos, anexos sintéticos, histórico e auditoria; checklist de encerramento; relatório PDF "DEMONSTRAÇÃO".
- Perfis simulados (Operador, Coordenador, Inspetor, Administrador, Visualizador) com permissão verificada na camada de dados.
- Integração: exportação CSV/JSON em modelo estrela para o Power BI.
- Administração: reiniciar demo, simular indisponibilidade.

## Pendente
Etapa 3 (turnos, parametrização editável), Etapa 4 (SPE/SHP e Qualidade dos dados), Etapa 5 (docs Dataverse/Power BI completos), publicação via `pa app init/push`.

Análise das referências: `docs/ANALISE_REFERENCIAS.md`.
