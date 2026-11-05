#!/usr/bin/env bash
set -euo pipefail

CLONE_DB="ledger_stage_20260919_prodcheck"
STAGE_DIR="/root/je-guard-stage"
AUTH_PORT=18081
REST_PORT=18080
COMPOSE_PROJECT="je-guard-stage"

mkdir -p "$STAGE_DIR"
cd "$STAGE_DIR"

openssl rand -hex 32 > "$STAGE_DIR/.jwt_secret"
chmod 600 "$STAGE_DIR/.jwt_secret"
JWT_SECRET="$(cat "$STAGE_DIR/.jwt_secret")"

python3 - <<'PY' > "$STAGE_DIR/keys.env"
import json, time, hmac, hashlib, base64
secret = open("/root/je-guard-stage/.jwt_secret","r").read().strip()

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

python3 - <<'PY'
import subprocess
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

def env_val(container, key):
    out = subprocess.check_output(
        ["docker", "inspect", container, "-f", "{{range .Config.Env}}{{println .}}{{end}}"],
        text=True,
    )
    prefix = key + "="
    for line in out.splitlines():
        if line.startswith(prefix):
            return line[len(prefix):]
    raise SystemExit(f"missing {key} on {container}")

def rewrite(uri, clone, extra_query=None):
    u = urlparse(uri)
    if "@" not in u.netloc:
        raise SystemExit(f"unexpected netloc: {u.scheme}://***")
    userinfo, hostport = u.netloc.rsplit("@", 1)
    port = hostport.split(":")[1] if ":" in hostport else "5432"
    # keep docker DNS name `db` on supabase_default
    netloc = f"{userinfo}@db:{port}"
    q = dict(parse_qsl(u.query, keep_blank_values=True))
    if extra_query:
        q.update(extra_query)
    return urlunparse((u.scheme, netloc, "/" + clone, "", urlencode(q), ""))

clone = "ledger_stage_20260919_prodcheck"
rest = rewrite(env_val("supabase-rest", "PGRST_DB_URI"), clone)

# GoTrue on clone must use postgres (superuser) — supabase_auth_admin is reserved
# and cannot take ownership after pg_restore --no-owner.
import os, re
env_text = open("/root/supabase/docker/.env").read()
m = re.search(r"^POSTGRES_PASSWORD=(.*)$", env_text, re.M)
if not m:
    raise SystemExit("POSTGRES_PASSWORD missing")
pw = m.group(1).strip().strip('"').strip("'")
from urllib.parse import quote
auth = f"postgres://postgres:{quote(pw, safe='')}@db:5432/{clone}?search_path=auth"

open("/root/je-guard-stage/_rest_uri", "w").write(rest)
open("/root/je-guard-stage/_auth_uri", "w").write(auth)
ru = urlparse(rest); au = urlparse(auth)
print(f"REST_HOST={ru.hostname} REST_DB={ru.path} AUTH_HOST={au.hostname} AUTH_DB={au.path} AUTH_USER={au.username} AUTH_Q={au.query}")
PY
chmod 600 "$STAGE_DIR/_rest_uri" "$STAGE_DIR/_auth_uri"

REST_URI="$(cat "$STAGE_DIR/_rest_uri")"
AUTH_URI="$(cat "$STAGE_DIR/_auth_uri")"

escape_yaml() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().rstrip("\n")))' <<<"$1"
}

cat > "$STAGE_DIR/docker-compose.yml" <<EOF
name: ${COMPOSE_PROJECT}
services:
  staging-rest:
    image: postgrest/postgrest:v14.3
    container_name: je-guard-staging-rest
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
    container_name: je-guard-staging-auth
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
      GOTRUE_SMTP_ADMIN_EMAIL: "staging-je-guard@localhost"
      GOTRUE_SMTP_HOST: "127.0.0.1"
      GOTRUE_SMTP_PORT: "1025"
      GOTRUE_SMTP_SENDER_NAME: "je-guard-stage"
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
EOF

cd "$STAGE_DIR"
docker compose -p "$COMPOSE_PROJECT" down --remove-orphans >/dev/null 2>&1 || true
docker compose -p "$COMPOSE_PROJECT" up -d

a=000; r=000
for i in $(seq 1 45); do
  a=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${AUTH_PORT}/health" 2>/dev/null || echo 000)
  r=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REST_PORT}/" 2>/dev/null || echo 000)
  if [[ "$a" == "200" && ( "$r" == "200" || "$r" == "401" ) ]]; then
    echo "HEALTH auth=$a rest=$r"
    docker ps --filter name=je-guard-staging --format '{{.Names}} {{.Status}} {{.Ports}}'
    echo "BOOTSTRAP_OK"
    exit 0
  fi
  sleep 1
done

echo "HEALTH_FAIL auth=$a rest=$r"
docker logs je-guard-staging-auth --tail 40 2>&1 | sed -E 's#postgres://[^@]+@#postgres://***@#g'
docker logs je-guard-staging-rest --tail 40 2>&1 | sed -E 's#postgres://[^@]+@#postgres://***@#g'
exit 1
