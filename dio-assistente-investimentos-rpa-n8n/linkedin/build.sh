#!/usr/bin/env bash
# Gera o PDF do carrossel do LinkedIn (8 páginas, 1080x1350) a partir de apresentacao.html.
#
# Uso:
#   ./build.sh
#   LINK_URL="https://github.com/usuario/repo" LINK_TEXT="github.com/usuario/repo" ./build.sh
#   CHROME=/caminho/do/chrome ./build.sh
#
# O link da página 8 vem de LINK_URL / LINK_TEXT (padrões abaixo). O script também mede a folga de cada
# página (px entre o fim do conteúdo e a zona do rodapé) e FALHA se alguma página estourar.
set -euo pipefail
cd "$(dirname "$0")"

CHROME="${CHROME:-$(command -v chromium || command -v google-chrome || command -v chrome || echo /opt/pw-browsers/chromium-1194/chrome-linux/chrome)}"
export LINK_URL="${LINK_URL:-https://github.com/caiocpl/low/tree/claude/relaxed-brahmagupta-x8uxm8/dio-assistente-investimentos-rpa-n8n}"
export LINK_TEXT="${LINK_TEXT:-github.com/caiocpl/low › dio-assistente-investimentos-rpa-n8n}"
SAIDA="apresentacao-assistente-investimentos.pdf"

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP:?}"' EXIT
python3 - "$TMP/apresentacao.html" <<'PY'
import html, os, sys
src = open("apresentacao.html", encoding="utf-8").read()
src = src.replace("{{LINK_URL}}", html.escape(os.environ["LINK_URL"], quote=True))
src = src.replace("{{LINK_TEXT}}", html.escape(os.environ["LINK_TEXT"]))
open(sys.argv[1], "w", encoding="utf-8").write(src)
PY

OPCOES=(--headless --no-sandbox --disable-gpu --no-pdf-header-footer)

# 1) mede a folga de cada página
DOM="$("$CHROME" "${OPCOES[@]}" --dump-dom "file://$TMP/apresentacao.html" 2>/dev/null)"
FOLGAS="$(printf '%s' "$DOM" | grep -o 'data-folga="-\?[0-9]*"' | grep -o -- '-\?[0-9]\+' || true)"
N=0; RUIM=0
for F in $FOLGAS; do
  N=$((N + 1)); echo "página $N: folga ${F}px"
  [ "$F" -lt 0 ] && RUIM=1
done
[ "$N" -eq 8 ] || { echo "ERRO: esperava 8 páginas, mediu $N"; exit 1; }
[ "$RUIM" -eq 0 ] || { echo "ERRO: há página com conteúdo estourando a zona segura"; exit 1; }

# 2) gera o PDF
"$CHROME" "${OPCOES[@]}" --print-to-pdf="$SAIDA" "file://$TMP/apresentacao.html" 2>/dev/null
pdfinfo "$SAIDA" 2>/dev/null | grep -E "Pages|Page size" || true
