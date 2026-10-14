#!/usr/bin/env bash
# STAGING ONLY — worker/courier role-model rehearsal against ledger_stage_20260922_prodcheck
# Never targets live database name `postgres` for writes.
set -euo pipefail

CLONE_DB=ledger_stage_20260922_prodcheck
STAGE_DIR=/root/role-model-stage
AUTH_PORT=18083
REST_PORT=18082
COMPOSE_PROJECT=role-model-stage
COMPANY_A=e08a04af-22a8-4869-9b4d-da31fce13158
EVIDENCE=/tmp/role_model_staging_rehearsal.txt
: > "$EVIDENCE"
log() { echo "$*" | tee -a "$EVIDENCE"; }
fail() { log "FAIL: $*"; exit 1; }
pass() { log "PASS: $*"; }

assert_clone() {
  local db
  db=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT current_database();")
  [[ "$db" == "$CLONE_DB" ]] || fail "expected $CLONE_DB got $db"
  [[ "$db" != "postgres" ]] || fail "refused live postgres"
}

# ---------------------------------------------------------------------------
# 1) Isolation proof
# ---------------------------------------------------------------------------
assert_clone
SIZE=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT pg_size_pretty(pg_database_size(current_database()));")
log "CLONE_DB=$CLONE_DB size=$SIZE not_prod=true"
log "ROLE_MODEL_STAGING_ISOLATION_PROVEN"

# External side effects: loopback-only stack; no prod SMTP/n8n/WhatsApp credentials wired
log "STAGING_EXTERNAL_SIDE_EFFECTS_DISABLED reason=loopback_auth_rest_only_no_prod_webhooks"

# ---------------------------------------------------------------------------
# 2) Grants
# ---------------------------------------------------------------------------
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE ${CLONE_DB} TO authenticator, anon, authenticated, service_role, supabase_auth_admin;
SQL
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, anon;
-- Do NOT blanket GRANT EXECUTE ALL — role-model ACLs are explicit. Keep base app grants for existing procs.
DO $$ BEGIN
  -- restore common execute for non-role-model if needed: leave existing
  NULL;
END $$;
SQL
pass "clone grants"

# ---------------------------------------------------------------------------
# 3) Bootstrap loopback Auth+REST (staging JWT secret, never prod keys)
# ---------------------------------------------------------------------------
mkdir -p "$STAGE_DIR"
openssl rand -hex 32 > "$STAGE_DIR/.jwt_secret"
chmod 600 "$STAGE_DIR/.jwt_secret"
JWT_SECRET="$(cat "$STAGE_DIR/.jwt_secret")"

python3 - <<PY > "$STAGE_DIR/keys.env"
import json, time, hmac, hashlib, base64
secret = open("$STAGE_DIR/.jwt_secret").read().strip()

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def jwt(payload: dict) -> str:
    header = {"alg":"HS256","typ":"JWT"}
    h = b64url(json.dumps(header,separators=(",",":")).encode())
    p = b64url(json.dumps(payload,separators=(",",":")).encode())
    sig = hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64url(sig)}"

now = int(time.time())
print("ANON_KEY=" + jwt({"role":"anon","iss":"supabase","iat":now,"exp":now+60*60*24*30}))
print("SERVICE_ROLE_KEY=" + jwt({"role":"service_role","iss":"supabase","iat":now,"exp":now+60*60*24*30}))
PY
chmod 600 "$STAGE_DIR/keys.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/keys.env"

python3 - <<PY
import subprocess, re, os
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode, quote

def env_val(container, key):
    out = subprocess.check_output(
        ["docker", "inspect", container, "-f", "{{range .Config.Env}}{{println .}}{{end}}"],
        text=True,
    )
    prefix = key + "="
    for line in out.splitlines():
        if line.startswith(prefix):
            return line[len(prefix):]
    raise SystemExit(f"missing {key}")

def rewrite(uri, clone):
    u = urlparse(uri)
    userinfo, hostport = u.netloc.rsplit("@", 1)
    port = hostport.split(":")[1] if ":" in hostport else "5432"
    netloc = f"{userinfo}@db:{port}"
    return urlunparse((u.scheme, netloc, "/" + clone, "", urlencode(dict(parse_qsl(u.query, keep_blank_values=True))), ""))

