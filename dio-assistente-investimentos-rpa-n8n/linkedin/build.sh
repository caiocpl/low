#!/usr/bin/env bash
# Gera o PDF do carrossel do LinkedIn (8 páginas, 1080x1350) a partir de apresentacao.html.
# Requer um Chromium/Chrome. Uso:  ./build.sh   (ou CHROME=/caminho/do/chrome ./build.sh)
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-$(command -v chromium || command -v google-chrome || command -v chrome || echo /opt/pw-browsers/chromium-1194/chrome-linux/chrome)}"
"$CHROME" --headless --no-sandbox --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="apresentacao-assistente-investimentos.pdf" "file://$PWD/apresentacao.html" 2>/dev/null
pdfinfo apresentacao-assistente-investimentos.pdf 2>/dev/null | grep -E "Pages|Page size" || true
