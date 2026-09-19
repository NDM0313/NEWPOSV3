#!/usr/bin/env bash
# Isolated Docker Postgres verification — no production writes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="posv3-je-guard-verify-$$"
PORT=55432
EVIDENCE="$DIR/EVIDENCE.md"
MIG="$ROOT/migrations/20260919140000_journal_posting_account_guard_and_verified_remaps.sql"

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

echo "## 1. Minimal schema" >> "$EVIDENCE"
"${PSQL[@]}" < "$DIR/00_minimal_schema.sql"
echo "- applied 00_minimal_schema.sql" >> "$EVIDENCE"

echo "## 2. Migration (single transaction file)" >> "$EVIDENCE"
if "${PSQL[@]}" < "$MIG" >> "$DIR/_migrate_out.txt" 2>&1; then
  echo "- migration apply: OK" >> "$EVIDENCE"
  grep -E 'NOTICE:|ERROR:' "$DIR/_migrate_out.txt" >> "$EVIDENCE" || true
else
  echo "- migration apply: FAILED" >> "$EVIDENCE"
  cat "$DIR/_migrate_out.txt" >> "$EVIDENCE"
  exit 1
fi

echo "## 3. Objects present" >> "$EVIDENCE"
"${PSQL[@]}" -c "\dt public.journal_account_*" >> "$EVIDENCE"
"${PSQL[@]}" -c "SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname='journal_entry_lines' AND NOT tgisinternal ORDER BY 1;" >> "$EVIDENCE"

echo "## 4. Case results" >> "$EVIDENCE"
if "${PSQL[@]}" < "$DIR/02_cases.sql" > "$DIR/_cases_out.txt" 2>&1; then
  grep -E 'NOTICE:|ERROR:|ALL_ISOLATED' "$DIR/_cases_out.txt" >> "$EVIDENCE" || true
  if grep -q 'ALL_ISOLATED_CHECKS_PASSED' "$DIR/_cases_out.txt"; then
    echo "- cases: PASSED" >> "$EVIDENCE"
  else
    echo "- cases: FAILED (missing ALL_ISOLATED_CHECKS_PASSED)" >> "$EVIDENCE"
    cat "$DIR/_cases_out.txt" >> "$EVIDENCE"
    exit 1
  fi
else
  echo "- cases: FAILED" >> "$EVIDENCE"
  cat "$DIR/_cases_out.txt" >> "$EVIDENCE"
  exit 1
fi

echo "## 5. Remap count after cases" >> "$EVIDENCE"
"${PSQL[@]}" -c "SELECT from_code, to_code, source FROM journal_account_verified_remaps;" >> "$EVIDENCE"

echo "## Environment notes" >> "$EVIDENCE"
echo "- Production MCP: guard objects NOT installed (verified read-only before this run)." >> "$EVIDENCE"
echo "- Staging Supabase JWT matrix: UNVERIFIED in this harness." >> "$EVIDENCE"
echo "- Vitest JS fixtures: separate; not a substitute for this SQL run." >> "$EVIDENCE"

rm -f "$DIR/_migrate_out.txt" "$DIR/_cases_out.txt"
echo "OK — see $EVIDENCE"