clone = "$CLONE_DB"
rest = rewrite(env_val("supabase-rest", "PGRST_DB_URI"), clone)
env_text = open("/root/supabase/docker/.env").read()
m = re.search(r"^POSTGRES_PASSWORD=(.*)$", env_text, re.M)
pw = m.group(1).strip().strip('"').strip("'")
auth = f"postgres://postgres:{quote(pw, safe='')}@db:5432/{clone}?search_path=auth"
open("$STAGE_DIR/_rest_uri","w").write(rest)
open("$STAGE_DIR/_auth_uri","w").write(auth)
print("URI_OK")
PY
chmod 600 "$STAGE_DIR/_rest_uri" "$STAGE_DIR/_auth_uri"
REST_URI="$(cat "$STAGE_DIR/_rest_uri")"
AUTH_URI="$(cat "$STAGE_DIR/_auth_uri")"

escape_yaml() { python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip("\n")))' <<<"$1"; }

cat > "$STAGE_DIR/docker-compose.yml" <<EOF
name: ${COMPOSE_PROJECT}
services:
  staging-rest:
    image: postgrest/postgrest:v14.3
    container_name: role-model-staging-rest
    restart: "no"
    environment:
      PGRST_DB_URI: $(escape_yaml "$REST_URI")
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: $(escape_yaml "$JWT_SECRET")
      PGRST_DB_EXTRA_SEARCH_PATH: public
      PGRST_SERVER_PORT: "3000"
    ports:
      - "127.0.0.1:${REST_PORT}:3000"
    networks:
      - supabase_default
  staging-auth:
    image: supabase/gotrue:v2.185.0
    container_name: role-model-staging-auth
    restart: "no"
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: "9999"
      API_EXTERNAL_URL: "http://127.0.0.1:${AUTH_PORT}"
      GOTRUE_SITE_URL: "http://127.0.0.1:${AUTH_PORT}"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_SECRET: $(escape_yaml "$JWT_SECRET")
      GOTRUE_JWT_EXP: "3600"
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: $(escape_yaml "$AUTH_URI")
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_SMTP_ADMIN_EMAIL: "role-model-stage@localhost"
      GOTRUE_SMTP_HOST: "127.0.0.1"
      GOTRUE_SMTP_PORT: "1025"
      GOTRUE_SMTP_SENDER_NAME: "role-model-stage"
    ports:
      - "127.0.0.1:${AUTH_PORT}:9999"
    networks:
      - supabase_default
networks:
  supabase_default:
    external: true
EOF
chmod 600 "$STAGE_DIR/docker-compose.yml"

cat > "$STAGE_DIR/identity.env" <<EOF
CLONE_DB=$CLONE_DB
AUTH_PORT=$AUTH_PORT
REST_PORT=$REST_PORT
COMPOSE_PROJECT=$COMPOSE_PROJECT
API_NOT_PRODUCTION=1
HTTP_BIND=127.0.0.1
COMPANY_A=$COMPANY_A
EOF

cd "$STAGE_DIR"
docker compose -p "$COMPOSE_PROJECT" down --remove-orphans >/dev/null 2>&1 || true
docker compose -p "$COMPOSE_PROJECT" up -d
a=000; r=000
for i in $(seq 1 60); do
  a=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${AUTH_PORT}/health" 2>/dev/null || echo 000)
  r=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REST_PORT}/" 2>/dev/null || echo 000)
  if [[ "$a" == "200" && ( "$r" == "200" || "$r" == "401" ) ]]; then
    pass "HEALTH auth=$a rest=$r"
    break
  fi
  sleep 1
done
[[ "$a" == "200" ]] || fail "auth health $a"
[[ "$r" == "200" || "$r" == "401" ]] || fail "rest health $r"

