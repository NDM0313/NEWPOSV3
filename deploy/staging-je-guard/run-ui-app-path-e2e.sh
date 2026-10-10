#!/usr/bin/env bash
# Application-path JE E2E against staging loopback only (clone DB).
# Mirrors AddEntryV2 → createPureJournalEntry / updatePureJournalEntry →
# accountingService.createEntry (PostgREST journal_entries + journal_entry_lines).
# Does NOT call resolve_journal_posting_account_id from the app (UI uses client assert + DB trigger).
set -euo pipefail
STAGE_DIR=/root/je-guard-stage
# shellcheck disable=SC1091
source "$STAGE_DIR/keys.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/identity.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/test_users.env"

AUTH="http://127.0.0.1:${AUTH_PORT}"
REST="http://127.0.0.1:${REST_PORT}"
DB=ledger_stage_20260919_prodcheck
EV=/tmp/je_guard_ui_app_path_e2e_20260921.txt
: > "$EV"
pass(){ echo "PASS: $*" | tee -a "$EV"; }
fail(){ echo "FAIL: $*" | tee -a "$EV"; exit 1; }
note(){ echo "NOTE: $*" | tee -a "$EV"; }

echo "$AUTH" | grep -qi dincouture && fail "auth looks like production"
echo "$REST" | grep -qi dincouture && fail "rest looks like production"
pass "endpoints are loopback staging"

TOKEN_A=$(curl -sS "$AUTH/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASS_A\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

rest() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -w "\nHTTP_CODE:%{http_code}" -X "$method" "$REST$path" \
      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_A" \
      -H "Content-Type: application/json" -H "Prefer: return=representation" \
      -d "$body"
  else
    curl -sS -w "\nHTTP_CODE:%{http_code}" -X "$method" "$REST$path" \
      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN_A" \
      -H "Prefer: return=representation"
  fi
}

# Fixtures from clone (Company A = DIN)
# Fixtures from clone (Company A = DIN) — one query per id to avoid quoting hell
CASH=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code IN ('1010','1000','1110') ORDER BY code LIMIT 1")
AP_IBRAHIM=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE id='2c56a1d1-e31d-433f-85af-ce3fd4729312'")
LEGACY_IBRAHIM=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE id='3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'")
AP_OTHER=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code LIKE 'AP-%' AND id<>'2c56a1d1-e31d-433f-85af-ce3fd4729312' ORDER BY code LIMIT 1")
WORKER=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND (code='2010' OR code LIKE 'WP-%') ORDER BY code LIMIT 1")
COURIER=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND code ~ '^203' AND code <> '2030' ORDER BY code LIMIT 1")
EXPENSE=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND COALESCE(is_active,true) AND lower(coalesce(type,'')) LIKE '%expense%' ORDER BY code LIMIT 1")
OTHER_CO=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_B' AND COALESCE(is_active,true) ORDER BY code LIMIT 1")
export CASH AP_IBRAHIM LEGACY_IBRAHIM AP_OTHER WORKER COURIER EXPENSE OTHER_CO

# Ensure inactive no-map + verified remap for IBRAHIM legacy exist
docker exec supabase-db psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO accounts (id, company_id, code, name, type, is_group, is_active)
SELECT gen_random_uuid(), '$COMPANY_A'::uuid, 'ZZ-GATE-NOMAP', 'gate nomap', 'liability', false, false
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id='$COMPANY_A'::uuid AND code='ZZ-GATE-NOMAP');

INSERT INTO journal_account_verified_remaps (
  company_id, from_account_id, to_account_id, expected_contact_id, from_code, to_code, source
)
SELECT '$COMPANY_A'::uuid, '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'::uuid,
       '2c56a1d1-e31d-433f-85af-ce3fd4729312'::uuid,
       '08592090-3e74-4b5e-8dd4-e06271f06391'::uuid, '210026', 'AP-SUPZHD0026', 'ui_e2e'
ON CONFLICT (company_id, from_account_id) DO NOTHING;
SQL

NOMAP=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='ZZ-GATE-NOMAP' LIMIT 1")

[[ -n "$CASH" && -n "$AP_IBRAHIM" && -n "$OTHER_CO" ]] || fail "missing fixtures cash=$CASH ap=$AP_IBRAHIM other=$OTHER_CO"
note "fixtures cash=$CASH ap_ibrahim=$AP_IBRAHIM legacy=$LEGACY_IBRAHIM worker=$WORKER courier=$COURIER expense=$EXPENSE other_co=$OTHER_CO nomap=$NOMAP"

