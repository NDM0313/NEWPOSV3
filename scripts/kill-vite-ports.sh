#!/usr/bin/env bash
# Kill Vite/node listeners on 5174 / 5175 (Linux/macOS).
set -euo pipefail
for port in 5174 5175; do
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Killing PIDs on :$port → $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  else
    echo "OK: port $port free"
  fi
done
pkill -f 'vite.*(5174|5175)' 2>/dev/null || true
echo "Done. Start with: cd erp-mobile-app && rm -rf node_modules/.vite && npm run dev"
