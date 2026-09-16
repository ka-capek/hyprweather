#!/usr/bin/env bash
# Spustí prototyp jako čisté okno — žádný prohlížeč, žádný rám, žádné menu.
#
#   ./run.sh                      aplikace, okno 1316 × 1396
#   ./run.sh shapes               galerie tvarů sloupce
#   ./run.sh styles               kódování intenzity
#   ./run.sh inapp                tvary sloupce ve skutečném srážkovém panelu
#   ./run.sh --capture=out.png    vykreslí mimo obrazovku, uloží PNG a skončí
#
# V běžícím okně se stránky přepínají klávesami 1 / 2 / 3 / 4.
set -e
cd "$(dirname "$0")"

ELECTRON="${ELECTRON:-$(command -v electron43 || command -v electron39 || command -v electron)}"
if [ -z "$ELECTRON" ]; then
  echo "Electron nenalezen. Nainstaluj:  sudo pacman -S electron43" >&2
  exit 1
fi

# Zkratky názvů stránek
case "${1:-}" in
  app|"")      PAGE="index.html" ;;
  shapes|bars) PAGE="lab/bar-shapes.html";   shift ;;
  styles)      PAGE="lab/precip-styles.html"; shift ;;
  inapp)       PAGE="lab/shapes-in-app.html";  shift ;;
  *)           PAGE="index.html" ;;
esac

# Vlastní --page= od uživatele má přednost před zkratkou výše.
for arg in "$@"; do
  case "$arg" in --page=*) PAGE="" ;; esac
done

PAGE_ARG=()
[ -n "$PAGE" ] && PAGE_ARG=(--page="$PAGE")

if ! command -v npm >/dev/null; then
  echo "Node.js a npm jsou potřeba pro sestavení animovaného pozadí." >&2
  exit 1
fi
(
  cd WeatherAnimationLab
  if [ ! -d node_modules/vite ]; then npm ci --legacy-peer-deps --no-audit --no-fund; fi
  npm run build
)

exec "$ELECTRON" \
  --ozone-platform-hint=auto \
  --enable-features=WaylandWindowDecorations \
  devshell "${PAGE_ARG[@]}" "$@"