create_je() {
  local entry_no="$1" debit_acct="$2" credit_acct="$3" amt="${4:-7.00}" desc="${5:-ui-app-path-e2e}"
  local hdr code hbody je_id lines lcode
  hdr=$(rest POST "/journal_entries" "{\"company_id\":\"$COMPANY_A\",\"entry_no\":\"$entry_no\",\"entry_date\":\"$(date -u +%F)\",\"description\":\"$desc\",\"reference_type\":\"journal\"}")
  code=$(echo "$hdr" | sed -n 's/.*HTTP_CODE://p')
  hbody=$(echo "$hdr" | sed '/HTTP_CODE:/d')
  [[ "$code" == "201" || "$code" == "200" ]] || { echo "HDR_FAIL code=$code body=$hbody" >&2; return 1; }
  je_id=$(printf '%s' "$hbody" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if isinstance(d,list) else d["id"])')
  lines=$(rest POST "/journal_entry_lines" "[{\"journal_entry_id\":\"$je_id\",\"account_id\":\"$debit_acct\",\"debit\":$amt,\"credit\":0},{\"journal_entry_id\":\"$je_id\",\"account_id\":\"$credit_acct\",\"debit\":0,\"credit\":$amt}]")
  lcode=$(echo "$lines" | sed -n 's/.*HTTP_CODE://p')
  echo "JE_ID=$je_id"
  echo "LINES_HTTP=$lcode"
  echo "LINES_BODY=$(echo "$lines" | sed '/HTTP_CODE:/d' | tr '\n' ' ')"
}

parse_je_id() { echo "$1" | sed -n 's/^JE_ID=//p' | head -1; }
parse_lines_http() { echo "$1" | sed -n 's/^LINES_HTTP=//p' | head -1; }
parse_lines_body() { echo "$1" | sed -n 's/^LINES_BODY=//p' | head -1; }

# -------- Case A: normal same-company --------
ENTRY_A="JE-UI-A-$(date +%s)"
OUT_A=$(create_je "$ENTRY_A" "$CASH" "$AP_OTHER" 7.00 "case-A-normal" || true)
JE_A=$(parse_je_id "$OUT_A")
CODE_A=$(parse_lines_http "$OUT_A")
BODY_A=$(parse_lines_body "$OUT_A")
[[ "$CODE_A" == "201" || "$CODE_A" == "200" ]] || fail "Case A lines http=$CODE_A body=$BODY_A"
PERSIST_A=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "
SELECT string_agg(a.code, ',' ORDER BY jel.debit DESC) FROM journal_entry_lines jel
JOIN accounts a ON a.id=jel.account_id WHERE jel.journal_entry_id='$JE_A';")
echo "$PERSIST_A" | grep -q "$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT code FROM accounts WHERE id='$CASH'")" || fail "Case A cash missing"
pass "Case A normal same-company JE persisted je=$JE_A accounts=$PERSIST_A"

# -------- Case B: Ibrahim AP leaf (party-assisted target) --------
ENTRY_B="JE-UI-B-$(date +%s)"
OUT_B=$(create_je "$ENTRY_B" "$CASH" "$AP_IBRAHIM" 11.00 "case-B-ibrahim-ap" || true)
JE_B=$(parse_je_id "$OUT_B")
CODE_B=$(parse_lines_http "$OUT_B")
[[ "$CODE_B" == "201" || "$CODE_B" == "200" ]] || fail "Case B http=$CODE_B"
CODES_B=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "
SELECT string_agg(DISTINCT a.code, ',') FROM journal_entry_lines jel
JOIN accounts a ON a.id=jel.account_id WHERE jel.journal_entry_id='$JE_B';")
echo "$CODES_B" | grep -q 'AP-SUPZHD0026' || fail "Case B expected AP-SUPZHD0026 got $CODES_B"
echo "$CODES_B" | grep -q '210026' && fail "Case B should not use legacy 210026"
pass "Case B Ibrahim AP leaf used ($CODES_B)"

# -------- Case C: verified remap (post retired → DB maps) --------
ENTRY_C="JE-UI-C-$(date +%s)"
OUT_C=$(create_je "$ENTRY_C" "$CASH" "$LEGACY_IBRAHIM" 13.00 "case-C-remap" || true)
JE_C=$(parse_je_id "$OUT_C")
CODE_C=$(parse_lines_http "$OUT_C")
BODY_C=$(parse_lines_body "$OUT_C")
if [[ "$CODE_C" == "201" || "$CODE_C" == "200" ]]; then
  ACCT_C=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "
    SELECT a.code FROM journal_entry_lines jel JOIN accounts a ON a.id=jel.account_id
    WHERE jel.journal_entry_id='$JE_C' AND jel.credit>0 LIMIT 1;")
  [[ "$ACCT_C" == "AP-SUPZHD0026" ]] || fail "Case C expected remapped AP got $ACCT_C"
  pass "Case C verified remap persisted as $ACCT_C"
