#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f dist/index.html ]; then npm run build; fi
exec /usr/bin/electron43 --class=weather-animation-lab --ozone-platform-hint=auto . "$@"
