#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ELECTRON="${ELECTRON:-$(command -v electron43 || command -v electron39 || command -v electron || true)}"
if [ -z "$ELECTRON" ]; then
  echo "Electron not found. Install your distro's Electron package or set ELECTRON=/path/to/electron." >&2
  exit 1
fi
if [ ! -d node_modules/vite ]; then npm ci --legacy-peer-deps --no-audit --no-fund; fi
# Always build after a pull: an existing dist/ may contain yesterday's lab.
npm run build
exec "$ELECTRON" --class=weather-animation-lab --ozone-platform-hint=auto . "$@"
