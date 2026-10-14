#!/usr/bin/env bash
# Real JWT/PostgREST matrix + JE posting smoke against staging loopback.
set -euo pipefail
STAGE_DIR=/root/je-guard-stage
# shellcheck disable=SC1091
source "$STAGE_DIR/keys.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/identity.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/test_users.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/tokens.env"

AUTH="http://127.0.0.1:${AUTH_PORT}"
REST="http://127.0.0.1:${REST_PORT}"
EVIDENCE=/tmp/je_guard_gate_results.txt
: > "$EVIDENCE"
pass() { echo "PASS: $*" | tee -a "$EVIDENCE"; }
fail() { echo "FAIL: $*" | tee -a "$EVIDENCE"; exit 1; }

# Identity assertions
echo "STAGING_API_AUTH=$AUTH" | tee -a "$EVIDENCE"
echo "STAGING_API_REST=$REST" | tee -a "$EVIDENCE"
echo "$AUTH" | grep -qi dincouture && fail "auth URL looks like production"
echo "$REST" | grep -qi dincouture && fail "rest URL looks like production"
pass "HTTP endpoints are loopback staging (not *.dincouture.pk)"

# Refresh tokens
TOKEN_A=$(curl -sS "$AUTH/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS_A\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
TOKEN_B=$(curl -sS "$AUTH/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASS_B\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

rpc() {
  local token="$1" fn="$2" body="$3"
  curl -sS -w "\nHTTP_CODE:%{http_code}" "$REST/rpc/$fn" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "$body"
}

# Discover accounts for company A
read -r CASH_A AP_A LEGACY_INACTIVE OTHER_CO_CASH <<<"$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -F ' ' -c "
SELECT
  (SELECT id::text FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true)=true AND code IN ('1010','1000','1110') ORDER BY code LIMIT 1),
  (SELECT id::text FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true)=true AND code LIKE 'AP-%' ORDER BY code LIMIT 1),
  (SELECT id::text FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true)=false AND code='210026' LIMIT 1),
  (SELECT id::text FROM accounts WHERE company_id='$COMPANY_B' AND COALESCE(is_active,true)=true ORDER BY code LIMIT 1);
")"

echo "ACCOUNTS cash_a=$CASH_A ap_a=$AP_A legacy=$LEGACY_INACTIVE other=$OTHER_CO_CASH" | tee -a "$EVIDENCE"
[[ -n "$CASH_A" && -n "$AP_A" && -n "$OTHER_CO_CASH" ]] || fail "missing fixture accounts"

# Prove get_user_company_id via RPC if exposed, else via SQL as authenticated using set_config simulation through PostgREST
# Create helper view/rpc already exists — call a tiny SQL function through rest if available
COMP_A_CHECK=$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c "
SELECT set_config('request.jwt.claim.sub','$UID_A', true);
SELECT set_config('request.jwt.claim.role','authenticated', true);
SELECT public.get_user_company_id()::text;
")
# last line
COMP_A_GOT=$(echo "$COMP_A_CHECK" | tail -1)
[[ "$COMP_A_GOT" == "$COMPANY_A" ]] || fail "get_user_company_id expected $COMPANY_A got $COMP_A_GOT"
pass "get_user_company_id resolves company A under JWT sub claim"

