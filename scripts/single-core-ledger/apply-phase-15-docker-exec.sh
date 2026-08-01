#!/usr/bin/env bash
# Apply Phase 1.5 migrations via docker exec (VPS clone — no host pooler auth).
set -euo pipefail

CLONE_DB="${CLONE_DB:-ledger_stage_20260623}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PHASE_15=(
  20260620140000_get_unified_party_ledger_shadow.sql
  20260621120000_single_core_ledger_systemwide_diagnostics.sql
  20260621150000_unified_ledger_phase_15_rpcs.sql
  20260621151000_unified_ledger_phase_15_indexes.sql
)

echo "=== Apply Phase 1.5 migrations (docker exec) ==="
echo "Clone DB: $CLONE_DB"
echo "NOT production database: postgres"
echo ""

docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ DEFAULT NOW()
  );"

for file in "${PHASE_15[@]}"; do
  applied=$(docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -t -A -c \
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
  docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 -f /tmp/phase15_migration.sql
  docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -c \
    "INSERT INTO schema_migrations (name) VALUES ('$file') ON CONFLICT (name) DO NOTHING;"
  echo "[OK] $file"
done

echo ""
echo "=== RPC verification ==="
docker cp "$ROOT/scripts/single-core-ledger/verify-phase-15-rpcs.sql" "$CONTAINER:/tmp/verify-phase-15-rpcs.sql"
docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -f /tmp/verify-phase-15-rpcs.sql
