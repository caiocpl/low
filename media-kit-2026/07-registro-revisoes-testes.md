# 07 · Registro objetivo de revisões e testes

A pedido do cliente, as três perspectivas de revisão (A marca, B direção de arte, C factual/produção) foram feitas em uma única passagem ao final, sobre o PDF gerado a partir do mesmo projeto do Figma. Tudo abaixo foi executado; o que não foi testado está dito.

## 1. O que foi revisado e corrigido

| # | Perspectiva | Achado | Correção | Estado |
|---|---|---|---|---|
| 1 | B · arte | No Figma, textos de várias linhas ficaram com altura fixa e se sobrepuseram (ordem errada entre `resize` e `textAutoResize` no script) | Correção incluída em `figma/finalizar-v4.js` (altura automática em todos os textos) | Pendente de execução no Figma (ver §3) |
| 2 | B · arte | Marcadores da distribuição dos 25 Reels renderizados como texto no HTML (aspas escapadas no gerador) | Gerador corrigido; 25 marcadores (9/9/7) em três tons de azul | Corrigido e verificado |
| 3 | B · arte | Números dos indicadores quebrando linha na página 1 (cartões estreitos ao lado do retrato) | Indicadores movidos para uma linha de largura total abaixo do retrato; número 27 pt sem quebra | Corrigido e verificado |
| 4 | B · arte | "236,7 mil" quebrando no cartão do TikTok | Números das plataformas em 14 pt sem quebra, cartão com menos padding | Corrigido e verificado |
| 5 | B · arte | Página 4 excedia a altura A4 em 5 px | Espaçamento vertical da página 4 reduzido de 16 para 14 pt | Corrigido; medição automática: 4/4 páginas sem excesso em PT e EN |
| 6 | A · marca | Cores, Inter, logotipo 2026 em vetor, azul/preto/branco e fundos suaves | Nenhuma cor nova; logotipo reutilizado do vetor extraído, não redesenhado | Conforme |
| 7 | A · marca | Ícones de plataforma: bitmaps do PDF 2026 (TikTok com fundo chapado) | Substituídos por nome + ponto na cor da plataforma; decisão registrada no doc 06 §5 | Conforme, com alternativa anotada |
| 8 | C · factual | Toda afirmação numérica confere com a matriz (doc 03): 379 mil, ≈ 920 mil somando cinco perfis, 7 marcas, 21 mil mediana (25 Reels, 1 a 29/10/2026), 16/7/452 mil, 9/9/7, 89/82/87 % | Fontes e datas no rodapé de cada página; "25 mi+", "93 %" e "5,5 %" não aparecem | Conforme |
| 9 | C · factual | Campos sem confirmação | `{período}` e `{URL do Reel}` visíveis em laranja, propositalmente, até o Antônio confirmar (doc 08) | Aberto por dependência externa |
| 10 | C · produção | Links | 5 links por idioma: @closertech1 (p. 1 e 3), e-mail, Instagram e Linktree (p. 4) | Verificado no PDF (anotações de link contadas) |

## 2. Testes executados

| Teste | Método | Resultado |
|---|---|---|
| Páginas do PDF | pypdf | PT: 4 páginas · EN: 4 páginas |
| Links no PDF | contagem de anotações `/Link` | PT: 5 · EN: 5 |
| Excesso de altura | `scrollHeight > clientHeight` em cada página antes de imprimir | 0 páginas com excesso (PT e EN) |
| Tipografia | Inter 400–800 embutida por `@font-face` (woff2) | Fontes carregadas antes da impressão (`document.fonts.ready`) |
| Leitura em tela | capturas 2x de cada página em `revisao/v4-*.png` | Inspeção visual das 4 páginas PT (pp. 1–2 reinspecionadas após correções) |
| Leitura em celular | não testada em dispositivo | Pendente: abrir o PDF no celular e conferir os rodapés em 8 pt |
| Impressão | não testada | Pendente: imagens dos frames estão em 720×1280 (fonte original dos PDFs anteriores) |

## 3. Figma: estado real

- Arquivo com 3 páginas organizadas, 11 estilos de cor, 14 de texto, 8 pranchas A4 (PT e EN) em Auto Layout com texto editável, 6 logos de marcas embutidos e verificados por checksum.
- Durante a sessão o servidor MCP do Figma passou a recusar chamadas por limite do plano Starter. Por isso o retrato, os frames, o logotipo em vetor e a correção dos textos não puderam ser aplicados por mim no Figma.
- `figma/finalizar-v4.js` faz isso em uma execução pelo plugin Scripter (instruções no cabeçalho do arquivo). O script não foi executado por mim; foi escrito com as mesmas chamadas usadas nas pranchas, e o único trecho novo é o encaixe das imagens coladas pelo usuário.
- Pré-requisito do script: as 5 imagens e os 2 SVGs colados na página 03 do arquivo.

## 4. Entrega final em PDF

`revisao/CloserTech-MediaKit-v4-PT.pdf` e `revisao/CloserTech-MediaKit-v4-EN.pdf` foram gerados do HTML em `html/` (mesmo projeto, mesmas medidas, mesmas cores e tipografia do Figma) pelo Chromium, com imagens reais e links ativos. É a versão para envio assim que os campos em laranja forem resolvidos.
