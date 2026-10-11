#!/usr/bin/env bash
# Fix & verify Staging Supabase Studio (local :3010 + https://db-stage.ndmcore.com).
# Does NOT touch production Supabase or ERP :3001.
set -euo pipefail

STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
STAGE_NET="${STAGE_NET:-stage-supabase-net}"
TRAEFIK_NAME="${TRAEFIK_NAME:-dokploy-traefik}"
DYNAMIC_FILE="${DYNAMIC_FILE:-/etc/dokploy/traefik/dynamic/supabase-stage.yml}"
REPO_ROOT="${REPO_ROOT:-/root/NEWPOSV3}"
STUDIO_HOST="${STUDIO_HOST:-db-stage.ndmcore.com}"

log() { echo "[fix-studio $(date -u +%H:%M:%S)] $*"; }
die() { echo "[fix-studio ERROR] $*" >&2; exit 1; }
out() { echo "$*"; }

read_env_val() {
  local key="$1" file="${2:-.env}"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" | tr -d '\r'
}

apply_stage_pg_passwords() {
  local user="$1"
  python3 - "$PG_PASS" <<'PY' | docker exec -i stage-supabase-db psql -U "$user" -d postgres -v ON_ERROR_STOP=1
import sys
pw = sys.argv[1].replace("'", "''")
print(f"ALTER ROLE postgres WITH PASSWORD '{pw}';")
print(f"ALTER ROLE supabase_admin WITH PASSWORD '{pw}';")
PY
}

[[ -d "$STAGE_DIR" ]] || die "missing $STAGE_DIR"
cd "$STAGE_DIR"

out "======== 1) Container status ========"
docker ps -a --filter name=stage-supabase --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | tee /tmp/stage-studio-ps.txt
out ""

out "======== 2) Studio / Meta logs (tail 50) ========"
if docker ps -a --format '{{.Names}}' | grep -qx 'stage-supabase-studio'; then
  out "--- stage-supabase-studio ---"
  docker logs --tail 50 stage-supabase-studio 2>&1 | sed 's/^/  /' || true
else
  out "  stage-supabase-studio: container missing"
fi
if docker ps -a --format '{{.Names}}' | grep -qx 'stage-supabase-meta'; then
  out "--- stage-supabase-meta ---"
  docker logs --tail 50 stage-supabase-meta 2>&1 | sed 's/^/  /' || true
else
  out "  stage-supabase-meta: container missing"
fi
out ""

AUTH_HITS="$(
  {
    docker logs --tail 200 stage-supabase-studio 2>&1 || true
    docker logs --tail 200 stage-supabase-meta 2>&1 || true
  } | grep -Eic 'password authentication failed|FATAL:.*auth|ECONNREFUSED|connection refused|invalid password|role .* does not exist' || true
)"
out "  auth/connection error hits (last 200 lines): ${AUTH_HITS:-0}"

out "======== 3) Sync PG password env → recreate studio/meta (+ unhealthy clients) ========"
# Never `source .env` — unquoted values abort under set -e.
COMPOSE_ARGS=(--env-file .env -f docker-compose.yml)
[[ -f docker-compose.stage-ports.yml ]] && COMPOSE_ARGS+=(-f docker-compose.stage-ports.yml)

PG_PASS="$(read_env_val POSTGRES_PASSWORD)"
[[ -n "$PG_PASS" ]] || die "POSTGRES_PASSWORD missing in $STAGE_DIR/.env"

log "ALTER ROLE postgres + supabase_admin to match POSTGRES_PASSWORD (staging DB only)"
if ! apply_stage_pg_passwords supabase_admin; then
  log "supabase_admin alter failed; retrying as postgres"
  apply_stage_pg_passwords postgres
fi

