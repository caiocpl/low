# 06 · Versão Figma e handoff

**Arquivo:** https://www.figma.com/design/VShQg8NPH0XYa7EZchkQYY
**Plano:** Starter (limite de 3 páginas por arquivo; por isso a organização usa 3 páginas com seções nomeadas, não 5).

## 1. Organização do arquivo

| Página do Figma | Conteúdo |
|---|---|
| 01 · Media Kit v4 · PT-BR e EN | 8 quadros A4 (595×842): linha de cima PT · 01 a 04; linha de baixo EN · 01 a 04 |
| 02 · Fundamentos e Componentes | Reservada para componentes destacados (ver §4) |
| 03 · Diagnóstico, referências, exportação e assets | Quadro `Assets` com os logos das 7 marcas embutidos (CapCut, Dreamina, Wav, Dola, Freebeat, Meshy; Runable em vetor) e área para as imagens colocadas pelo usuário |

## 2. Fundamentos criados (estilos locais)

**Cores (11 estilos de preenchimento):** Marca/Azul `#2F3CFF` · Marca/Preto `#0B0B14` · Texto/Corpo `#3A3F52` · Texto/Secundário `#5B6070` · Azul/300 `#8E97FF` · Azul/200 `#AEB5FF` · Azul/100 `#E4E7FF` · Neutro/Borda `#E3E6F0` · Neutro/Superfície `#F4F6FA` · Neutro/Branco · Fundo/Lavanda `#E9ECFF`. Todas extraídas do PDF 2026 (valores exatos dos vetores), nenhuma cor nova.

**Tipografia (14 estilos de texto, Inter):** Display/Headline Extra Bold 50/52 (reduzido de 62 para caber "Tecnologia e IA, funcionando na tela." em duas linhas na largura útil) · H1/Título de página Extra Bold 30/34 · Num/XL 44 · Num/L 28 · Num/M 17 · Num/Unidade Bold 12 · Texto/Subtítulo L 12,5/18 · Texto/Subtítulo M Semi Bold 11/14 · Texto/Corpo 9,5/13,5 · Texto/Corpo forte Semi Bold · Texto/Eyebrow Semi Bold 8 +12% · Texto/Rótulo Medium 8 · Texto/Nota 8/11 · CTA/Título Extra Bold 30/32.

**Grade:** margem 42 pt em todos os lados, largura útil 511 pt, colunas por Auto Layout (3 ou 4 cartões com `FILL` e espaçamento 10–12).

## 3. Como as páginas foram construídas

- Todo texto é editável e ligado a estilo de texto e de cor (nenhuma página é imagem).
- Cada quadro A4 é um Auto Layout vertical com `Header`, blocos de conteúdo, `Spacer` (cresce) e `Footer` fixo embaixo.
- Elementos nomeados por função: `Tile/Métrica`, `Tile/Plataforma`, `Card/Mediana`, `Ring/Demografia`, `Card/Trabalho principal`, `Card/Trabalho complementar`, `Item/Logo marca`, `Step/Processo`, `Card/Pacote`, `Nota/Condição`, `Bloco/CTA`.
- Links reais em texto: `@closertech1` → instagram.com/closertech1; e-mail → `mailto:`; `linktr.ee/closertech1`. A exportação em PDF do Figma preserva hyperlinks de texto.
- Gráfico de distribuição dos 25 Reels: 25 marcadores (9 / 9 / 7) desenhados como elipses, com os totais já publicados; nada foi reconstruído a partir de alturas de barras.
- Anéis de demografia: elipses com `arcData` (89 %, 82 %, 87 %) sobre anel Azul/100.
- Campos pendentes aparecem em laranja: `{período}` e `{URL do Reel}`. Há uma camada oculta "Fallback · usar se período não for confirmado" com a frase substituta.

## 4. O que fica para a produção final (por ordem)

1. **Imagens** — o ambiente desta sessão não consegue enviar arquivos ao Figma (upload bloqueado pela rede), então as imagens foram tratadas assim: os 6 logos de marca foram embutidos byte a byte com verificação de integridade; o retrato, o frame principal (Dola), os frames Wav e Meshy e a capa do YouTube ficam como molduras nomeadas `img:retrato`, `img:frame-dola`, `img:frame-wav`, `img:frame-meshy`, `img:thumb-capcut` (fundo Azul/100). Procedimento: arraste os arquivos de `assets/` para a página 03 e peça a conexão automática, ou selecione cada moldura e use *Place image* (Ctrl/Cmd+Shift+K).
2. **Logotipo** — `assets/logo-closertech-2026.svg` é o vetor real extraído do PDF 2026 (símbolo C + ponto azul + wordmark em Nunito já convertido em curvas). Molduras `logo:closertech` (104×17) em cada cabeçalho e `logo:runable` (22×22) na faixa de marcas recebem os SVGs do mesmo modo.
3. **Componentes** — depois de ligar as imagens, converter `Header`, `Footer`, `Tile/Métrica`, `Step/Processo` e `Card/Pacote` em componentes (selecionar → *Create component*) e mover para a página 02. Os nomes já seguem a convenção `Grupo/Nome`.
4. **Exportar** — selecionar os 4 quadros PT (ou EN) → *Export* → PDF; ou *File → Export frames to PDF* com a ordem das páginas. Verificar links no PDF.

## 5. Trocas de mídia e identidade (não aplicadas, só registradas)

- Ícones de plataforma: a versão 2026 usava bitmaps coloridos extraídos do PDF (o de TikTok com fundo chapado, descartado). No v4, as plataformas aparecem como nome + ponto na cor oficial. Se quiser ícones, usar os vetores oficiais de cada marca (não foi possível baixá-los nesta sessão).
- Nenhuma mudança de marca: azul, preto, branco, Inter e o logotipo 2026 foram mantidos.
