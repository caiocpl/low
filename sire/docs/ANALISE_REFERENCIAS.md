# Análise das Referências — SIRE

> **Projeto demonstrativo independente · dados fictícios · não oficial.**
> Este documento analisa padrões **funcionais e visuais** de três apresentações de referência.
> Por limite do projeto, **não transcreve** nomes de pessoas, telefones, ramais, números SAP,
> números de equipamentos, rotas/locais reais nem quantitativos operacionais. Onde um dado
> real aparece nas capturas, ele é citado apenas como *"valor real omitido"*.

**Legenda de classificação**

| Código | Significado |
|---|---|
| **[E]** | Evidência observada diretamente no slide, captura ou nota |
| **[I]** | Inferência a partir da evidência (não confirmada) |
| **[P]** | Nova proposta do SIRE (não existe na referência) |

---

## 1. Inventário de materiais

| Arquivo | Slides | Conteúdo predominante | Notas do apresentador |
|---|---|---|---|
| `APP Gestão de Atendimentos.pptx` | 6 | Antes × depois das telas + 14 imagens (capturas, PDF, mapa) | Só numeração (sem conteúdo) |
| `APP SPE_SHP.pptx` | 13 | **Somente capturas de tela** (1 por slide, ~1910×940 px), sem texto editável | Não há |
| `APP - SHP_SPE - Gerência (1).pptx` | 16 | Narrativa executiva, KPIs, matriz de indicadores, pontos de qualidade de dados; capturas recortadas | Ricas: explicam cada tela, contas e ressalvas |

Os PPTX **não são versionados** neste repositório (contêm dados pessoais/operacionais reais). Coloque-os localmente em `referencias/` — a pasta ignora `*.pptx` via `.gitignore`.

---

## 2. Inventário slide a slide

### 2.1 `APP Gestão de Atendimentos.pptx` — domínio **Resposta à Ocorrência**

