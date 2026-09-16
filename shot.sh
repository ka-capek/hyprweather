#!/usr/bin/env bash
# Pořídí screenshot prototypu v cílovém rozměru okna a zobrazí ho v kitty.
# Použití:  ./shot.sh          → 1316 × 1396 (cílová velikost)
#           ./shot.sh 1600 900 → jiný rozměr
set -e
cd "$(dirname "$0")"

W="${1:-1316}"
H="${2:-1396}"
PORT="${PORT:-8765}"
OUT="$PWD/preview-${W}x${H}.png"
PROFILE="/tmp/weatherapp-ff-profile"

# Náhledový server nastartuj, jen pokud ještě neběží.
if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/index.html"; then
  echo "Startuji náhledový server na portu $PORT…"
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 1
fi

# Čerstvý profil: jinak Firefox servíruje starou verzi CSS/JS z cache
# a vypadá to jako chyba v kódu.
rm -rf "$PROFILE"
mkdir -p "$PROFILE"
rm -f "$OUT"
firefox --headless --profile "$PROFILE" --no-remote \
        --screenshot "$OUT" --window-size="$W,$H" \
        "http://127.0.0.1:$PORT/index.html?v=$(date +%s)" >/dev/null 2>&1

echo "$OUT  ($(identify -format '%wx%h' "$OUT"))"

# V kitty vykresli rovnou do terminálu.
# Vyžaduje skutečný terminál — přes zachycený výstup (např. `!` v Claude Code)
# se obrázek nevykreslí, soubor se ale i tak vytvoří.
if command -v kitten >/dev/null 2>&1 && [ -t 1 ] && [ -e /dev/tty ]; then
  kitten icat "$OUT" || true
else
  echo "(Pro vykreslení v terminálu spusť tenhle skript v běžné kitty záložce.)"
fi
