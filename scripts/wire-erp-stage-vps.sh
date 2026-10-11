#!/usr/bin/env bash
# Wire https://erp-stage.ndmcore.com → erp-frontend-preview (:3002 staging bake).
# Does NOT touch production erp-frontend (:3001) or production Supabase.
set -euo pipefail

STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
STAGE_NET="${STAGE_NET:-stage-supabase-net}"
PREVIEW_NET="${PREVIEW_NET:-erp-preview_net}"
TRAEFIK_NAME="${TRAEFIK_NAME:-dokploy-traefik}"
DYNAMIC_FILE="${DYNAMIC_FILE:-/etc/dokploy/traefik/dynamic/supabase-stage.yml}"
REPO_ROOT="${REPO_ROOT:-/root/NEWPOSV3}"
ERP_STAGE_HOST="${ERP_STAGE_HOST:-erp-stage.ndmcore.com}"
STAGE_API_URL="${STAGE_API_URL:-https://api-stage.ndmcore.com}"

log() { echo "[wire-erp-stage $(date -u +%H:%M:%S)] $*"; }
die() { echo "[wire-erp-stage ERROR] $*" >&2; exit 1; }
out() { echo "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || die "missing $1"; }
need docker
need curl

docker ps --format '{{.Names}}' | grep -qx 'erp-frontend-preview' || die "erp-frontend-preview not running"
docker ps --format '{{.Names}}' | grep -qx "$TRAEFIK_NAME" || die "$TRAEFIK_NAME not running"

# Snapshot prod — must remain untouched
PROD_BEFORE="$(docker ps --filter name=^erp-frontend$ --format '{{.Names}} {{.Ports}} {{.Status}}' || true)"
out "Production erp-frontend (must stay untouched): ${PROD_BEFORE:-absent}"

REPO_TRAEFIK="$REPO_ROOT/deploy/supabase-stage-traefik.yml"
if [[ ! -f "$REPO_TRAEFIK" && -f "$(dirname "$0")/../deploy/supabase-stage-traefik.yml" ]]; then
  REPO_TRAEFIK="$(cd "$(dirname "$0")/.." && pwd)/deploy/supabase-stage-traefik.yml"
fi
[[ -f "$REPO_TRAEFIK" ]] || die "missing deploy/supabase-stage-traefik.yml"

mkdir -p "$(dirname "$DYNAMIC_FILE")"
cp "$REPO_TRAEFIK" "$DYNAMIC_FILE"
chmod 644 "$DYNAMIC_FILE"
log "Wrote $DYNAMIC_FILE"

grep -q 'Host(`erp-stage.ndmcore.com`)' "$DYNAMIC_FILE" || die "erp-stage host missing"
grep -q 'url: http://erp-frontend-preview:80' "$DYNAMIC_FILE" || die "preview service target missing"
grep -q 'https://erp-stage.ndmcore.com' "$DYNAMIC_FILE" || die "erp-stage CORS origin missing"

# Ensure networks exist + Traefik can resolve preview + stage Kong/Studio
docker network inspect "$PREVIEW_NET" >/dev/null 2>&1 || docker network create "$PREVIEW_NET"
docker network inspect "$STAGE_NET" >/dev/null 2>&1 || die "missing $STAGE_NET"

ensure_net() {
  local container="$1" net="$2"
  if docker inspect "$container" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -qw "$net"; then
    log "$container already on $net"
  else
    log "Connecting $container → $net"
    docker network connect "$net" "$container"
  fi
}

ensure_net "$TRAEFIK_NAME" "$PREVIEW_NET"
ensure_net "$TRAEFIK_NAME" "$STAGE_NET"
# Preview should already be on preview_net; ensure
ensure_net erp-frontend-preview "$PREVIEW_NET"

# Allow auth redirects / emails back to staging ERP host (staging .env only)
if [[ -f "$STAGE_DIR/.env" ]]; then
  python3 - "$STAGE_DIR/.env" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
want = "https://erp-stage.ndmcore.com"
for key in ("ADDITIONAL_REDIRECT_URLS", "GOTRUE_URI_ALLOW_LIST", "GOTRUE_SITE_URL", "SITE_URL"):
    pat = re.compile(rf"(?m)^{re.escape(key)}=(.*)$")
    m = pat.search(text)
    if key in ("GOTRUE_SITE_URL", "SITE_URL"):
        line = f"{key}={want}"
        if m:
            text = pat.sub(line, text, count=1)
        else:
            text += f"\n{line}\n"
        continue
    if m:
        cur = m.group(1).strip()
        parts = [p for p in re.split(r"[, ]+", cur) if p]
        if want not in parts:
            parts.append(want)
            text = pat.sub(f"{key}={','.join(parts)}", text, count=1)
    else:
        text += f"\n{key}={want}\n"
path.write_text(text, encoding="utf-8")
print("updated staging auth redirect allow-list for erp-stage")
PY
  cd "$STAGE_DIR"
  docker compose -f docker-compose.yml -f docker-compose.stage-ports.yml -p supabase-stage \
    up -d --no-deps --force-recreate auth 2>/dev/null \
    || docker compose --env-file .env -p supabase-stage up -d --no-deps --force-recreate auth || true
fi

# Local preview health
LOCAL_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 http://127.0.0.1:3002/ || true)"
out "local :3002 → $LOCAL_CODE"
[[ "$LOCAL_CODE" == "200" ]] || die "preview :3002 not HTTP 200"

# Confirm staging bake in preview bundle
BUNDLE_HIT="$(docker exec erp-frontend-preview sh -c 'grep -rl "api-stage.ndmcore.com" /usr/share/nginx/html/assets 2>/dev/null | head -1' || true)"
out "preview bundle api-stage: ${BUNDLE_HIT:-MISSING}"
[[ -n "$BUNDLE_HIT" ]] || die "preview bundle missing api-stage.ndmcore.com — re-run wire-staging-preview-vps.sh"

# Give Traefik a moment to reload dynamic file
sleep 3

# Public HTTPS (Cloudflare / Traefik)
PUBLIC_IP="$(getent ahostsv4 "$ERP_STAGE_HOST" 2>/dev/null | awk '{print $1; exit}' || true)"
if [[ -z "$PUBLIC_IP" ]] && command -v dig >/dev/null 2>&1; then
  PUBLIC_IP="$(dig +short "$ERP_STAGE_HOST" A @1.1.1.1 2>/dev/null | head -1 || true)"
fi
CURL_EXTRA=()
if [[ -n "${PUBLIC_IP:-}" ]]; then
  CURL_EXTRA=(--resolve "${ERP_STAGE_HOST}:443:${PUBLIC_IP}")
  out "resolve ${ERP_STAGE_HOST} → ${PUBLIC_IP}"
fi

PUBLIC_CODE="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${ERP_STAGE_HOST}/" || true)"
out "https://${ERP_STAGE_HOST}/ → $PUBLIC_CODE"
[[ "$PUBLIC_CODE" =~ ^(200|301|302|307|308)$ ]] || die "public erp-stage unhealthy ($PUBLIC_CODE)"

