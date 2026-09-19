#!/usr/bin/env bash
# JE posting smoke via PostgREST against staging clone.
set -euo pipefail
STAGE_DIR=/root/je-guard-stage
source "$STAGE_DIR/keys.env"
source "$STAGE_DIR/identity.env"
source "$STAGE_DIR/test_users.env"

AUTH="http://127.0.0.1:${AUTH_PORT}"
REST="http://127.0.0.1:${REST_PORT}"
EVIDENCE=/tmp/je_guard_posting_results.txt
: > "$EVIDENCE"
pass() { echo "PASS: $*" | tee -a "$EVIDENCE"; }
fail() { echo "FAIL: $*" | tee -a "$EVIDENCE"; exit 1; }

TOKEN_A=$(curl -sS "$AUTH/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS_A\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

# Fixture accounts + disposable inactive/remap pair created via SQL as postgres
eval "$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c "
SELECT format('CASH=%s; AP=%s; OTHER=%s; INACTIVE_NOMAP=%s; INACTIVE_MAP=%s; MAP_TO=%s',
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code IN ('1010','1000','1110') ORDER BY code LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code LIKE 'AP-%' ORDER BY code LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_B' AND COALESCE(is_active,true) ORDER BY code LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true)=false
     AND id NOT IN (SELECT from_account_id FROM journal_account_verified_remaps WHERE company_id='$COMPANY_A')
     LIMIT 1),
  NULL, NULL);
")"

# Ensure disposable inactive+remap fixtures
docker exec -i supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  inactive uuid;
  target uuid;
BEGIN
  SELECT id INTO target FROM accounts
  WHERE company_id='$COMPANY_A'::uuid AND COALESCE(is_active,true)=true AND code LIKE 'AP-%'
  ORDER BY code LIMIT 1;

  SELECT id INTO inactive FROM accounts
  WHERE company_id='$COMPANY_A'::uuid AND code='ZZ-GATE-INACTIVE';
  IF inactive IS NULL THEN
    inactive := gen_random_uuid();
    INSERT INTO accounts (id, company_id, code, name, type, is_group, is_active, linked_contact_id)
    VALUES (inactive, '$COMPANY_A'::uuid, 'ZZ-GATE-INACTIVE', 'gate inactive', 'liability', false, false,
      (SELECT linked_contact_id FROM accounts WHERE id=target));
  END IF;

  INSERT INTO journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
  )
  SELECT '$COMPANY_A'::uuid, inactive, target, a.linked_contact_id, 'ZZ-GATE-INACTIVE', a.code, 'staging_gate'
  FROM accounts a WHERE a.id=target
  ON CONFLICT (company_id, from_account_id) DO UPDATE
    SET to_account_id=EXCLUDED.to_account_id;

  -- ensure a no-map inactive exists
  IF NOT EXISTS (
    SELECT 1 FROM accounts WHERE company_id='$COMPANY_A'::uuid AND code='ZZ-GATE-NOMAP' 
  ) THEN
    INSERT INTO accounts (id, company_id, code, name, type, is_group, is_active)
    VALUES (gen_random_uuid(), '$COMPANY_A'::uuid, 'ZZ-GATE-NOMAP', 'gate nomap', 'liability', false, false);
  END IF;
END \$\$;
SELECT format('export CASH=%s; export AP=%s; export OTHER=%s; export INACTIVE_MAP=%s; export MAP_TO=%s; export INACTIVE_NOMAP=%s',
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code IN ('1010','1000','1110') ORDER BY 1 LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code LIKE 'AP-%' ORDER BY 1 LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_B' AND COALESCE(is_active,true) ORDER BY 1 LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='ZZ-GATE-INACTIVE'),
  (SELECT to_account_id FROM journal_account_verified_remaps WHERE company_id='$COMPANY_A' AND from_code='ZZ-GATE-INACTIVE' LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='ZZ-GATE-NOMAP')
);
SQL

eval "$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c "
SELECT format('CASH=%s; AP=%s; OTHER=%s; INACTIVE_MAP=%s; MAP_TO=%s; INACTIVE_NOMAP=%s',
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code IN ('1010','1000','1110') ORDER BY code LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code LIKE 'AP-%' ORDER BY code LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_B' AND COALESCE(is_active,true) ORDER BY code LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='ZZ-GATE-INACTIVE'),
  (SELECT to_account_id FROM journal_account_verified_remaps WHERE company_id='$COMPANY_A' AND from_code='ZZ-GATE-INACTIVE' LIMIT 1),
  (SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='ZZ-GATE-NOMAP'));