else
  fail "Case C unexpected reject http=$CODE_C body=$BODY_C"
fi

# -------- Case D: retired without remap --------
ENTRY_D="JE-UI-D-$(date +%s)"
HDR_D=$(rest POST "/journal_entries" "{\"company_id\":\"$COMPANY_A\",\"entry_no\":\"$ENTRY_D\",\"entry_date\":\"$(date -u +%F)\",\"description\":\"case-D\",\"reference_type\":\"journal\"}")
JE_D=$(echo "$HDR_D" | sed '/HTTP_CODE:/d' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if isinstance(d,list) else d["id"])')
OUT_D=$(rest POST "/journal_entry_lines" "[{\"journal_entry_id\":\"$JE_D\",\"account_id\":\"$CASH\",\"debit\":5,\"credit\":0},{\"journal_entry_id\":\"$JE_D\",\"account_id\":\"$NOMAP\",\"debit\":0,\"credit\":5}]")
CODE_D=$(echo "$OUT_D" | sed -n 's/.*HTTP_CODE://p')
BODY_D=$(echo "$OUT_D" | sed '/HTTP_CODE:/d')
AFTER_D=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT COUNT(*) FROM journal_entry_lines WHERE journal_entry_id='$JE_D'")
[[ "$CODE_D" != "201" && "$CODE_D" != "200" ]] || fail "Case D should block"
echo "$BODY_D" | grep -q 'JOURNAL_ACCOUNT_RETIRED' || fail "Case D expected JOURNAL_ACCOUNT_RETIRED body=$BODY_D"
[[ "$AFTER_D" == "0" ]] || fail "Case D partial lines persisted count=$AFTER_D"
pass "Case D retired no-map blocked (http=$CODE_D) no lines; actionable JOURNAL_ACCOUNT_RETIRED"

# -------- Case E: cross-company --------
ENTRY_E="JE-UI-E-$(date +%s)"
HDR_E=$(rest POST "/journal_entries" "{\"company_id\":\"$COMPANY_A\",\"entry_no\":\"$ENTRY_E\",\"entry_date\":\"$(date -u +%F)\",\"description\":\"case-E\",\"reference_type\":\"journal\"}")
JE_E=$(echo "$HDR_E" | sed '/HTTP_CODE:/d' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if isinstance(d,list) else d["id"])')
BEFORE_E=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT COUNT(*) FROM journal_entry_lines")
OUT_E=$(rest POST "/journal_entry_lines" "[{\"journal_entry_id\":\"$JE_E\",\"account_id\":\"$CASH\",\"debit\":5,\"credit\":0},{\"journal_entry_id\":\"$JE_E\",\"account_id\":\"$OTHER_CO\",\"debit\":0,\"credit\":5}]")
CODE_E=$(echo "$OUT_E" | sed -n 's/.*HTTP_CODE://p')
BODY_E=$(echo "$OUT_E" | sed '/HTTP_CODE:/d')
AFTER_E=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT COUNT(*) FROM journal_entry_lines")
[[ "$CODE_E" != "201" && "$CODE_E" != "200" ]] || fail "Case E should block"
echo "$BODY_E" | grep -q 'JOURNAL_ACCOUNT_WRONG_COMPANY' || fail "Case E expected WRONG_COMPANY body=$BODY_E"
[[ "$BEFORE_E" == "$AFTER_E" ]] || fail "Case E mutated line count"
pass "Case E cross-company blocked (http=$CODE_E) no mutation"

# -------- Case F: edit account + description-only --------
ENTRY_F="JE-UI-F-$(date +%s)"
OUT_F=$(create_je "$ENTRY_F" "$CASH" "$AP_OTHER" 9.00 "case-F-create" || true)
JE_F=$(parse_je_id "$OUT_F")
CODE_F0=$(parse_lines_http "$OUT_F")
[[ "$CODE_F0" == "201" || "$CODE_F0" == "200" ]] || fail "Case F create http=$CODE_F0"
read -r LINE_DR LINE_CR <<<"$(docker exec supabase-db psql -U postgres -d "$DB" -t -A -F ' ' -c "
SELECT
  (SELECT id::text FROM journal_entry_lines WHERE journal_entry_id='$JE_F' AND debit>0 LIMIT 1),
  (SELECT id::text FROM journal_entry_lines WHERE journal_entry_id='$JE_F' AND credit>0 LIMIT 1);
