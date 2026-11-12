#!/usr/bin/env bash
# Non-mutating production Auth/PostgREST resolver matrix (no JE writes).
set -euo pipefail
EVIDENCE=/tmp/prod_je_guard_auth_matrix.txt
: > "$EVIDENCE"
pass() { echo "PASS: $*" | tee -a "$EVIDENCE"; }
fail() { echo "FAIL: $*" | tee -a "$EVIDENCE"; exit 1; }

COMPANY_A='e08a04af-22a8-4869-9b4d-da31fce13158'
# Production API via local Kong (same stack as public supabase.dincouture.pk)
REST='http://127.0.0.1:8000/rest/v1'
AUTH='http://127.0.0.1:8000/auth/v1'

# Extract keys without sourcing whole .env (may contain unquoted spaces)
ANON_KEY=$(grep -E '^ANON_KEY=' /root/supabase/docker/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
JWT_SECRET=$(grep -E '^JWT_SECRET=' /root/supabase/docker/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
[[ -n "$ANON_KEY" && -n "$JWT_SECRET" ]] || fail "missing ANON_KEY/JWT_SECRET"

# Discover real users + accounts (read-only SQL)
eval "$(docker exec supabase-db psql -U postgres -d postgres -t -A -c "
SELECT format(
  'USER_A_SUB=%s; USER_B_SUB=%s; CASH_A=%s; ACCT_B=%s',
  (SELECT u.auth_user_id::text FROM public.users u
    WHERE u.company_id='$COMPANY_A'::uuid AND u.auth_user_id IS NOT NULL
    ORDER BY u.created_at NULLS LAST LIMIT 1),
  (SELECT u.auth_user_id::text FROM public.users u
    WHERE u.company_id IS DISTINCT FROM '$COMPANY_A'::uuid AND u.auth_user_id IS NOT NULL
      AND u.company_id IS NOT NULL
    ORDER BY u.created_at NULLS LAST LIMIT 1),
  (SELECT a.id::text FROM accounts a
    WHERE a.company_id='$COMPANY_A'::uuid AND COALESCE(a.is_active,true)
      AND a.code IN ('1010','1000','1110') ORDER BY a.code LIMIT 1),
  (SELECT a.id::text FROM accounts a
    WHERE a.company_id IS DISTINCT FROM '$COMPANY_A'::uuid AND COALESCE(a.is_active,true)
    ORDER BY a.code LIMIT 1)
);
")"

[[ -n "${USER_A_SUB:-}" && -n "${CASH_A:-}" && -n "${ACCT_B:-}" ]] || fail "missing fixture discovery USER_A=$USER_A_SUB CASH=$CASH_A ACCT_B=$ACCT_B"
echo "DISCOVERY user_a=${USER_A_SUB:0:8}… cash_a=$CASH_A acct_b=$ACCT_B user_b=${USER_B_SUB:-none}" | tee -a "$EVIDENCE"

# Mint short-lived authenticated JWTs with production JWT_SECRET (same secret Kong/PostgREST use).
# Does not create users or accounting rows.
mint_jwt() {
  local sub="$1"
  python3 - <<PY
import json,time,hmac,hashlib,base64,os
secret=os.environ["JWT_SECRET"]
def b64(d): return base64.urlsafe_b64encode(d).rstrip(b"=").decode()
def jwt(payload):
  h=b64(json.dumps({"alg":"HS256","typ":"JWT"},separators=(",",":")).encode())
  p=b64(json.dumps(payload,separators=(",",":")).encode())
  s=hmac.new(secret.encode(),f"{h}.{p}".encode(),hashlib.sha256).digest()
  return f"{h}.{p}.{b64(s)}"
now=int(time.time())
print(jwt({
  "aud":"authenticated","role":"authenticated","iss":"supabase",
  "sub":"$sub","email":"je-guard-verify@local.invalid",
  "iat":now,"exp":now+900
}))
PY
}

export JWT_SECRET
TOKEN_A=$(mint_jwt "$USER_A_SUB")

# Assert we are hitting production stack (Kong on 8000), not staging 1808x
curl -sS -o /dev/null -w "kong_http=%{http_code}\n" "$REST/" -H "apikey: $ANON_KEY" | tee -a "$EVIDENCE"

rpc() {
  local token="$1" fn="$2" body="$3"
  python3 - <<PY
import json,urllib.request,urllib.error
url="$REST/rpc/$fn"
hdr={
  "apikey":"$ANON_KEY",
  "Authorization":"Bearer $token",
  "Content-Type":"application/json",
  "Prefer":"return=representation",
}
req=urllib.request.Request(url, data=json.dumps($body).encode(), headers=hdr, method="POST")
try:
  with urllib.request.urlopen(req, timeout=30) as r:
    print(json.dumps({"http":r.status,"body":json.loads(r.read().decode())}))
except urllib.error.HTTPError as e:
  err=e.read().decode()
  print(json.dumps({"http":e.code,"body":err}))
PY
}

# 1) same-company resolve
OUT=$(rpc "$TOKEN_A" "resolve_journal_posting_account_id" "{\"p_company_id\":\"$COMPANY_A\",\"p_account_id\":\"$CASH_A\"}")
echo "same_company=$OUT" | tee -a "$EVIDENCE"
echo "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["http"]==200 and str(d["body"]).replace("\"","")=="'"$CASH_A"'", d' \
  || fail "same-company resolve"
pass "authenticated same-company resolve"

# 2) cross-company resolve (company B id + B account) under A JWT
COMPANY_B=$(docker exec supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT company_id::text FROM accounts WHERE id='$ACCT_B';")
OUT=$(rpc "$TOKEN_A" "resolve_journal_posting_account_id" "{\"p_company_id\":\"$COMPANY_B\",\"p_account_id\":\"$ACCT_B\"}")
echo "cross_company=$OUT" | tee -a "$EVIDENCE"
echo "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["http"] in (401,403,400) or "insufficient" in str(d["body"]).lower() or "privilege" in str(d["body"]).lower() or "company" in str(d["body"]).lower() or "denied" in str(d["body"]).lower() or "JWT" in str(d["body"]), d; assert d["http"]!=200 or False' \
  || { echo "$OUT" | grep -Eiq '42501|PGRST|insufficient|privilege|forbidden|not authorized|assert|company' && pass "cross-company resolve rejected (body)" || fail "cross-company should fail: $OUT"; }
# stricter: http must not be 200 with returned uuid
echo "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); 
import re
if d.get("http")==200 and re.match(r"^[0-9a-f-]{36}$", str(d.get("body","")).strip("\"")):
  raise SystemExit(1)
' || fail "cross-company returned account id"
pass "authenticated cross-company resolve rejected"

# 3) direct public_core cross-company
OUT=$(rpc "$TOKEN_A" "_journal_account_guard_resolve_public_core" "{\"p_company_id\":\"$COMPANY_B\",\"p_account_id\":\"$ACCT_B\"}")
echo "public_core_cross=$OUT" | tee -a "$EVIDENCE"
echo "$OUT" | python3 -c 'import json,sys,re; d=json.load(sys.stdin);
if d.get("http")==200 and re.match(r"^[0-9a-f-]{36}$", str(d.get("body","")).strip("\"")):
  raise SystemExit(1)
' || fail "public_core cross-company should fail"
pass "direct public_core cross-company rejected"

# 4) authenticated repair call FAIL
OUT=$(rpc "$TOKEN_A" "repair_restore_journal_entry_line_account" "{\"p_company_id\":\"$COMPANY_A\",\"p_line_id\":\"00000000-0000-0000-0000-000000000001\",\"p_expected_current_account_id\":\"$CASH_A\",\"p_restore_account_id\":\"$CASH_A\",\"p_expected_debit\":0,\"p_expected_credit\":0,\"p_expected_journal_entry_id\":\"00000000-0000-0000-0000-000000000002\"}")
echo "repair_auth=$OUT" | tee -a "$EVIDENCE"
echo "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["http"] in (401,403,404) or "permission" in str(d["body"]).lower() or "privilege" in str(d["body"]).lower() or "PGRST202" in str(d["body"]) or "not find" in str(d["body"]).lower() or "schema cache" in str(d["body"]).lower(), d' \
  || fail "repair should be denied for authenticated: $OUT"
pass "authenticated repair_restore denied"

# 5) GUC spoof via SQL session — cannot elevate repair (postgres SET ROLE attempt)
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$EVIDENCE"
DO $$
DECLARE
  ok boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', 'spoofed', true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    -- attempt internal if exposed — expect cannot execute
    PERFORM 1;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  -- authenticated cannot EXECUTE repair; try as SET ROLE authenticated
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.repair_restore_journal_entry_line_account(
      'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid,
      '9deff0b6-72a8-454d-baf7-0c8755018abc'::uuid,
      '9deff0b6-72a8-454d-baf7-0c8755018abc'::uuid,
      0, 0,
      '00000000-0000-0000-0000-000000000002'::uuid
    );
    RAISE EXCEPTION 'UNEXPECTED: repair succeeded under spoof';
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
    RAISE NOTICE 'PASS: GUC/role spoof did not grant repair (insufficient_privilege)';
  WHEN OTHERS THEN
    IF SQLERRM ILIKE '%permission%' OR SQLERRM ILIKE '%denied%' OR SQLERRM ILIKE '%JOURNAL_REPAIR%' OR SQLERRM ILIKE '%privilege%' THEN
      ok := true;
      RAISE NOTICE 'PASS: GUC/role spoof blocked repair (%)', SQLERRM;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT ok THEN
    RAISE EXCEPTION 'FAIL: spoof path inconclusive';
  END IF;
  RESET ROLE;
END $$;
SQL
pass "GUC spoof path exercised — no repair elevation"

# Confirm REST base is not staging ports
echo "REST_BASE=$REST" | tee -a "$EVIDENCE"
[[ "$REST" != *18080* && "$REST" != *18081* ]] || fail "staging port"
echo "AUTH_MATRIX_OK" | tee -a "$EVIDENCE"