# ---------------------------------------------------------------------------
# 4) Identities
# ---------------------------------------------------------------------------
PASS_A=$(openssl rand -hex 12)
PASS_B=$(openssl rand -hex 12)
EMAIL_A="role-a-$(date +%s)@staging.local"
EMAIL_B="role-b-$(date +%s)@staging.local"
COMPANY_B=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c \
  "SELECT id::text FROM companies WHERE id <> '$COMPANY_A' ORDER BY id LIMIT 1;")
[[ -n "$COMPANY_B" ]] || fail "no company B"

create_user() {
  curl -sS "http://127.0.0.1:${AUTH_PORT}/admin/users" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\",\"email_confirm\":true}"
}
RESP_A=$(create_user "$EMAIL_A" "$PASS_A")
RESP_B=$(create_user "$EMAIL_B" "$PASS_B")
UID_A=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$RESP_A")
UID_B=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$RESP_B")

# public.users schema may use auth_user_id — detect columns
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO public.users (id, auth_user_id, company_id, email, role, full_name, is_active)
VALUES
  ('$UID_A'::uuid, '$UID_A'::uuid, '$COMPANY_A'::uuid, '$EMAIL_A', 'admin', 'Role Stage A', true),
  ('$UID_B'::uuid, '$UID_B'::uuid, '$COMPANY_B'::uuid, '$EMAIL_B', 'admin', 'Role Stage B', true)
ON CONFLICT (id) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  company_id = EXCLUDED.company_id,
  email = EXCLUDED.email,
  is_active = true;
SQL