# 1) same-company resolve PASS
OUT=$(rpc "$TOKEN_A" resolve_journal_posting_account_id "{\"p_company_id\":\"$COMPANY_A\",\"p_account_id\":\"$AP_A\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
echo "$BODY" | grep -qi "$AP_A" || fail "same-company resolve body=$BODY code=$CODE"
[[ "$CODE" == "200" ]] || fail "same-company resolve http=$CODE"
pass "authenticated same-company resolve"

# 2) cross-company resolve FAIL
OUT=$(rpc "$TOKEN_A" resolve_journal_posting_account_id "{\"p_company_id\":\"$COMPANY_B\",\"p_account_id\":\"$OTHER_CO_CASH\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
if [[ "$CODE" == "200" ]]; then fail "cross-company resolve should fail body=$BODY"; fi
echo "$BODY $CODE" | grep -Ei 'forbid|privilege|42501|PGRST|permission|JWT|401|403' >/dev/null \
  || fail "cross-company unexpected body=$BODY code=$CODE"
pass "authenticated cross-company resolve rejected (http=$CODE)"

# 3) direct public_core cross-company FAIL
OUT=$(rpc "$TOKEN_A" _journal_account_guard_resolve_public_core "{\"p_company_id\":\"$COMPANY_B\",\"p_account_id\":\"$OTHER_CO_CASH\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
if [[ "$CODE" == "200" ]]; then fail "direct public_core cross-company should fail"; fi
pass "direct public_core cross-company rejected (http=$CODE)"

# 4) authenticated repair denied
OUT=$(rpc "$TOKEN_A" repair_restore_journal_entry_line_account \
  "{\"p_company_id\":\"$COMPANY_A\",\"p_line_id\":\"00000000-0000-0000-0000-000000000001\",\"p_expected_current_account_id\":\"$AP_A\",\"p_restore_account_id\":\"$AP_A\",\"p_expected_debit\":1,\"p_expected_credit\":0}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
if [[ "$CODE" == "200" ]]; then fail "authenticated repair should fail"; fi
pass "authenticated repair_restore denied (http=$CODE)"

# 5) GUC spoof cannot elevate — SQL as authenticated role via SET ROLE + fake JWT claims still blocked by effective_role for repair
docker exec -i supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVIDENCE"
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role','service_role', true);
SELECT set_config('app.journal_account_guard_mode','allow_inactive_restore', true);
SELECT set_config('app.test_user_company_id','$COMPANY_A', true);
DO \$\$
BEGIN
  BEGIN
    PERFORM public.repair_restore_journal_entry_line_account(
      '$COMPANY_A'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
      '$AP_A'::uuid, '$AP_A'::uuid, 1, 0, NULL);
    RAISE EXCEPTION 'FAIL: GUC spoof granted repair';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: GUC/JWT-text spoof did not grant repair';
  WHEN OTHERS THEN
    IF SQLERRM ILIKE '%permission denied%' OR SQLERRM ILIKE '%JOURNAL_REPAIR_FORBIDDEN%' OR SQLERRM ILIKE '%must be%' THEN
      RAISE NOTICE 'PASS: GUC spoof repair blocked (% )', SQLSTATE;
    ELSE
      RAISE;
    END IF;
  END;
END \$\$;
RESET ROLE;
SQL
pass "GUC spoof path exercised"

# 6) service_role repair on disposable fixture
docker exec -i supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVIDENCE"
BEGIN;
DO \$\$
DECLARE
  je uuid := gen_random_uuid();
  line uuid := gen_random_uuid();
  inactive uuid;
  active uuid := '$AP_A'::uuid;
BEGIN
  SELECT id INTO inactive FROM accounts
  WHERE company_id='$COMPANY_A'::uuid AND COALESCE(is_active,true)=false
  LIMIT 1;
  IF inactive IS NULL THEN
    -- create disposable inactive leaf
    inactive := gen_random_uuid();
    INSERT INTO accounts (id, company_id, code, name, is_active)
    VALUES (inactive, '$COMPANY_A'::uuid, 'ZZ-TEMP-INACTIVE', 'temp inactive', false);
  END IF;

  INSERT INTO journal_entries (id, company_id, entry_no, entry_date, description, is_void)
  VALUES (je, '$COMPANY_A'::uuid, 'JE-GATE-TMP', CURRENT_DATE, 'staging gate fixture', false);

  -- insert balanced lines using active cash + AP first
  INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit)
  VALUES (line, je, active, 10, 0);
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit)
  VALUES (je, '$CASH_A'::uuid, 0, 10);

  -- privileged restore attempt to inactive via SET ROLE service_role
  PERFORM set_config('role','service_role', true);
  PERFORM public.repair_restore_journal_entry_line_account(
    '$COMPANY_A'::uuid, line, active, inactive, 10, 0, je);
  RAISE NOTICE 'PASS: service_role repair_restore on disposable fixture';
END \$\$;
ROLLBACK;
SQL
pass "service_role repair on disposable fixture (rolled back)"

echo "JWT_MATRIX_OK" | tee -a "$EVIDENCE"
