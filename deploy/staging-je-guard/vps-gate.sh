#!/usr/bin/env bash
# Staging JE guard gate — VPS helpers. Never touches live postgres for DDL.
set -euo pipefail

CLONE_DB="${CLONE_DB:-ledger_stage_20260919_prodcheck}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
REPO="${REPO:-/root/NEWPOSV3}"
STAGE_DIR="${STAGE_DIR:-/root/je-guard-stage}"
AUTH_PORT="${AUTH_PORT:-18081}"
REST_PORT="${REST_PORT:-18080}"

cmd="${1:-}"

psql_clone() {
  docker exec -i "$CONTAINER" psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 "$@"
}

psql_prod_ro() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

case "$cmd" in
  list-clones)
    docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c \
      "SELECT datname FROM pg_database WHERE datname LIKE 'ledger_stage_%' ORDER BY 1;"
    ;;
  create-clone)
    cd "$REPO"
    CLONE_DB="$CLONE_DB" bash scripts/single-core-ledger/create-vps-ledger-clone.sh
    ;;
  prove-clone)
    docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -t -A -c \
      "SELECT current_database() AS db,
              (current_database() = 'ledger_stage_20260919_prodcheck') AS is_target,
              (current_database() <> 'postgres') AS not_prod,
              to_regclass('public.journal_account_verified_remaps') IS NULL AS guard_absent;"
    ;;
  ports-check)
    echo "AUTH_PORT=$AUTH_PORT REST_PORT=$REST_PORT"
    ss -tln | grep -E ":${AUTH_PORT}|:${REST_PORT}" || echo "ports_free"
    docker ps --format '{{.Names}} {{.Status}}' | grep -E 'supabase-(auth|rest|kong|db)' || true
    ;;
  *)
    echo "Usage: $0 {list-clones|create-clone|prove-clone|ports-check}"
    exit 1
    ;;
esac
