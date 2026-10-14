#!/usr/bin/env bash
# STAGING ONLY — payment RPC JWT security after company-auth migration.
# Target: ledger_stage_20260922_prodcheck — NEVER live postgres.
set -euo pipefail
CLONE_DB=ledger_stage_20260922_prodcheck
STAGE_DIR=/root/role-model-stage
AUTH_PORT=18083
REST_PORT=18082
COMPOSE_PROJECT=role-model-stage
COMPANY_A=e08a04af-22a8-4869-9b4d-da31fce13158
EVIDENCE=/tmp/role_model_payment_jwt_security.txt
: > "$EVIDENCE"
log() { echo "$*" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $*"; exit 1; }
pass() { log "PASS: $*"; }

DB=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT current_database();")
[[ "$DB" == "$CLONE_DB" && "$DB" != "postgres" ]] || fail "isolation"

# Apply company-auth migration on clone only
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 < /tmp/record_payment_company_auth.sql \
  > /tmp/pay_auth_apply.out 2>&1 || { tail -40 /tmp/pay_auth_apply.out; fail migrate; }
pass "applied 20260922140000 on clone"

# ACL catalog
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$EVIDENCE"
SELECT CASE WHEN bool_and(NOT has_function_privilege('anon', oid, 'EXECUTE')
                     AND NOT has_function_privilege('public', oid, 'EXECUTE')
                     AND has_function_privilege('authenticated', oid, 'EXECUTE')
                     AND has_function_privilege('service_role', oid, 'EXECUTE'))
  THEN 'PAYMENT_RPC_ACL_PASS' ELSE 'PAYMENT_RPC_ACL_FAIL' END AS acl
FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='record_payment_with_accounting';
SELECT pg_get_functiondef(oid) LIKE '%_party_role_account_assert_company_access%' AS has_assert
FROM pg_proc WHERE proname='record_payment_with_accounting'
  AND pg_get_function_identity_arguments(oid) LIKE '%p_worker_stage_id%';
SQL
grep -q PAYMENT_RPC_ACL_PASS "$EVIDENCE" || fail acl

# Bootstrap/reuse HTTP stack (same as rehearsal)
if [[ ! -f "$STAGE_DIR/keys.env" ]]; then
  fail "missing $STAGE_DIR — run rehearsal bootstrap first or recreate"
fi
# shellcheck disable=SC1091
source "$STAGE_DIR/keys.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/identity.env" 2>/dev/null || true

# Ensure compose up
if ! curl -sf "http://127.0.0.1:${AUTH_PORT}/health" >/dev/null 2>&1; then
  # Minimal re-bootstrap: reuse scripts from prior rehearsal dir if compose exists
  if [[ -f "$STAGE_DIR/docker-compose.yml" ]]; then
    cd "$STAGE_DIR" && docker compose -p "$COMPOSE_PROJECT" up -d
    for i in $(seq 1 45); do
      a=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${AUTH_PORT}/health" || echo 000)
      [[ "$a" == "200" ]] && break
      sleep 1
    done
  else
    fail "no compose — need HTTP stack"
  fi
fi

# Recreate identities if needed
if [[ ! -f "$STAGE_DIR/test_users.env" ]]; then
  fail "missing test_users.env"
fi
# shellcheck disable=SC1091
source "$STAGE_DIR/test_users.env"

AUTH="http://127.0.0.1:${AUTH_PORT}"
REST="http://127.0.0.1:${REST_PORT}"
TOKEN_A=$(curl -sS "$AUTH/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS_A\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
[[ "$TOKEN_A" == eyJ* ]] || fail login

KIRAN=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM contacts WHERE code='SUP-ZHD-0036'")
# Ensure still worker on clone (from prior rehearsal)
TYPE=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT type::text FROM contacts WHERE id='$KIRAN'")
[[ "$TYPE" == "worker" ]] || fail "KIRAN type=$TYPE expected worker on clone"

CASH=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='1010' LIMIT 1")
K_WA=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM accounts WHERE linked_contact_id='$KIRAN' AND code LIKE 'WA-%' LIMIT 1")
BRANCH=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM branches WHERE company_id='$COMPANY_A' LIMIT 1")
COMPANY_B=${COMPANY_B:-$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id::text FROM companies WHERE id<>'$COMPANY_A' ORDER BY id LIMIT 1")}
WORKER_B=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM contacts WHERE company_id='$COMPANY_B' AND type::text='worker' LIMIT 1")
if [[ -z "$WORKER_B" ]]; then
  WORKER_B=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "
    INSERT INTO contacts (company_id, name, type, code)
    VALUES ('$COMPANY_B', 'Pay JWT Worker B', 'worker', 'JWT-PAY-WB')
    RETURNING id::text;")
fi

PAY_B0=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT count(*) FROM payments WHERE company_id='$COMPANY_B'")
JE_B0=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT count(*) FROM journal_entries WHERE company_id='$COMPANY_B'")

# Same-company worker payment
BODY=$(python3 - <<PY
import json
print(json.dumps({
  "p_company_id": "$COMPANY_A",
  "p_branch_id": "$BRANCH",
  "p_payment_type": "paid",
  "p_reference_type": "worker_payment",
  "p_reference_id": "$KIRAN",
  "p_amount": 33.0,
  "p_payment_method": "cash",
  "p_payment_date": "2026-09-22",
  "p_payment_account_id": "$CASH",
  "p_reference_number": None,
  "p_notes": "STAGING_PAYMENT_JWT_SEC same-co",
  "p_created_by": "$UID_A",
  "p_worker_stage_id": None
}))
PY
)
OUT=$(curl -sS -w "\nHTTP:%{http_code}" "$REST/rpc/record_payment_with_accounting" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d "$BODY")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP://p')
BODY_OUT=$(echo "$OUT" | sed '/HTTP:/d')
[[ "$CODE" == "200" ]] || fail "same-co http=$CODE $BODY_OUT"
JE=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["journal_entry_id"])' <<<"$BODY_OUT")
DEBIT=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "
  SELECT a.code FROM journal_entry_lines jel JOIN accounts a ON a.id=jel.account_id
  WHERE jel.journal_entry_id='$JE' AND jel.debit>0 LIMIT 1;")
[[ "$DEBIT" == WA-* ]] || fail "debit=$DEBIT expected WA-*"
pass "same-company worker payment http=200 debit=$DEBIT"

# Cross-company
BODY_X=$(python3 - <<PY
import json
print(json.dumps({
  "p_company_id": "$COMPANY_B",
  "p_branch_id": None,
  "p_payment_type": "paid",
  "p_reference_type": "worker_payment",
  "p_reference_id": "$WORKER_B",
  "p_amount": 11.0,
  "p_payment_method": "cash",
  "p_payment_date": "2026-09-22",
  "p_payment_account_id": "$CASH",
  "p_reference_number": None,
  "p_notes": "STAGING_PAYMENT_JWT_SEC cross-co",
  "p_created_by": "$UID_A",
  "p_worker_stage_id": None
}))
PY
)
OUT=$(curl -sS -w "\nHTTP:%{http_code}" "$REST/rpc/record_payment_with_accounting" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d "$BODY_X")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP://p')
BODY_OUT=$(echo "$OUT" | sed '/HTTP:/d')
echo "$BODY_OUT" | grep -Eiq '42501|insufficient_privilege|PARTY_ROLE_ACCOUNT_FORBIDDEN|permission' \
  || [[ "$CODE" == "403" || "$CODE" == "401" ]] \
  || fail "cross-co expected deny http=$CODE body=$BODY_OUT"
PAY_B1=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT count(*) FROM payments WHERE company_id='$COMPANY_B'")
JE_B1=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT count(*) FROM journal_entries WHERE company_id='$COMPANY_B'")
[[ "$PAY_B0" == "$PAY_B1" && "$JE_B0" == "$JE_B1" ]] || fail "cross-co mutation"
pass "cross-company payment blocked http=$CODE no mutation"

# Anon
OUT=$(curl -sS -w "\nHTTP:%{http_code}" "$REST/rpc/record_payment_with_accounting" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d "$BODY")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP://p')
[[ "$CODE" == "401" || "$CODE" == "403" ]] || fail "anon http=$CODE"
pass "anon payment denied http=$CODE"

# Ordinary supplier on clone
SUP=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "
  SELECT id FROM contacts WHERE company_id='$COMPANY_A' AND type::text='supplier'
    AND code NOT IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046','SUP-ZHD-0162')
  ORDER BY code LIMIT 1;")
BODY_S=$(python3 - <<PY
import json
print(json.dumps({
  "p_company_id": "$COMPANY_A",
  "p_branch_id": "$BRANCH",
  "p_payment_type": "paid",
  "p_reference_type": "manual_payment",
  "p_reference_id": "$SUP",
  "p_amount": 9.0,
  "p_payment_method": "cash",
  "p_payment_date": "2026-09-22",
  "p_payment_account_id": "$CASH",
  "p_reference_number": None,
  "p_notes": "STAGING_PAYMENT_JWT_SEC supplier",
  "p_created_by": "$UID_A",
  "p_worker_stage_id": None
}))
PY
)
OUT=$(curl -sS -w "\nHTTP:%{http_code}" "$REST/rpc/record_payment_with_accounting" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" -d "$BODY_S")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP://p')
BODY_OUT=$(echo "$OUT" | sed '/HTTP:/d')
[[ "$CODE" == "200" ]] || fail "supplier http=$CODE $BODY_OUT"
pass "ordinary supplier payment http=200"

# Prod RO untouched
docker exec -i supabase-db psql -U postgres -d postgres -Atc "
SELECT 'PROD|'||code||'|'||type::text FROM contacts WHERE code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046') ORDER BY 1;
SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='record_payment_with_accounting' AND pg_get_functiondef(oid) LIKE '%_party_role_account_assert_company_access%') AS prod_has_assert;
" | tee -a "$EVIDENCE"

cd "$STAGE_DIR" && docker compose -p "$COMPOSE_PROJECT" down --remove-orphans >/dev/null 2>&1 || true
log "STAGING_PAYMENT_JWT_SECURITY_PASS"
echo DONE