RECREATE_SVCS=(studio meta)
for c in stage-supabase-auth stage-supabase-rest stage-supabase-storage stage-supabase-pooler; do
  st="$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)"
  if [[ "$st" == "restarting" || "$st" == "exited" || "$st" == "dead" ]]; then
    case "$c" in
      stage-supabase-auth) RECREATE_SVCS+=(auth) ;;
      stage-supabase-rest) RECREATE_SVCS+=(rest) ;;
      stage-supabase-storage) RECREATE_SVCS+=(storage) ;;
      stage-supabase-pooler)
        POOLER_SVC="$(docker compose "${COMPOSE_ARGS[@]}" -p supabase-stage config --services 2>/dev/null | grep -E '^(pooler|supavisor)$' | head -1 || true)"
        RECREATE_SVCS+=("${POOLER_SVC:-supavisor}")
        ;;
    esac
  fi
done

RECREATE_UNIQ=()
for s in "${RECREATE_SVCS[@]}"; do
  skip=0
  for u in "${RECREATE_UNIQ[@]:-}"; do [[ "$u" == "$s" ]] && skip=1 && break; done
  [[ $skip -eq 0 && -n "$s" ]] && RECREATE_UNIQ+=("$s")
done
RECREATE_SVCS=("${RECREATE_UNIQ[@]}")

log "docker compose -p supabase-stage up -d --force-recreate --no-deps ${RECREATE_SVCS[*]}"
if ! docker compose "${COMPOSE_ARGS[@]}" -p supabase-stage up -d --force-recreate --no-deps "${RECREATE_SVCS[@]}" 2>&1; then
  log "compose recreate failed; falling back to docker restart studio/meta"
  docker restart stage-supabase-studio stage-supabase-meta 2>/dev/null || true
fi

for _ in 1 2 3 4 5 6 7 8 9 10; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -I --connect-timeout 3 http://127.0.0.1:3010/ || true)"
  [[ "$code" =~ ^(200|301|302|307|308)$ ]] && break
  sleep 2
done
docker ps --filter name=stage-supabase-studio --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker ps --filter name=stage-supabase-meta --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

sleep 3
FRESH_AUTH_FAILS="$(docker logs --since 30s stage-supabase-meta 2>&1 | grep -c 'password authentication failed' || true)"
out "  meta password failures in last 30s: ${FRESH_AUTH_FAILS:-0}"
if [[ "${FRESH_AUTH_FAILS:-0}" -gt 5 ]]; then
  die "meta still failing PG auth after password sync + recreate"
fi
out ""

out "======== 4) Local HTTP :3010 ========"
LOCAL_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 http://127.0.0.1:3010/ || true)"
LOCAL_LOC="$(curl -sS -I --connect-timeout 8 http://127.0.0.1:3010/ 2>/dev/null | awk -F': ' 'tolower($1)=="location"{gsub(/\r/,"",$2); print $2; exit}' || true)"
out "  curl -I http://127.0.0.1:3010/ → $LOCAL_CODE location=${LOCAL_LOC:-none}"
[[ "$LOCAL_CODE" =~ ^(200|301|302|307|308)$ ]] || die "local Studio unhealthy ($LOCAL_CODE)"
out "  LOCAL: OK"
out ""

out "======== 5) Traefik route for ${STUDIO_HOST} ========"
REPO_TRAEFIK="$REPO_ROOT/deploy/supabase-stage-traefik.yml"
if [[ ! -f "$REPO_TRAEFIK" && -f "$(dirname "$0")/../deploy/supabase-stage-traefik.yml" ]]; then
  REPO_TRAEFIK="$(cd "$(dirname "$0")/.." && pwd)/deploy/supabase-stage-traefik.yml"
fi
[[ -f "$REPO_TRAEFIK" ]] || die "missing deploy/supabase-stage-traefik.yml"

mkdir -p "$(dirname "$DYNAMIC_FILE")"
cp "$REPO_TRAEFIK" "$DYNAMIC_FILE"
chmod 644 "$DYNAMIC_FILE"
log "Wrote $DYNAMIC_FILE"