| # | Título | O que se observa | Campos / elementos literais | Class. |
|---|---|---|---|---|
| 1 | Capa | "4 frentes de melhoria", "+ configurações parametrizáveis", "PDF layout modernizado", "APP mais configurável, rastreável e padronizado" | — | [E] |
| 2 | Resumo das melhorias | 4 frentes: **Protocolo** (pré-atendimento configurável e e-mail padronizado), **Ocorrências** (novos campos, histórico ampliado, contatos rápidos), **Impressão** (PDF com registro fotográfico), **Registro diário** (cadastros, assinaturas, dashboard com mapa) | — | [E] |
| 3 | Tela protocolo de acionamento (antes × depois) | Cabeçalho "Plano de Atendimento à Emergência (PAE) · Protocolo de Acionamento · Central de Emergência"; Data/Hora do chamado e Receptor automáticos; bloco "PRÉ ATENDIMENTO" | `Qual é a EMERGÊNCIA?` · `O Que ACONTECEU?` (lista: ex. "Ocorrência com vítima", "Despacho de Recursos Resgate em Altura") · `Observações` (orientações numeradas por hipótese) · `Dados de Localidade` → `Qual o LOCAL DA OCORRÊNCIA?` (formato *Macroárea \| Local*) + `Ponto de referência` · `Dados da Vítima` → `Há VÍTIMAS?` (toggle) · `Quantas?` · `Qual estado da(s) vítima(s)?` · `Dados do Solicitante/Denunciante` → `Telefone`, `Nome completo` · `Descrição do Incidente` (novo) · painéis `VIATURAS`, `RECURSOS HUMANOS`, `ACIONAMENTOS` (lista de contatos com telefone) · `Acionar a base:` / `Base mais próxima:` (sugerida pelo local) · grade `Acionamentos:` com hora:minuto por órgão (≈12 siglas internas) · botão `Salvar / Continuar` | [E] |
| 3 | (cont.) | "Despacho de recursos inteligente conforme hipótese acidental", "fluxo automatizado de comunicação do atendimento por e-mail", "Acionamento inteligente e configurável" | Viaturas e RH sugeridos com quantidade (ex. "01 Auto Combate Rápido", "04 Bombeiros Profissionais Civis") | [E] |
| 4 | Tela formulário de ocorrências | Barra: `Salvar`, `Finalizar`, `Protocolo`, `Relatório`, `Contatos` (novo), `Orientações` (novo); `OC Nº`, `Receptor`, `Status: ABERTA`; título "OCORRÊNCIAS" | **Dados do solicitante**: Nome Completo, Telefone · **Dados do local**: Macro Área, Local, Coordenadas (+ link de mapa externo) · **Fases** (novo): Fase Reativa / Fase Proativa · **Dados da ocorrência**: Equipe, Base Responsável, Tipo de Ocorrência, Classificação, Desdobramento, Agente Extintor, Qtd Utilizada, Área Afetada, Produtos Químicos Envolvidos, Item PAE, `OC Atendida?`, `Anexar imagens` · **Abas**: Deslocamentos, Veículos, Efetivo, Vítimas, Testemunhas (novo), Outros Recursos · Deslocamentos: Veículo, Tipo do Deslocamento, Data/Hora · **Evolução da ocorrência** (antes): faixas 20 min / 30 min / 40 min / 1 h / maior 1 h · **Acionamentos** (depois): grade hora:minuto por órgão | [E] |
| 4 | (cont.) | Modal de contatos com busca; seções "Comando do Incidente" e "Seção de Operações"; colunas Função, Ocupação (Titular/Suplente), Nome, Celular, Ramal | Dados pessoais reais — **omitidos** | [E] |
| 5 | Tela de impressão | PDF "Emergência Industrial — Relatório de Atendimento à Ocorrência" (antes e depois) | Cabeçalho: Ocorrência Nº, Data/Hora · Tipo de Ocorrência, Tipo de Atendimento, Categoria, Classificação · Macro Área, Micro Área, Local, Base Responsável, Produtos Químicos · **Tempo resposta**: Acionamento, Despacho, Saída da Base, Chegada no Local, Início do Atendimento, Término do Atendimento, Saída do Local, Chegada na Base, Km Inicial, Km Final, Velocidade Média, Tempo de Percurso, Tempo de Atendimento, Tempo da Ocorrência, Tempo da Resposta · **Recursos utilizados**: Veículos de Emergência, Equip. de Combate a Incêndio, Equip. de Resgate e Salvamento, EPI, Equipe de Atendimento, Suporte, Outros Recursos, Agente Extintor, Qtd. Utilizada, Área Afetada · **Dados das vítimas**: Nome, Cargo/Função, Empresa · **Histórico da ocorrência** (texto livre) · **Registro fotográfico** em grade 2×2 com legenda por foto | [E] |
| 5 | (cont.) | Um exemplo "antes" exibe valores de tempo incoerentes (ex. tempo de percurso no formato `00:89`) | — | [E] → motiva validação de durações [P] |
| 6 | Tela de registro diário (NOVO) | Lista de registros por Base/Equipe/Data com status "Em aberto", contadores "Em aberto / Disponível para assinar / Assinado(s)", filtros Base, Equipe, Status, Período; botões "Baixar Relatório", "Adicionar Registro Diário" | **Registro Diário**: Base, Equipe, Data · *Quadro de Ativos*: Adicionar Empregado / Adicionar Viatura; Empregado + Início do Turno (com encerramento individual) · *Informações de Troca de Turno*: Atividades da Equipe*, Intercorrências* · *Atividades Pendentes*: ID, Solicitante, Criada · botões Salvar / Finalizar Turno | [E] |
| 6 | (cont.) | PDF "Posto de Trabalho Atendimento a Emergência" | Descrição do posto (Nome, Data, Localização, Operação, Gestor) · Informações gerais · **Quadro efetivo** (Tipo, Pessoa, Entrada, Saída, Turno, Status do turno) · Intercorrências · **Assinatura do Fiscal** e **do Coordenador** (nome + data da assinatura) | [E] |
| 6 | (cont.) | "Dashboard — Mapa de Equipamentos" (Power BI): calendário, filtro Base, mapa satélite com bases/postos, painel "Detalhes do Posto", "Empregados" (função), "Viaturas" (placa, tanque água/espuma, GPM) | Imagem satélite real — **não reproduzir** | [E] |

### 2.2 `APP SPE_SHP.pptx` — domínio **Prontidão / Prevenção** (somente capturas)

