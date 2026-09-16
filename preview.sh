#!/usr/bin/env bash
# Spustí lokální náhled prototypu na http://localhost:8765
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
echo "Preview:  http://localhost:$PORT/"
echo "Zastavit: Ctrl+C"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