# Host publish is 3010→3000; Traefik on Docker net targets container :3000.
grep -q 'Host(`db-stage.ndmcore.com`)' "$DYNAMIC_FILE" || die "db-stage host missing in Traefik YAML"
grep -q 'url: http://stage-supabase-studio:3000' "$DYNAMIC_FILE" || die "studio service must target stage-supabase-studio:3000"
grep -q 'certResolver: letsencrypt' "$DYNAMIC_FILE" || die "letsencrypt certResolver missing"

docker network inspect "$STAGE_NET" >/dev/null 2>&1 || die "docker network $STAGE_NET not found"
if docker ps --format '{{.Names}}' | grep -qx "$TRAEFIK_NAME"; then
  if docker inspect "$TRAEFIK_NAME" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -qw "$STAGE_NET"; then
    log "$TRAEFIK_NAME already on $STAGE_NET"
  else
    log "Connecting $TRAEFIK_NAME → $STAGE_NET"
    docker network connect "$STAGE_NET" "$TRAEFIK_NAME"
  fi
else
  die "$TRAEFIK_NAME not running"
fi

out "  Traefik routers/services:"
grep -E 'Host\(|url:|certResolver' "$DYNAMIC_FILE" | sed 's/^/  /'
out "  TRAEFIK YAML: OK"
out ""

out "======== 6) Public https://${STUDIO_HOST} ========"
PUBLIC_IP="$(getent ahostsv4 "$STUDIO_HOST" 2>/dev/null | awk '{print $1; exit}' || true)"
if [[ -z "$PUBLIC_IP" ]] && command -v dig >/dev/null 2>&1; then
  PUBLIC_IP="$(dig +short "$STUDIO_HOST" A @1.1.1.1 2>/dev/null | head -1 || true)"
fi
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="104.21.40.151"
  out "  using Cloudflare fallback IP for resolve"
fi
CURL_EXTRA=(--resolve "${STUDIO_HOST}:443:${PUBLIC_IP}")
out "  resolve ${STUDIO_HOST} → ${PUBLIC_IP}"

PUBLIC_CODE="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${STUDIO_HOST}/" || true)"
PUBLIC_FOLLOW="$(curl -skS -o /dev/null -w '%{http_code}' -L --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${STUDIO_HOST}/" || true)"
PUBLIC_CT="$(curl -skS -I -L --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${STUDIO_HOST}/" 2>/dev/null | awk -F': ' 'tolower($1)=="content-type"{gsub(/\r/,"",$2); print $2; exit}' || true)"
out "  https://${STUDIO_HOST}/ → $PUBLIC_CODE (follow → $PUBLIC_FOLLOW) content-type=${PUBLIC_CT:-unknown}"

LOCAL_TRAEFIK="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 \
  --resolve "${STUDIO_HOST}:443:127.0.0.1" "https://${STUDIO_HOST}/" 2>/dev/null || true)"
out "  Traefik localhost Host=${STUDIO_HOST} → ${LOCAL_TRAEFIK:-n/a}"

[[ "$PUBLIC_CODE" =~ ^(200|301|302|307|308)$ ]] || die "public Studio unhealthy ($PUBLIC_CODE)"
[[ "$PUBLIC_FOLLOW" == "200" ]] || die "public Studio follow failed ($PUBLIC_FOLLOW)"
out "  PUBLIC: OK — open https://${STUDIO_HOST} in browser (no SSH tunnel needed)"
out ""

out "======== CONFIRMATION ========"
docker ps --filter name=stage-supabase-studio --format 'studio={{.Names}} status={{.Status}} ports={{.Ports}}'
out "local_3010=$LOCAL_CODE"
out "public_https=${PUBLIC_CODE}/${PUBLIC_FOLLOW}"
out "db_stage_direct_load=YES"
out "TRAEFIK_TARGET=http://stage-supabase-studio:3000 (host publish 3010→3000)"
out "All studio checks passed."