# Follow redirects to final page and sniff JS for api-stage
TMP_HTML="$(mktemp)"
curl -skS -L --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${ERP_STAGE_HOST}/" -o "$TMP_HTML" || true
JS_PATH="$(grep -oE '/assets/[^"]+\.js' "$TMP_HTML" 2>/dev/null | head -1 || true)"
API_MARK="missing"
if [[ -n "$JS_PATH" ]]; then
  JS_BODY="$(curl -skS --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${ERP_STAGE_HOST}${JS_PATH}" || true)"
  if printf '%s' "$JS_BODY" | grep -q 'api-stage.ndmcore.com'; then
    API_MARK="api-stage.ndmcore.com"
  elif printf '%s' "$JS_BODY" | grep -q 'api.ndmcore.com'; then
    API_MARK="api.ndmcore.com (WRONG — production)"
  fi
fi
rm -f "$TMP_HTML"
out "erp-stage JS API mark: $API_MARK"
[[ "$API_MARK" == "api-stage.ndmcore.com" ]] || die "erp-stage is not serving staging-baked frontend"

# Local Traefik Host header probe
LOCAL_TRAEFIK="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 \
  --resolve "${ERP_STAGE_HOST}:443:127.0.0.1" "https://${ERP_STAGE_HOST}/" 2>/dev/null || true)"
out "Traefik localhost Host=${ERP_STAGE_HOST} → ${LOCAL_TRAEFIK:-n/a}"

PROD_AFTER="$(docker ps --filter name=^erp-frontend$ --format '{{.Names}} {{.Ports}} {{.Status}}' || true)"
out "Production erp-frontend after: ${PROD_AFTER:-absent}"

out "======== CONFIRMATION ========"
out "erp_stage_host=https://${ERP_STAGE_HOST}"
out "erp_stage_http=$PUBLIC_CODE"
out "preview_local=200"
out "api_target=${STAGE_API_URL}"
out "bundle_mark=$API_MARK"
out "All erp-stage checks passed."
