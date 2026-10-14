#!/usr/bin/env bash
# Pre-QA smoke: env file + HTTPS reachability to locked ERP host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/verify-flutter-build-env.sh"

echo "[smoke-api-check] GET https://erp.dincouture.pk ..."
if curl -fsS -o /dev/null -w '' --max-time 15 https://erp.dincouture.pk/; then
  echo "[smoke-api-check] OK — ERP host reachable."
else
  echo "[smoke-api-check] WARN — could not reach https://erp.dincouture.pk (check network/VPS)."
  exit 1
fi

echo "[smoke-api-check] Next: run manual QA from docs/flutter-migration/08_TESTING_QA_CHECKLIST.md"
