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

[[ -d "$STAGE_DIR" ]] || die "missing $STAGE_DIR"
cd "$STAGE_DIR"

out "======== 1) Container status ========"
docker ps -a --filter name=stage-supabase --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | tee /tmp/stage-studio-ps.txt
out ""

STUDIO_UP="$(docker ps --filter name=^stage-supabase-studio$ --format '{{.Names}}' || true)"
META_UP="$(docker ps --filter name=^stage-supabase-meta$ --format '{{.Names}}' || true)"

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

# Auth/connection error scan (informational; restart below remediates)
AUTH_HITS="$(
  {
    docker logs --tail 200 stage-supabase-studio 2>&1 || true
    docker logs --tail 200 stage-supabase-meta 2>&1 || true
  } | grep -Eic 'password authentication failed|FATAL:.*auth|ECONNREFUSED|connection refused|invalid password|role .* does not exist' || true
)"
out "  auth/connection error hits (last 200 lines): ${AUTH_HITS:-0}"

out "======== 3) Restart studio + meta ========"
# Prefer compose project already used by staging deploy
COMPOSE_ARGS=(-f docker-compose.yml)
[[ -f docker-compose.stage-ports.yml ]] && COMPOSE_ARGS+=(-f docker-compose.stage-ports.yml)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

log "docker compose ${COMPOSE_ARGS[*]} -p supabase-stage up -d studio meta"
docker compose "${COMPOSE_ARGS[@]}" -p supabase-stage up -d studio meta 2>&1 || {
  # Fallback: restart by container name if compose service names differ
  log "compose up failed; falling back to docker start/restart"
  docker start stage-supabase-studio stage-supabase-meta 2>/dev/null || true
  docker restart stage-supabase-studio stage-supabase-meta 2>/dev/null || true
}

# Give Next.js studio a moment after restart
sleep 5
docker ps --filter name='stage-supabase-(studio|meta)' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
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

# Internal Docker target must be container port 3000 (host publish is 3010:3000).
grep -q 'Host(`db-stage.ndmcore.com`)' "$DYNAMIC_FILE" || die "db-stage host missing in Traefik YAML"
grep -q 'url: http://stage-supabase-studio:3000' "$DYNAMIC_FILE" || die "studio service must target stage-supabase-studio:3000"
grep -q 'certResolver: letsencrypt' "$DYNAMIC_FILE" || die "letsencrypt certResolver missing"

if ! docker network inspect "$STAGE_NET" >/dev/null 2>&1; then
  die "docker network $STAGE_NET not found"
fi
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
# Prefer public DNS; if VPS resolver lacks the name, use Cloudflare DNS / --resolve fallback
PUBLIC_IP="$(getent ahostsv4 "$STUDIO_HOST" 2>/dev/null | awk '{print $1; exit}' || true)"
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(dig +short "$STUDIO_HOST" A @1.1.1.1 2>/dev/null | head -1 || true)"
fi
CURL_EXTRA=()
if [[ -n "${PUBLIC_IP:-}" ]]; then
  CURL_EXTRA=(--resolve "${STUDIO_HOST}:443:${PUBLIC_IP}")
  out "  resolve ${STUDIO_HOST} → ${PUBLIC_IP}"
fi

PUBLIC_CODE="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${STUDIO_HOST}/" || true)"
PUBLIC_FOLLOW="$(curl -skS -o /dev/null -w '%{http_code}' -L --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${STUDIO_HOST}/" || true)"
PUBLIC_CT="$(curl -skS -I -L --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${STUDIO_HOST}/" 2>/dev/null | awk -F': ' 'tolower($1)=="content-type"{gsub(/\r/,"",$2); print $2; exit}' || true)"
out "  https://${STUDIO_HOST}/ → $PUBLIC_CODE (follow → $PUBLIC_FOLLOW) content-type=${PUBLIC_CT:-unknown}"

# Also hit Traefik on localhost:443 with Host header when available
LOCAL_TRAEFIK="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 \
  --resolve "${STUDIO_HOST}:443:127.0.0.1" "https://${STUDIO_HOST}/" 2>/dev/null || true)"
out "  Traefik localhost Host=${STUDIO_HOST} → ${LOCAL_TRAEFIK:-n/a}"

[[ "$PUBLIC_CODE" =~ ^(200|301|302|307|308)$ ]] || die "public Studio unhealthy ($PUBLIC_CODE)"
[[ "$PUBLIC_FOLLOW" =~ ^(200)$ ]] || die "public Studio follow failed ($PUBLIC_FOLLOW)"
out "  PUBLIC: OK — open https://${STUDIO_HOST} in browser (no SSH tunnel needed)"
out ""

out "======== CONFIRMATION ========"
docker ps --filter name=^stage-supabase-studio$ --format 'studio={{.Names}} status={{.Status}} ports={{.Ports}}'
out "local_3010=$LOCAL_CODE"
out "public_https=${PUBLIC_CODE}/${PUBLIC_FOLLOW}"
out "db_stage_direct_load=YES"
out "TRAFFIK_TARGET=http://stage-supabase-studio:3000 (host publish 3010→3000)"
out "All studio checks passed."