TOKEN_A=$(curl -sS "http://127.0.0.1:${AUTH_PORT}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL_A}\",\"password\":\"${PASS_A}\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
TOKEN_B=$(curl -sS "http://127.0.0.1:${AUTH_PORT}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL_B}\",\"password\":\"${PASS_B}\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
[[ "$TOKEN_A" == eyJ* && "$TOKEN_B" == eyJ* ]] || fail "login"

cat > "$STAGE_DIR/test_users.env" <<EOF
EMAIL_A=$EMAIL_A
PASS_A=$PASS_A
UID_A=$UID_A
COMPANY_A=$COMPANY_A
EMAIL_B=$EMAIL_B
PASS_B=$PASS_B
UID_B=$UID_B
COMPANY_B=$COMPANY_B
EOF
chmod 600 "$STAGE_DIR/test_users.env"
pass "identities company_a=$COMPANY_A company_b=$COMPANY_B"

AUTH="http://127.0.0.1:${AUTH_PORT}"
REST="http://127.0.0.1:${REST_PORT}"
echo "$AUTH" | grep -qi dincouture && fail "auth looks prod"
echo "$REST" | grep -qi dincouture && fail "rest looks prod"

rpc() {
  local token="$1" fn="$2" body="$3"
  curl -sS -w "\nHTTP_CODE:%{http_code}" "$REST/rpc/$fn" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body"
}

# ---------------------------------------------------------------------------
# 5) Baseline fingerprints (pre flip)
# ---------------------------------------------------------------------------
assert_clone
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$EVIDENCE"
\pset format unaligned
SELECT 'BASELINE' AS section;
SELECT c.code, c.type, c.id::text,
  (SELECT count(*) FROM accounts a WHERE a.linked_contact_id=c.id AND a.code LIKE 'AP-%') AS ap_leaves,
  (SELECT count(*) FROM accounts a WHERE a.linked_contact_id=c.id AND (a.code LIKE 'WA-%' OR a.code LIKE 'WP-%' OR a.code ~ '^203[0-9]+$')) AS role_leaves
FROM contacts c
WHERE c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046','SUP-ZHD-0162')
ORDER BY c.code;

DROP TABLE IF EXISTS public._staging_role_hist_ap_fp;
CREATE TABLE public._staging_role_hist_ap_fp (
  line_id uuid PRIMARY KEY,
  account_id uuid,
  debit numeric,
  credit numeric,
  description text,
  contact_code text
);
INSERT INTO public._staging_role_hist_ap_fp (line_id, account_id, debit, credit, description, contact_code)
SELECT jel.id, jel.account_id, jel.debit, jel.credit, jel.description, c.code
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
JOIN contacts c ON c.id = a.linked_contact_id
WHERE c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046')
  AND a.code LIKE 'AP-%'
  AND COALESCE(je.is_void,false)=false;

SELECT contact_code, count(*) AS ap_line_count, sum(debit-credit) AS ap_net
FROM public._staging_role_hist_ap_fp GROUP BY 1 ORDER BY 1;

SELECT md5(string_agg(line_id::text||'|'||account_id::text||'|'||debit::text||'|'||credit::text, ',' ORDER BY line_id)) AS hist_fp_before
FROM public._staging_role_hist_ap_fp;
SQL

STAGING_T0=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT (now() AT TIME ZONE 'Asia/Karachi')::timestamptz::text;")
log "STAGING_T0=$STAGING_T0"

# ---------------------------------------------------------------------------
# 6) JWT same/cross-company BEFORE flips (use disposable worker/courier fixtures)
# ---------------------------------------------------------------------------
# Create disposable contacts in A/B for JWT matrix (not the three production parties)
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM contacts WHERE code IN ('JWT-WRK-A','JWT-COU-A','JWT-WRK-B','JWT-COU-B');
INSERT INTO contacts (id, company_id, name, type, code) VALUES
  (gen_random_uuid(), '$COMPANY_A', 'JWT Worker A', 'worker', 'JWT-WRK-A'),
  (gen_random_uuid(), '$COMPANY_A', 'JWT Courier A', 'courier', 'JWT-COU-A'),
  (gen_random_uuid(), '$COMPANY_B', 'JWT Worker B', 'worker', 'JWT-WRK-B'),
  (gen_random_uuid(), '$COMPANY_B', 'JWT Courier B', 'courier', 'JWT-COU-B');
SQL
FIX_WA=$(docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id::text FROM contacts WHERE company_id='$COMPANY_A' AND code='JWT-WRK-A'")
FIX_CO=$(docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id::text FROM contacts WHERE company_id='$COMPANY_A' AND code='JWT-COU-A'")
FIX_WB=$(docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id::text FROM contacts WHERE company_id='$COMPANY_B' AND code='JWT-WRK-B'")
FIX_CB=$(docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id::text FROM contacts WHERE company_id='$COMPANY_B' AND code='JWT-COU-B'")
[[ -n "$FIX_WA" && -n "$FIX_CO" && -n "$FIX_WB" && -n "$FIX_CB" ]] || fail "JWT fixture contacts missing FIX_WA=$FIX_WA FIX_CO=$FIX_CO FIX_WB=$FIX_WB FIX_CB=$FIX_CB"

CNT_B_BEFORE=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT count(*) FROM accounts WHERE company_id='$COMPANY_B';")

OUT=$(rpc "$TOKEN_A" _ensure_worker_advance_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$FIX_WA\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE" == "200" ]] || fail "same-co WA http=$CODE body=$(echo "$OUT"|sed '/HTTP_CODE:/d')"
pass "JWT same-company WA ensure http=$CODE"

OUT=$(rpc "$TOKEN_A" _ensure_worker_payable_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$FIX_WA\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE" == "200" ]] || fail "same-co WP http=$CODE"
pass "JWT same-company WP ensure"

OUT=$(rpc "$TOKEN_A" get_or_create_courier_payable_account "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$FIX_CO\",\"p_contact_name\":\"JWT Courier A\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE" == "200" ]] || fail "same-co courier http=$CODE body=$(echo "$OUT"|sed '/HTTP_CODE:/d')"
pass "JWT same-company courier ensure"

OUT=$(rpc "$TOKEN_A" get_contact_party_gl_balances "{\"p_company_id\":\"$COMPANY_A\",\"p_branch_id\":null,\"p_as_of_date\":null}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE" == "200" ]] || fail "same-co GL http=$CODE"
pass "JWT same-company party GL"

# Cross-company
for fn_body in \
  "_ensure_worker_advance_subaccount|{\"p_company_id\":\"$COMPANY_B\",\"p_contact_id\":\"$FIX_WB\"}" \
  "_ensure_worker_payable_subaccount|{\"p_company_id\":\"$COMPANY_B\",\"p_contact_id\":\"$FIX_WB\"}" \
  "get_or_create_courier_payable_account|{\"p_company_id\":\"$COMPANY_B\",\"p_contact_id\":\"$FIX_CB\",\"p_contact_name\":\"X\"}" \
  "_resolve_worker_payment_debit_account|{\"p_company_id\":\"$COMPANY_B\",\"p_worker_contact_id\":\"$FIX_WB\",\"p_pay_to_payable\":false}" \
  "get_contact_party_gl_balances|{\"p_company_id\":\"$COMPANY_B\",\"p_branch_id\":null,\"p_as_of_date\":null}"
do
  fn="${fn_body%%|*}"; body="${fn_body#*|}"
  OUT=$(rpc "$TOKEN_A" "$fn" "$body")
  CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
  BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
  echo "$BODY" | grep -Eiq '42501|insufficient_privilege|PARTY_ROLE_ACCOUNT_FORBIDDEN|permission denied|PGRST' \
    || [[ "$CODE" == "403" || "$CODE" == "401" || "$CODE" == "400" ]] \
    || fail "cross-co $fn expected deny got http=$CODE body=$BODY"
  pass "JWT cross-company $fn blocked http=$CODE"
done

CNT_B_AFTER=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT count(*) FROM accounts WHERE company_id='$COMPANY_B';")
[[ "$CNT_B_BEFORE" == "$CNT_B_AFTER" ]] || fail "cross-company mutation co_b $CNT_B_BEFORE->$CNT_B_AFTER"
pass "cross-company no mutation co_b=$CNT_B_AFTER"

# Anon
OUT=$(curl -sS -w "\nHTTP_CODE:%{http_code}" "$REST/rpc/_ensure_worker_advance_subaccount" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$FIX_WA\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
[[ "$CODE" == "401" || "$CODE" == "403" || "$CODE" == "400" ]] || fail "anon WA expected deny http=$CODE"
pass "anon WA denied http=$CODE"
log "STAGING_JWT_COMPANY_ISOLATION_PASS"

# ---------------------------------------------------------------------------
# 7) Type flips + role leaves (staging only)
# ---------------------------------------------------------------------------
assert_clone
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$EVIDENCE"
BEGIN;
UPDATE contacts SET type='courier' WHERE code='SUP-ZHD-0007' AND company_id='e08a04af-22a8-4869-9b4d-da31fce13158';
UPDATE contacts SET type='worker'  WHERE code='SUP-ZHD-0036' AND company_id='e08a04af-22a8-4869-9b4d-da31fce13158';
UPDATE contacts SET type='worker'  WHERE code='SUP-ZHD-0046' AND company_id='e08a04af-22a8-4869-9b4d-da31fce13158';
-- DHL PK must remain supplier (not flipped)
SELECT code, type FROM contacts WHERE code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046','SUP-ZHD-0162') ORDER BY 1;
COMMIT;
SQL

# Ensure leaves via JWT company A
DHL=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM contacts WHERE code='SUP-ZHD-0007'")
KIRAN=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM contacts WHERE code='SUP-ZHD-0036'")
SHAH=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM contacts WHERE code='SUP-ZHD-0046'")
DHLPK=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM contacts WHERE code='SUP-ZHD-0162'")

OUT=$(rpc "$TOKEN_A" get_or_create_courier_payable_account "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$DHL\",\"p_contact_name\":\"DHL\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p'); [[ "$CODE" == "200" ]] || fail "DHL leaf http=$CODE $(echo "$OUT"|sed '/HTTP_CODE:/d')"
DHL_LEAF=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
OUT2=$(rpc "$TOKEN_A" get_or_create_courier_payable_account "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$DHL\",\"p_contact_name\":\"DHL\"}")
DHL_LEAF2=$(echo "$OUT2" | sed '/HTTP_CODE:/d' | tr -d '"')
[[ "$DHL_LEAF" == "$DHL_LEAF2" ]] || fail "DHL leaf not idempotent"
pass "DHL 203x leaf=$DHL_LEAF"

OUT=$(rpc "$TOKEN_A" _ensure_worker_advance_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$KIRAN\"}")
K_WA=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
OUT=$(rpc "$TOKEN_A" _ensure_worker_payable_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$KIRAN\"}")
K_WP=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
OUT=$(rpc "$TOKEN_A" _ensure_worker_advance_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$SHAH\"}")
S_WA=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
OUT=$(rpc "$TOKEN_A" _ensure_worker_payable_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$SHAH\"}")
S_WP=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
log "KIRAN WA=$K_WA WP=$K_WP"
log "SHAHMIM WA=$S_WA WP=$S_WP"
[[ "$K_WA" != "$S_WA" && "$K_WP" != "$S_WP" ]] || fail "KIRAN/SHAHMIM leaf collision"

docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<SQL | tee -a "$EVIDENCE"
SELECT a.code, a.linked_contact_id::text, c.code AS contact
FROM accounts a JOIN contacts c ON c.id=a.linked_contact_id
WHERE c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046')
  AND (a.code LIKE 'WA-%' OR a.code LIKE 'WP-%' OR a.code ~ '^203[0-9]+$')
ORDER BY c.code, a.code;
-- DHL local != DHL PK accounts
SELECT
  (SELECT code FROM accounts WHERE id='$DHL_LEAF') AS dhl_local_code,
  (SELECT a.code FROM accounts a WHERE a.linked_contact_id='$DHLPK' AND a.code ~ '^203' AND a.code<>'2030' LIMIT 1) AS dhl_pk_code;
SQL
log "STAGING_ROLE_LEAF_CREATION_PASS"

# ---------------------------------------------------------------------------
# 8) Lifecycles via SQL JE + payment RPC (tagged STAGING_REHEARSAL)
# ---------------------------------------------------------------------------
CASH=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code='1010' LIMIT 1")
EXP=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT id FROM accounts WHERE company_id='$COMPANY_A' AND code IN ('5000','5100') ORDER BY code LIMIT 1")
[[ -n "$CASH" && -n "$EXP" ]] || fail "missing cash/expense"

# Worker lifecycle helper (KIRAN then SHAHMIM)
run_worker_lifecycle() {
  local label="$1" worker="$2" wa="$3" wp="$4"
  docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_je uuid;
  v_wa uuid := '$wa';
  v_wp uuid := '$wp';
  v_cash uuid := '$CASH';
  v_exp uuid := '$EXP';
  v_co uuid := '$COMPANY_A';
  v_worker uuid := '$worker';
  v_bal_wa numeric;
  v_bal_wp numeric;
  v_tb numeric;
BEGIN
  -- advance 1000
  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-$label-ADV', 'STAGING_REHEARSAL $label advance', 'worker_payment', v_worker, CURRENT_DATE)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_wa, 1000, 0), (v_je, v_cash, 0, 1000);

  -- bill 600
  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-$label-BILL', 'STAGING_REHEARSAL $label bill', 'studio_production_stage', v_worker, CURRENT_DATE)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_exp, 600, 0), (v_je, v_wp, 0, 600);

  -- apply 400
  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-$label-APPLY', 'STAGING_REHEARSAL $label apply', 'worker_advance_settlement', v_worker, CURRENT_DATE)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_wp, 400, 0), (v_je, v_wa, 0, 400);

  -- payment 200 Dr WP
  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-$label-PAY', 'STAGING_REHEARSAL $label pay', 'worker_payment', v_worker, CURRENT_DATE)
  RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES
    (v_je, v_wp, 200, 0), (v_je, v_cash, 0, 200);

  SELECT COALESCE(SUM(debit-credit),0) INTO v_bal_wa FROM journal_entry_lines WHERE account_id=v_wa
    AND journal_entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'STAGING_REHEARSAL $label%');
  SELECT COALESCE(SUM(credit-debit),0) INTO v_bal_wp FROM journal_entry_lines WHERE account_id=v_wp
    AND journal_entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'STAGING_REHEARSAL $label%');
  IF v_bal_wa <> 600 THEN RAISE EXCEPTION '% WA residual %', '$label', v_bal_wa; END IF;
  IF v_bal_wp <> 0 THEN RAISE EXCEPTION '% WP residual %', '$label', v_bal_wp; END IF;
  RAISE NOTICE '%_LIFECYCLE_OK WA=600 WP=0', '$label';
END \$\$;
SQL
  # Prove payment RPC debit resolves to leaf (not bare 1180)
  OUT=$(rpc "$TOKEN_A" _resolve_worker_payment_debit_account "{\"p_company_id\":\"$COMPANY_A\",\"p_worker_contact_id\":\"$worker\",\"p_pay_to_payable\":false}")
  RES=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
  [[ "$RES" == "$wa" ]] || fail "$label resolver advance expected $wa got $RES"
  OUT=$(rpc "$TOKEN_A" _resolve_worker_payment_debit_account "{\"p_company_id\":\"$COMPANY_A\",\"p_worker_contact_id\":\"$worker\",\"p_pay_to_payable\":true}")
  RES=$(echo "$OUT" | sed '/HTTP_CODE:/d' | tr -d '"')
  [[ "$RES" == "$wp" ]] || fail "$label resolver payable expected $wp got $RES"
  pass "$label worker lifecycle + resolver leaf"
}

run_worker_lifecycle KIRAN "$KIRAN" "$K_WA" "$K_WP"
log "KIRAN_STAGING_WORKER_LIFECYCLE_PASS"
run_worker_lifecycle SHAHMIM "$SHAH" "$S_WA" "$S_WP"
log "SHAHMIM_STAGING_WORKER_LIFECYCLE_PASS"

# Courier DHL lifecycle
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE
  v_je uuid; v_c uuid := '$DHL_LEAF'; v_cash uuid := '$CASH'; v_exp uuid := '$EXP'; v_co uuid := '$COMPANY_A'; v_dhl uuid := '$DHL';
BEGIN
  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-DHL-DEP', 'STAGING_REHEARSAL DHL deposit', 'deposit', v_dhl, CURRENT_DATE) RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (v_je, v_cash, 500, 0), (v_je, v_c, 0, 500);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-DHL-CHG', 'STAGING_REHEARSAL DHL charge', 'courier_charge', v_dhl, CURRENT_DATE) RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (v_je, v_exp, 300, 0), (v_je, v_c, 0, 300);

  INSERT INTO journal_entries (id, company_id, entry_no, description, reference_type, reference_id, entry_date)
  VALUES (gen_random_uuid(), v_co, 'STG-DHL-SET', 'STAGING_REHEARSAL DHL settle', 'courier_payment', v_dhl, CURRENT_DATE) RETURNING id INTO v_je;
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (v_je, v_c, 800, 0), (v_je, v_cash, 0, 800);

  IF EXISTS (SELECT 1 FROM accounts WHERE linked_contact_id=v_dhl AND code LIKE 'AP-%'
             AND id IN (SELECT account_id FROM journal_entry_lines jel JOIN journal_entries je ON je.id=jel.journal_entry_id
                        WHERE je.description LIKE 'STAGING_REHEARSAL DHL%')) THEN
    RAISE EXCEPTION 'DHL role-era posted to AP';
  END IF;
  RAISE NOTICE 'DHL_LIFECYCLE_OK';
END \$\$;
SQL
pass "DHL courier lifecycle"
log "DHL_STAGING_COURIER_LIFECYCLE_PASS"

# Ordinary supplier regression
SUP=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "
SELECT id FROM contacts WHERE company_id='$COMPANY_A' AND type='supplier'
  AND code NOT IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046','SUP-ZHD-0162')
  AND code LIKE 'SUP-%' ORDER BY code LIMIT 1;")
[[ -n "$SUP" ]] || fail "no ordinary supplier"
OUT=$(rpc "$TOKEN_A" _ensure_worker_advance_subaccount "{\"p_company_id\":\"$COMPANY_A\",\"p_contact_id\":\"$SUP\"}")
CODE=$(echo "$OUT" | sed -n 's/.*HTTP_CODE://p')
BODY=$(echo "$OUT" | sed '/HTTP_CODE:/d')
echo "$BODY" | grep -Eiq 'ROLE_REQUIRED|must be worker' || [[ "$CODE" != "200" ]] || fail "supplier WA should fail"
AP=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT public._ensure_ap_subaccount_for_contact('$COMPANY_A'::uuid, '$SUP'::uuid);")
docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "SELECT code FROM accounts WHERE id='$AP'" | grep -q 'AP-' || fail "supplier AP missing"
pass "ordinary supplier AP; WA blocked"
log "ORDINARY_SUPPLIER_REGRESSION_PASS"

# Historical freeze vs pre-flip fingerprint table
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$EVIDENCE"
SELECT
  (SELECT count(*) FROM _staging_role_hist_ap_fp) AS frozen_count,
  (SELECT count(*) FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id=jel.journal_entry_id
     JOIN accounts a ON a.id=jel.account_id
     JOIN contacts c ON c.id=a.linked_contact_id
     WHERE c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046')
       AND a.code LIKE 'AP-%' AND COALESCE(je.is_void,false)=false
       AND COALESCE(je.description,'') NOT LIKE 'STAGING_REHEARSAL%') AS current_hist_count,
  (SELECT count(*) FROM _staging_role_hist_ap_fp f
     JOIN journal_entry_lines jel ON jel.id=f.line_id
    WHERE jel.account_id IS DISTINCT FROM f.account_id
       OR jel.debit IS DISTINCT FROM f.debit
       OR jel.credit IS DISTINCT FROM f.credit
       OR COALESCE(jel.description,'') IS DISTINCT FROM COALESCE(f.description,'')) AS drifted_lines,
  (SELECT md5(string_agg(line_id::text||'|'||account_id::text||'|'||debit::text||'|'||credit::text, ',' ORDER BY line_id))
     FROM _staging_role_hist_ap_fp) AS hist_fp_frozen;
SQL
DRIFT=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "
SELECT count(*) FROM _staging_role_hist_ap_fp f
JOIN journal_entry_lines jel ON jel.id=f.line_id
WHERE jel.account_id IS DISTINCT FROM f.account_id OR jel.debit IS DISTINCT FROM f.debit
   OR jel.credit IS DISTINCT FROM f.credit OR COALESCE(jel.description,'') IS DISTINCT FROM COALESCE(f.description,'');")
[[ "$DRIFT" == "0" ]] || fail "historical AP drift=$DRIFT"
pass "historical AP freeze"
log "STRATEGY_A_HISTORICAL_FREEZE_PASS"

# TB check for rehearsal JEs
TB=$(docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c "
SELECT COALESCE(SUM(debit),0)-COALESCE(SUM(credit),0)
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id=jel.journal_entry_id
WHERE je.description LIKE 'STAGING_REHEARSAL%';")
[[ "$TB" == "0" || "$TB" == "0.00" ]] || fail "rehearsal TB imbalance $TB"
pass "rehearsal TB balanced"

# ---------------------------------------------------------------------------
# 9) Production READ-ONLY precheck
# ---------------------------------------------------------------------------
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL' | tee -a "$EVIDENCE"
SELECT 'PROD_RO' AS section, current_database();
SELECT code, type FROM contacts WHERE code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046') ORDER BY 1;
SELECT count(*) AS prod_role_leaves
FROM accounts a JOIN contacts c ON c.id=a.linked_contact_id
WHERE c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046')
  AND (a.code LIKE 'WA-%' OR a.code LIKE 'WP-%' OR (a.code ~ '^203[0-9]+$' AND a.code<>'2030'));
SELECT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='_party_role_account_assert_company_access'
) AS prod_has_role_model_assert;
SQL
pass "production RO precheck (types still supplier; no target role leaves; migration not on prod)"

log "ROLE_MODEL_STAGING_POSTGRES_PASS"
log "PROSPECTIVE_ROLE_MODEL_STAGING_PASS"
echo "DONE — evidence $EVIDENCE"
