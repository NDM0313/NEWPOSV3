#!/usr/bin/env bash
# Phase 1.7 — Apply Phase 1.5 migrations to production postgres (guarded).
# Requires: PHASE_15_PRODUCTION_TARGET=1, PHASE_15_PRODUCTION_APPROVED=1, PHASE_15_PRODUCTION_BACKUP_ID
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
TARGET_DB="${TARGET_DB:-postgres}"

export PHASE_15_PRODUCTION_TARGET="${PHASE_15_PRODUCTION_TARGET:-1}"
cd "$ROOT"
node --input-type=module -e "
import { assertPhase15ProductionTarget, printMaskedPhase15ProductionTarget } from './scripts/single-core-ledger/production-phase-15-env-guard.mjs';
const guard = assertPhase15ProductionTarget({ requireApply: true });
printMaskedPhase15ProductionTarget(guard);
"

if [[ "$TARGET_DB" != "postgres" ]]; then
  echo "ERROR: TARGET_DB must be postgres (got: $TARGET_DB)" >&2
  exit 1
fi

PHASE_15=(
  20260620140000_get_unified_party_ledger_shadow.sql
  20260621120000_single_core_ledger_systemwide_diagnostics.sql
  20260621150000_unified_ledger_phase_15_rpcs.sql
  20260621151000_unified_ledger_phase_15_indexes.sql
)

echo "=== Apply Phase 1.5 migrations to PRODUCTION postgres ==="
echo "Target DB: $TARGET_DB"
echo "Backup:    ${PHASE_15_PRODUCTION_BACKUP_ID:-not set}"
echo ""

docker exec "$CONTAINER" psql -U postgres -d "$TARGET_DB" -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );"

for file in "${PHASE_15[@]}"; do
  applied=$(docker exec "$CONTAINER" psql -U postgres -d "$TARGET_DB" -t -A -c \
    "SELECT 1 FROM schema_migrations WHERE name = '$file' LIMIT 1;" | tr -d '[:space:]')
  if [[ "$applied" == "1" ]]; then
    echo "[SKIP] $file"
    continue
  fi
  path="$ROOT/migrations/$file"
  if [[ ! -f "$path" ]]; then
    echo "ERROR: missing $path" >&2
    exit 1
  fi
  echo "[RUN] $file"
  docker cp "$path" "$CONTAINER:/tmp/phase15_migration.sql"
  docker exec "$CONTAINER" psql -U postgres -d "$TARGET_DB" -v ON_ERROR_STOP=1 -f /tmp/phase15_migration.sql
  docker exec "$CONTAINER" psql -U postgres -d "$TARGET_DB" -c \
    "INSERT INTO schema_migrations (name) VALUES ('$file') ON CONFLICT (name) DO NOTHING;"
  echo "[OK] $file"
done

echo ""
echo "=== RPC verification ==="
docker cp "$ROOT/scripts/single-core-ledger/verify-phase-15-rpcs.sql" "$CONTAINER:/tmp/verify-phase-15-rpcs.sql"
docker exec "$CONTAINER" psql -U postgres -d "$TARGET_DB" -f /tmp/verify-phase-15-rpcs.sql

echo ""
echo "Phase 1.5 production migrations complete. unified_ledger_engine remains OFF."