| # | Tela | Elementos observados | Class. |
|---|---|---|---|
| 1 | Login | Logo do app, "Login", campos usuário/senha, botão "Edição", rodapé "Versão … – Produção" | [E] |
| 2 | Seleção de tipo | "Selecione o tipo de equipamento": **Extintores** / **Hidrantes/Abrigos** | [E] |
| 3 | Controle de delegação das bases | Modal "Status de carregamento": cards por coleção (Extintores, Hidrantes/Abrigos, Mangueiras, Equipamentos unificados *(derivada)*, Inspeções, Rotas internas, Cenários, Rotas SAP) com contagem, "Completo" e "Batches x/y" | [E] — contagens reais omitidas |
| 4 | Menu do módulo SPE | "Sistema Proteção por Extintores": CHECKLIST, Seleção de relatórios, Visualizar Rotas, Visualizar Programações, Visualizar Equipamentos, Pendências, QR Code | [E] |
| 5 | Checklist — estado vazio | Filtros: Equipe, Plano de Inspeção, Range semanas, Funcionários, Buscar, "Equip. Vencidos no Plano", "Restrição", "Aplicar filtros"; mensagem "Selecione a Equipe!" | [E] |
| 6 | Checklist — cards | Card numerado por equipamento: identificação, status **Atenção/Regular**, selo **Área restrita**, Nº Selo, Nº SAP, Carga, Fabricação, Reteste, Recarga, Validade, Localização; datas vencidas em vermelho; botões "Imprimir Inspeção SPE", "Salvar", "Legenda"; status "Em execução" | [E] |
| 7 | Checklist do equipamento | Cabeçalho editável: Descrição do Local, Nº Fabricação, Nº Selo, Nº Cadastro, Tipo de Carga, Carga Nominal, Fabricante, Reteste, Recarga · **Condições avaliadas**: Suporte, Sinalização, Acesso a Limpeza, Capa Protetora, Condição de Pintura, Etiqueta (lista continua — **não legível além da rolagem**) · opções **Ok – Conforme / NC – Não Conforme / NA – Não se Aplica** | [E] |
| 8 | Quadro Resumo | Nº Equipamentos, Nº Rotas, Pendências de inspeção; "Quantidade equipamentos a serem trocados" por Tipo de Carga × Capacidade × Qtd; toggle Tabela | [E] |
| 9 | Seleção de relatórios | Inspeção · Movimentação · HHT | [E] |
| 10 | Visualizar Rotas | Filtros Status, Área da rota, Buscar (Item manutenção, título, nome); "Adicionar Rota", "Atualizar"; card: tags ROTA / Sem restrição / N equipamentos, título, Item e Plano, **Área/Edificação, Centro manutenção, Centro trabalho** (vazios "-"), Descrição, lista "Equipamentos vinculados" (carga, validade). Uma rota com **0 equipamentos** | [E] |
| 11 | Programações – Kanban | Busca, Legenda, "Scroll Kanban 1/3", "Atualizar", "Adicionar Plano SAP"; coluna "Realizar Programação" (contém card **[TESTE-DEV-IGNORAR]** em produção); colunas **S+1 / S+2** com semana e intervalo; card: tags Programada / Oficializada / Sem restrição, Qtd. Equip., Equipe, Data progr., Data limite, Área/Edificação (vazia "/"), Descrição, **Oficializado por**, ação **Reprogramar demanda** | [E] |
| 12 | Visualizar Equipamentos | Título com total de unidades; "Adicionar Equipamento", filtro Status, busca por nº de cadastro, toggle Tabela; colunas TipoEquipamento, N_Cadastro, N_SAP, N_Fabricante, TipoCarga, Data_Reteste, Validade, Situação (Em uso / Disponível), **Longitude (vazia)**, Edificação; contador "Linhas" | [E] |
| 13 | Pendências – Kanban | "Gerar Rota", "Registros: N", filtro calendário; card de pendência: Nome, Área, Edificação, Tipo, Nº Cadastro, Circuito, Data de Recarga, Local, **Dias a vencer (negativos)**, Validade; seleção por card | [E] |

### 2.3 `APP - SHP_SPE - Gerência (1).pptx` — domínio **Prontidão / Gestão**