")"
UPD_F=$(rest PATCH "/journal_entry_lines?id=eq.$LINE_CR" "{\"account_id\":\"$AP_IBRAHIM\"}")
CODE_UF=$(echo "$UPD_F" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE_UF" == "200" || "$CODE_UF" == "204" ]] || fail "Case F valid account edit http=$CODE_UF $(echo "$UPD_F"|sed '/HTTP_CODE:/d')"
ACCT_F=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT a.code FROM journal_entry_lines jel JOIN accounts a ON a.id=jel.account_id WHERE jel.id='$LINE_CR'")
[[ "$ACCT_F" == "AP-SUPZHD0026" ]] || fail "Case F edit target $ACCT_F"
UPD_BAD=$(rest PATCH "/journal_entry_lines?id=eq.$LINE_CR" "{\"account_id\":\"$OTHER_CO\"}")
CODE_BAD=$(echo "$UPD_BAD" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE_BAD" != "200" && "$CODE_BAD" != "204" ]] || fail "Case F bad cross-company edit should fail"
ACCT_F2=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT a.code FROM journal_entry_lines jel JOIN accounts a ON a.id=jel.account_id WHERE jel.id='$LINE_CR'")
[[ "$ACCT_F2" == "AP-SUPZHD0026" ]] || fail "Case F account changed after rejected edit"
DESC_BEFORE=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT account_id FROM journal_entry_lines WHERE id='$LINE_CR'")
HDR_UPD=$(rest PATCH "/journal_entries?id=eq.$JE_F" "{\"description\":\"case-F-desc-only\"}")
CODE_H=$(echo "$HDR_UPD" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE_H" == "200" || "$CODE_H" == "204" ]] || fail "Case F desc update http=$CODE_H"
DESC_AFTER=$(docker exec supabase-db psql -U postgres -d "$DB" -tAc "SELECT account_id FROM journal_entry_lines WHERE id='$LINE_CR'")
[[ "$DESC_BEFORE" == "$DESC_AFTER" ]] || fail "Case F desc edit remapped account"
pass "Case F edit guard OK (valid edit, invalid blocked, desc-only no remap)"

# -------- Case G: non-AP leaves (worker / courier / expense / cash) --------
G_OK=0
if [[ -n "${WORKER:-}" ]]; then
  ENTRY_G1="JE-UI-G1-$(date +%s)"
  OUT_G1=$(create_je "$ENTRY_G1" "$CASH" "$WORKER" 3.00 "case-G-worker" || true)
  CODE_G1=$(parse_lines_http "$OUT_G1")
  [[ "$CODE_G1" == "201" || "$CODE_G1" == "200" ]] || fail "Case G worker blocked http=$CODE_G1"
  pass "Case G worker/payable leaf OK"
  G_OK=1
else
  note "Case G worker leaf SKIPPED (no fixture)"
fi
if [[ -n "${COURIER:-}" ]]; then
  ENTRY_G2="JE-UI-G2-$(date +%s)"
  OUT_G2=$(create_je "$ENTRY_G2" "$CASH" "$COURIER" 3.00 "case-G-courier" || true)
  CODE_G2=$(parse_lines_http "$OUT_G2")
  [[ "$CODE_G2" == "201" || "$CODE_G2" == "200" ]] || fail "Case G courier blocked http=$CODE_G2"
  pass "Case G courier leaf OK"
  G_OK=1
else
  note "Case G courier leaf SKIPPED (no fixture)"
fi
if [[ -n "${EXPENSE:-}" ]]; then
  ENTRY_G3="JE-UI-G3-$(date +%s)"
  OUT_G3=$(create_je "$ENTRY_G3" "$EXPENSE" "$CASH" 3.00 "case-G-expense" || true)
  CODE_G3=$(parse_lines_http "$OUT_G3")
  [[ "$CODE_G3" == "201" || "$CODE_G3" == "200" ]] || fail "Case G expense blocked http=$CODE_G3"
  pass "Case G expense/cash leaf OK"
  G_OK=1
else
  note "Case G expense leaf SKIPPED (no fixture)"
fi
[[ "$G_OK" -ge 1 ]] || fail "Case G no non-AP fixtures available"
pass "Case G non-AP leaves not AP-only"

note "UI_PATH=AddEntryV2 assertPureJournalAccounts + accountingService.insert; DB trigger enforces; resolve RPC not called by frontend"
note "BROWSER_REACT_UI=UNVERIFIED (no ERP UI pointed at clone; app-path JWT+PostgREST covers save path)"

echo "UI_APP_PATH_E2E_OK" | tee -a "$EV"
echo "EVIDENCE_FILE=$EV"
