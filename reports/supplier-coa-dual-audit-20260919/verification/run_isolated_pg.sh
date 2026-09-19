#!/usr/bin/env bash
# Isolated Docker Postgres verification — no production writes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="posv3-je-guard-verify-$$"
PORT=55432
EVIDENCE="$DIR/EVIDENCE.md"
MIG="$ROOT/migrations/20260919140000_journal_posting_account_guard_and_verified_remaps.sql"
REPAIR="$ROOT/reports/supplier-coa-dual-audit-20260919/repair-package"

echo "# JE account guard — isolated Postgres evidence" > "$EVIDENCE"
echo >> "$EVIDENCE"
echo "- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$EVIDENCE"
echo "- Production writes: none" >> "$EVIDENCE"
echo "- Runner: Docker postgres:15" >> "$EVIDENCE"
echo >> "$EVIDENCE"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -e POSTGRES_USER=postgres -e POSTGRES_DB=je_guard \
  -p "${PORT}:5432" postgres:15 >/dev/null

echo "Waiting for Postgres..."
for i in $(seq 1 40); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.5
done

PSQL=(docker exec -i "$NAME" psql -U postgres -d je_guard -v ON_ERROR_STOP=1)

run_sql() {
  local label="$1"
  local file="$2"
  local out="$DIR/_out_${label}.txt"
  echo "## ${label}" >> "$EVIDENCE"
  if "${PSQL[@]}" < "$file" > "$out" 2>&1; then
    grep -E 'NOTICE:|ERROR:|PASS:|FAIL:|OK|COMMIT|ALL_|_PASSED|ALREADY_|MISSING_|ROLLBACK_|APPLY_|BACKUP_' "$out" >> "$EVIDENCE" || true
    echo "- ${label}: OK" >> "$EVIDENCE"
  else
    echo "- ${label}: FAILED" >> "$EVIDENCE"
    cat "$out" >> "$EVIDENCE"
    exit 1
  fi
}

echo "## 1. Minimal schema" >> "$EVIDENCE"
run_sql "minimal_schema" "$DIR/00_minimal_schema.sql"

echo "## 2. Migration (missing backup seed)" >> "$EVIDENCE"
if "${PSQL[@]}" < "$MIG" > "$DIR/_out_migrate.txt" 2>&1; then
  grep -E 'NOTICE:|ERROR:|COMMIT' "$DIR/_out_migrate.txt" >> "$EVIDENCE" || true
  if grep -q 'ABSENT' "$DIR/_out_migrate.txt"; then
    echo "- missing-backup seed notice: OK" >> "$EVIDENCE"
  else
    echo "- missing-backup seed notice: MISSING" >> "$EVIDENCE"
    exit 1
  fi
  echo "- migration apply: OK" >> "$EVIDENCE"
else
  echo "- migration apply: FAILED" >> "$EVIDENCE"
  cat "$DIR/_out_migrate.txt" >> "$EVIDENCE"
  exit 1
fi

echo "## 3. Triggers" >> "$EVIDENCE"
"${PSQL[@]}" -c "SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='journal_entry_lines' AND NOT tgisinternal ORDER BY 1;" >> "$EVIDENCE"

run_sql "cases" "$DIR/02_cases.sql"
if ! grep -q 'ALL_ISOLATED_CHECKS_PASSED' "$DIR/_out_cases.txt"; then
  echo "- cases marker missing" >> "$EVIDENCE"; exit 1
fi

run_sql "seed_paths" "$DIR/03_seed_paths.sql"
if ! grep -q 'SEED_PATH_CHECKS_PASSED' "$DIR/_out_seed_paths.txt"; then
  echo "- seed marker missing" >> "$EVIDENCE"; exit 1
fi

run_sql "acl_set_role" "$DIR/04_acl_set_role.sql"
if ! grep -q 'ACL_SET_ROLE_CHECKS_PASSED' "$DIR/_out_acl_set_role.txt"; then
  echo "- acl marker missing" >> "$EVIDENCE"; exit 1
fi

run_sql "repair_preamble" "$DIR/05_repair_preamble.sql"
run_sql "repair_01_backup" "$REPAIR/01_backup.sql"
run_sql "repair_02_apply" "$REPAIR/02_apply.sql"
run_sql "repair_02_apply_repeat" "$REPAIR/02_apply.sql"
run_sql "repair_post" "$DIR/06_repair_post_apply.sql"
run_sql "repair_03_rollback" "$REPAIR/03_rollback.sql"
run_sql "repair_03_rollback_repeat" "$REPAIR/03_rollback.sql"

echo "## Scope notes" >> "$EVIDENCE"
echo "- AUTOMATIC remap scope: journal_account_verified_remaps (seed / new posts)" >> "$EVIDENCE"
echo "- HISTORICAL repair scope: IBRAHIM 2 lines only (backup_coa_limited_ibrahim_v1)" >> "$EVIDENCE"
echo "- ID LACE: NOT_IMPLEMENTED" >> "$EVIDENCE"
echo "- JWT/UI E2E: NOT EXECUTED" >> "$EVIDENCE"
echo "- Production migrate/repair: NOT EXECUTED" >> "$EVIDENCE"

# Confirm lines back on legacy after rollback
"${PSQL[@]}" -c "SELECT a.code, count(*) FROM journal_entry_lines jel JOIN accounts a ON a.id=jel.account_id WHERE jel.id IN ('677c74de-b677-4a6f-877f-b13e0ac66aaa','343c2586-2d86-4c24-9e03-3af493dada9d') GROUP BY 1;" >> "$EVIDENCE"

rm -f "$DIR"/_out_*.txt
echo "OK — see $EVIDENCE"