| # | Tema | Conteúdo relevante (sem números reais) | Class. |
|---|---|---|---|
| 1–2 | Capa | App em produção integra programação, execução e rastreabilidade de inspeções de extintores (SPE) e hidrantes/abrigos (SHP) com relatórios/indicadores automáticos | [E] |
| 3 | Sumário executivo | 4 pilares: Programação (rotas, Kanban S+1/S+2, pendências ↔ plano SAP), Execução (OK/NC/NA, status e restrições), Rastreabilidade (base única + relatórios Inspeção/Movimentação/HHT), Indicadores (Curva S, 52 semanas, desvios R$, HHT, status SHP no mapa) | [E] |
| 4 | Ciclo do app | 01 Base de dados → 02 Programação → 03 Execução (QR Code, Quadro Resumo) → 04 Rastreabilidade → 05 Indicadores; "Dois sistemas no mesmo app": SPE e SHP (hidrantes, abrigos, mangueiras) | [E] |
| 5 | Base de dados | Totais por coleção; lotes validados como **condição para operar os dados**; "equipamentos unificados" = soma de 3 bases | [E] |
| 6 | Programação/rotas | Rota ligada a item/plano SAP; equipamentos vinculados; **ponto de atenção: rota com 0 equipamentos; área/centros vazios** | [E] |
| 7 | Kanban | Horizonte S+1/S+2; card com qtd, equipe, data programada, data limite; **oficialização rastreável (quem)**; reprogramação no card; card de teste omitido do recorte | [E] |
| 8 | Pendências | Contador; passivo vencido com "dias a vencer" negativos; **Gerar Rota** a partir de pendências selecionadas; rota entra no Kanban | [E] |
| 9 | Execução | Filtros do plano; atalhos de risco (restrições, vencidos); status por cor; área restrita sinalizada; Quadro Resumo; salvar/imprimir | [E] |
| 10 | Checklist | Ficha do equipamento; condições avaliadas; OK/NC/NA. Nota: *"Validar essa ligação [NC → desvios → R$] com o responsável pelos indicadores"* | [E] — ligação NC→R$ é **[I] não validada** |
| 11 | Quadro resumo | Equipamentos a trocar por tipo de carga; preparo de reposição antes da ida a campo | [E] |
| 12 | Rastreabilidade | Cadastro, busca/filtro, ficha em tabela; total da tabela = total da coleção (**checagem de integridade**) | [E] |
| 13 | Indicadores | (1) Previsto × Realizado — Curva S com baseline, realizado e projetado em reprogramação; (2) 52 semanas por área/circuito/área de negócio; (3) inspeções, desvios, valor dos desvios (R$), HHT por circuito/rota; (4) SHP: operante / operante c/ restrições / inoperante + mapa georreferenciado | [E] |
| 14 | Matriz de indicadores | Indicador × segmentação (período, área, circuito/rota, área de negócio) × origem no app. Nota: *"A coluna 'Origem no app' deve ser validada"* | [E] / origem **[I]** |
| 15 | Próximos passos | 4 problemas de dados: **campos de área vazios**, **coordenadas sem valor**, **registro de teste em produção**, **rota sem equipamentos**; propostas: saneamento cadastral, remover testes, oficializar baseline da Curva S, rito de acompanhamento | [E] |
| 16 | Encerramento | — | [E] |

**Itens ilegíveis ou incompletos (não transcritos):** lista completa de "Condições avaliadas" do checklist (corta em "Etiqueta"); conteúdo da coluna "Edificação" na tabela (corte horizontal); demais páginas do Kanban (2/3 e 3/3); seção "Seção de Operações" do modal de contatos (corte); legendas dos ícones "Legenda".

---

## 3. Fluxos originais reconstruídos

### 3.1 Gestão de Atendimentos (resposta)
```
Chamado recebido → [Pré-atendimento/Protocolo PAE]
  • Data/hora e receptor automáticos
  • "O que aconteceu?" seleciona hipótese → mostra Observações + sugere Viaturas/RH/Acionamentos   [E]
  • Local (Macroárea | Local) → sugere "Base mais próxima"                                      [E]
  • Vítimas, solicitante, descrição                                                             [E]
  • Registra horários de acionamento por órgão                                                  [E]
  • Salvar / Continuar → abre Ocorrência (OC Nº, Status ABERTA)                                 [E]
→ [Ocorrência] dados do local, equipe, base, tipo, classificação, desdobramento, recursos,
  abas Deslocamentos/Veículos/Efetivo/Vítimas/Testemunhas/Outros recursos, fases reativa/proativa,
  anexos, "OC atendida?"                                                                        [E]
→ Finalizar → Relatório PDF (tempos, recursos, vítimas, histórico, fotos)                       [E]
→ e-mail padronizado de comunicação (automatizado)                                              [E]
```
Estados formais além de "ABERTA" **não aparecem** nas capturas → ciclo de status do SIRE é **[P]**.

### 3.2 SPE/SHP (prontidão)
```
Base carregada e validada → Rotas (ligadas a plano SAP) → Programação semanal (Kanban S+1/S+2,
oficialização, reprogramação) → Execução (checklist OK/NC/NA por equipamento, quadro resumo)
→ Pendências (NC/vencidos) → Gerar Rota → volta à programação → Relatórios e Indicadores      [E]
```

### 3.3 Registro diário de turno
```
Abrir registro (Base, Equipe, Data) → Quadro de ativos (empregados, viaturas, início/fim de turno)
→ Troca de turno (atividades, intercorrências, pendências) → Finalizar turno
→ Disponível para assinar → Assinaturas (fiscal, coordenador) → PDF do posto                   [E]/[I]
```

