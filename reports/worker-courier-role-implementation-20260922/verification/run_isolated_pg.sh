#!/usr/bin/env bash
# Isolated Docker Postgres verification for worker/courier role-model — no production writes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DIR="$(cd "$(dirname "$0")" && pwd)"
NAME="posv3-role-model-verify-$$"
PORT=55433
EVIDENCE="$DIR/EVIDENCE.md"
MIG="$ROOT/migrations/20260922120000_worker_courier_role_model_account_domain.sql"
MIG_LEAF="$ROOT/migrations/20260922130000_record_payment_worker_role_leaf_debit.sql"
MIG_AUTH="$ROOT/migrations/20260922140000_record_payment_company_auth_and_acl.sql"
REG="$ROOT/reports/worker-courier-role-implementation-20260921/postgres_regression.sql"
MIN="$DIR/00_minimal_schema.sql"
STUBS="$DIR/01_payment_rpc_stubs.sql"

echo "# Worker/courier role-model — isolated Postgres evidence" > "$EVIDENCE"
echo >> "$EVIDENCE"
echo "- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$EVIDENCE"
echo "- Production writes: none" >> "$EVIDENCE"
echo "- Runner: Docker postgres:15" >> "$EVIDENCE"
echo "- Migrations: 20260922120000 + 20260922130000 + 20260922140000" >> "$EVIDENCE"
echo "- Regression: reports/worker-courier-role-implementation-20260921/postgres_regression.sql" >> "$EVIDENCE"
echo >> "$EVIDENCE"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=role_model \
  -p "${PORT}:5432" \
  postgres:15 >/dev/null

echo "Waiting for Postgres..."
for i in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -h 127.0.0.1 -U postgres -d role_model >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

PSQL=(docker exec -i "$NAME" psql -h 127.0.0.1 -U postgres -d role_model -v ON_ERROR_STOP=1)

run_sql() {
  local label="$1"
  local file="$2"
  local out="$DIR/_out_${label}.txt"
  echo "## ${label}" >> "$EVIDENCE"
  if "${PSQL[@]}" < "$file" > "$out" 2>&1; then
    grep -E 'NOTICE:|ERROR:|PASS:|FAIL:|ROLE_MODEL_|ACL_|PAYMENT_RPC|COMMIT' "$out" >> "$EVIDENCE" || true
    echo "- ${label}: OK" >> "$EVIDENCE"
  else
    echo "- ${label}: FAILED" >> "$EVIDENCE"
    cat "$out" >> "$EVIDENCE"
    exit 1
  fi
}

echo "## 1. Minimal schema" >> "$EVIDENCE"
run_sql "minimal_schema" "$MIN"
run_sql "payment_stubs" "$STUBS"

echo "## 2. Role-model + payment leaf + company-auth migrations" >> "$EVIDENCE"
run_sql "migration_domain" "$MIG"
run_sql "migration_leaf" "$MIG_LEAF"
run_sql "migration_auth" "$MIG_AUTH"
run_sql "migration_auth_rerun" "$MIG_AUTH"

echo "## 3. Full ACL + cross-company + lifecycle + payment RPC security" >> "$EVIDENCE"
run_sql "regression" "$REG"

if ! grep -q 'ROLE_MODEL_POSTGRES_REGRESSION_PASS' "$DIR/_out_regression.txt"; then
  echo "- regression marker missing" >> "$EVIDENCE"
  exit 1
fi
if ! grep -q 'ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS' "$DIR/_out_regression.txt"; then
  echo "- payment RPC security marker missing" >> "$EVIDENCE"
  exit 1
fi
if ! grep -q 'PAYMENT_RPC_ACL_PASS' "$DIR/_out_regression.txt"; then
  echo "- PAYMENT_RPC_ACL_PASS missing" >> "$EVIDENCE"
  exit 1
fi

echo "## Verdict" >> "$EVIDENCE"
echo "- ROLE_MODEL_POSTGRES_REGRESSION_PASS" >> "$EVIDENCE"
echo "- ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS" >> "$EVIDENCE"
echo "- PAYMENT_RPC_ACL_PASS" >> "$EVIDENCE"
echo "- Production migrate: NOT EXECUTED" >> "$EVIDENCE"
echo "- Production mutations: NONE" >> "$EVIDENCE"

rm -f "$DIR"/_out_*.txt
echo "OK — ROLE_MODEL_POSTGRES_REGRESSION_PASS + ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS — see $EVIDENCE"