")"

echo "FIXTURES cash=$CASH ap=$AP other=$OTHER map_from=$INACTIVE_MAP map_to=$MAP_TO nomap=$INACTIVE_NOMAP" | tee -a "$EVIDENCE"

post_je() {
  local desc="$1" a1="$2" d1="$3" c1="$4" a2="$5" d2="$6" c2="$7"
  local entry_no="JE-GATE-$(date +%s)-$RANDOM"
  python3 - <<PY
import json,urllib.request
rest="$REST"; token="$TOKEN_A"; anon="$ANON_KEY"
# create header
hdr={"apikey":anon,"Authorization":f"Bearer {token}","Content-Type":"application/json","Prefer":"return=representation"}
je={"company_id":"$COMPANY_A","entry_no":"$entry_no","entry_date":"2026-09-19","description":"$desc","is_void":False,"is_manual":True}
req=urllib.request.Request(rest+"/journal_entries", data=json.dumps(je).encode(), headers=hdr, method="POST")
try:
  with urllib.request.urlopen(req) as r:
    body=json.loads(r.read().decode()); code=r.status
except Exception as e:
  err=getattr(e,"read",lambda: b"")()
  print(f"ERR_HEADER:{e}:{err.decode() if err else ''}"); raise SystemExit(2)
je_id=body[0]["id"] if isinstance(body,list) else body["id"]
lines=[
  {"journal_entry_id":je_id,"account_id":"$a1","debit":$d1,"credit":$c1},
  {"journal_entry_id":je_id,"account_id":"$a2","debit":$d2,"credit":$c2},
]
req2=urllib.request.Request(rest+"/journal_entry_lines", data=json.dumps(lines).encode(), headers=hdr, method="POST")
try:
  with urllib.request.urlopen(req2) as r:
    lbody=json.loads(r.read().decode()); print(json.dumps({"ok":True,"je_id":je_id,"lines":lbody}))
except Exception as e:
  err=getattr(e,"read",lambda: b"")()
  print(json.dumps({"ok":False,"je_id":je_id,"error":err.decode() if err else str(e)}))
  raise SystemExit(1)
PY
}

# 1 valid same-company
OUT=$(post_je "valid cash/ap" "$CASH" 100 0 "$AP" 0 100) || fail "valid post failed: $OUT"
echo "$OUT" | tee -a "$EVIDENCE" | grep -q '"ok": true' || fail "valid post"
pass "valid same-company balanced JE"

# 2 supplier AP already covered by above
pass "valid supplier/AP posting"

# 3 wrong-company account
set +e
OUT=$(post_je "wrong company" "$CASH" 5 0 "$OTHER" 0 5)
RC=$?
set -e
echo "$OUT" | tee -a "$EVIDENCE"
[[ $RC -ne 0 ]] || fail "wrong-company should reject"
pass "wrong-company account rejected"

# 4 inactive without map
set +e
OUT=$(post_je "inactive nomap" "$CASH" 7 0 "$INACTIVE_NOMAP" 0 7)
RC=$?
set -e
echo "$OUT" | tee -a "$EVIDENCE"
echo "$OUT" | grep -Ei 'RETIRED|inactive|check|PGRST|error' >/dev/null || fail "expected retired error"
[[ $RC -ne 0 ]] || fail "inactive nomap should reject"
pass "inactive without map rejected"

# 5 inactive with map -> AP
OUT=$(post_je "inactive remap" "$CASH" 9 0 "$INACTIVE_MAP" 0 9) || fail "remap post failed $OUT"
echo "$OUT" | tee -a "$EVIDENCE"
# verify line account remapped in DB
JE_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["je_id"])' <<<"$OUT")
GOT=$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c \
  "SELECT account_id::text FROM journal_entry_lines WHERE journal_entry_id='$JE_ID' AND credit=9 LIMIT 1;")
[[ "$GOT" == "$MAP_TO" ]] || fail "expected remap to $MAP_TO got $GOT"
EVT=$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c \
  "SELECT COUNT(*) FROM journal_account_guard_events WHERE journal_entry_id='$JE_ID' AND journal_entry_line_id IS NOT NULL;")
[[ "$EVT" -ge 1 ]] || fail "missing guard event line id"
pass "inactive with verified map remapped to AP-* with line_id event"

echo "POSTING_SMOKE_OK" | tee -a "$EVIDENCE"