---

## 4. Lacunas identificadas

| # | Lacuna | Evidência | Impacto | Tratamento no SIRE |
|---|---|---|---|---|
| L1 | Sem ciclo de status explícito da ocorrência (só "ABERTA") | Slide 4 | Rastreabilidade e indicadores de tempo ambíguos | Máquina de estados com histórico imutável [P] |
| L2 | Tempos calculados sem regra documentada; exemplo com minuto "89" | Slide 5 | Indicadores não confiáveis | Definições parametrizáveis + validação de sequência [P] |
| L3 | Rascunho × ocorrência registrada indistintos ("Salvar/Continuar") | Slide 3 | Registro parcial confundido com final | Botões distintos com semântica e status próprio [P] |
| L4 | Contatos reais com telefone embutidos na tela | Slides 3–4 | Exposição de dados pessoais | Diretório fictício, sem discagem [P] |
| L5 | Coordenadas digitadas / link externo de mapa | Slide 4 | Erro de posição, dependência externa | Mapa esquemático sintético + fallback "Localização não informada" [P] |
| L6 | Área/centros vazios, coordenadas vazias, registro de teste em produção, rota sem ativos | Gerência 6, 7, 12, 15 | Segmentação de indicadores e mapa comprometidos | Tela **Qualidade dos Dados** com regras e sugestões [P] |
| L7 | Origem/cálculo de indicadores pendente de validação | Gerência 10, 14 | Risco de indicador sem lastro | Contrato Power BI com premissas explícitas; "Sem dados" em vez de zero [P] |
| L8 | Assinaturas sem garantia declarada | Atend. 6 | Falsa sensação de validade jurídica | Assinatura **simulada** e rotulada [P] |
| L9 | Ausência de perfis/permissões visíveis | Todas | Controle de acesso indefinido | 5 perfis + autorização na camada de dados [P] |
| L10 | Login próprio com usuário/senha | SPE 1 | Credenciais fora do Entra ID | Em produção: identidade Power Platform; na demo: perfil mock rotulado [P] |

---

## 5. Preservar · Melhorar · Não reproduzir

| Preservar (valor comprovado) | Melhorar | Não reproduzir |
|---|---|---|
| Hipótese acidental guiando orientações e recursos sugeridos | Sugestão **nunca executa** sem confirmação humana | Logotipos, brasões e fotos institucionais |
| Base sugerida a partir do local | Explicitar "sugestão ilustrativa" | Nomes, telefones, ramais, siglas internas reais de órgãos |
| Horários de acionamento por órgão | Lista de órgãos **configurável** e fictícia | Números SAP, de equipamentos, de planos e OMs |
| Abas operacionais (deslocamentos, viaturas, efetivo, vítimas, testemunhas, outros recursos) | Timeline única, validação cronológica | Imagens de satélite / locais / rotas reais |
| PDF com tempos, recursos, histórico e fotos | Marca "DEMONSTRAÇÃO", fotos sintéticas, assinatura demo | Quantitativos reais (registros, equipamentos, pendências) |
| Fases reativa/proativa | Definição documentada e parametrizável | Card de teste em produção |
| Kanban S+1/S+2, oficialização rastreável, reprogramação | Estados normalizados e trilha de origem | Login com senha própria |
| Checklist OK/NC/NA, quadro resumo, pendências → rota | NC gera pendência com rastreio | — |
| Indicadores em 4 blocos | Premissas de custo sintéticas e explícitas | — |

---

## 6. Distinção de domínios (decisão de modelagem)

| | **Gestão de Atendimentos** | **Prontidão SPE/SHP** |
|---|---|---|
| Natureza | Reativa — uma ocorrência | Preventiva — um ativo/inspeção |
| Unidade de registro | `Incident` | `Asset`, `Inspection` |
| Ciclo | Chamado → triagem → mobilização → atendimento → encerramento | Ativo → rota → programação → inspeção → pendência → indicador |
| Tabelas compartilhadas | `Area`, `Location`, `Base`, `Team`, `AppUserRole`, `AuditLog` | idem |
| Tabelas exclusivas | `Incident*`, `Dispatch`, `Victim`, `Witness`… | `Inspection*`, `InspectionRoute`, `PendingAction`… |

As duas frentes compartilham **apenas dimensões** (área, base, equipe, usuário) e a auditoria; fatos nunca se misturam.

A matriz origem → requisito → entidade → tela → teste está em [`MATRIZ_RASTREABILIDADE.md`](./MATRIZ_RASTREABILIDADE.md).
