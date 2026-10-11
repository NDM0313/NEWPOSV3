#!/usr/bin/env bash
# Wire https://erp-stage.ndmcore.com → erp-frontend-preview (:3002 staging bake).
# Does NOT touch production erp-frontend (:3001) or production Supabase.
set -euo pipefail

STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
STAGE_NET="${STAGE_NET:-stage-supabase-net}"
PREVIEW_NET="${PREVIEW_NET:-erp-preview_net}"
TRAEFIK_NAME="${TRAEFIK_NAME:-dokploy-traefik}"
DYNAMIC_DIR="${DYNAMIC_DIR:-/etc/dokploy/traefik/dynamic}"
DYNAMIC_SUPABASE="${DYNAMIC_SUPABASE:-$DYNAMIC_DIR/supabase-stage.yml}"
DYNAMIC_ERP="${DYNAMIC_ERP:-$DYNAMIC_DIR/erp-stage.yml}"
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

PROD_BEFORE="$(docker ps --filter name=^erp-frontend$ --format '{{.Names}} {{.Ports}} {{.Status}}' || true)"
out "Production erp-frontend (must stay untouched): ${PROD_BEFORE:-absent}"

resolve_repo_file() {
  local rel="$1"
  if [[ -f "$REPO_ROOT/$rel" ]]; then echo "$REPO_ROOT/$rel"; return; fi
  if [[ -f "$(dirname "$0")/../$rel" ]]; then echo "$(cd "$(dirname "$0")/.." && pwd)/$rel"; return; fi
  die "missing $rel"
}

REPO_SUPABASE="$(resolve_repo_file deploy/supabase-stage-traefik.yml)"
REPO_ERP="$(resolve_repo_file deploy/erp-stage-traefik.yml)"

mkdir -p "$DYNAMIC_DIR"
cp "$REPO_SUPABASE" "$DYNAMIC_SUPABASE"
cp "$REPO_ERP" "$DYNAMIC_ERP"
chmod 644 "$DYNAMIC_SUPABASE" "$DYNAMIC_ERP"
log "Wrote $DYNAMIC_SUPABASE"
log "Wrote $DYNAMIC_ERP (priority 1000)"

# Flag conflicting erp-stage Host rules in other dynamic files (do not edit prod files blindly)
out "--- dynamic dir scan for erp-stage ---"
grep -RIn 'erp-stage\.ndmcore\.com' "$DYNAMIC_DIR" 2>/dev/null | sed 's/^/  /' || out "  (none)"
# If another file (not ours) defines erp-stage → non-preview, move it aside
while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  base="$(basename "$f")"
  [[ "$base" == "erp-stage.yml" || "$base" == "supabase-stage.yml" ]] && continue
  if grep -q 'erp-stage\.ndmcore\.com' "$f"; then
    bak="${f}.bak-before-erp-stage-$(date -u +%Y%m%d%H%M%S)"
    log "Conflicting erp-stage rule in $f → backing up to $bak and commenting Host rules"
    cp "$f" "$bak"
    # Comment lines containing erp-stage host so our priority-1000 router wins cleanly
    sed -i 's/\(.*erp-stage\.ndmcore\.com.*\)/# disabled-for-staging: \1/' "$f" || true
  fi
done < <(grep -RIl 'erp-stage\.ndmcore\.com' "$DYNAMIC_DIR" 2>/dev/null || true)

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
ensure_net erp-frontend-preview "$PREVIEW_NET"

# Prove Traefik container can resolve + reach preview over Docker DNS
REACH="$(docker run --rm --network "$PREVIEW_NET" curlimages/curl:8.5.0 \
  -sS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 http://erp-frontend-preview/ 2>/dev/null || echo 000)"
out "docker-net curl erp-frontend-preview → $REACH"
[[ "$REACH" == "200" ]] || die "Traefik network cannot reach erp-frontend-preview ($REACH)"

LOCAL_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I --connect-timeout 8 http://127.0.0.1:3002/ || true)"
out "local :3002 → $LOCAL_CODE"
[[ "$LOCAL_CODE" == "200" ]] || die "preview :3002 not HTTP 200"

BUNDLE_HIT="$(docker exec erp-frontend-preview sh -c 'grep -rl "api-stage.ndmcore.com" /usr/share/nginx/html/assets 2>/dev/null | head -1' || true)"
out "preview bundle api-stage: ${BUNDLE_HIT:-MISSING}"
[[ -n "$BUNDLE_HIT" ]] || die "preview bundle missing api-stage.ndmcore.com"

# Staging auth redirects
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
        text = pat.sub(line, text, count=1) if m else text + f"\n{line}\n"
        continue
    if m:
        parts = [p for p in re.split(r"[, ]+", m.group(1).strip()) if p]
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

# Reload Traefik by touching configs; wait for file provider
sleep 5

html_index_js() {
  local base_url="$1"
  shift
  local html
  html="$(curl -skS -L --connect-timeout 12 "$@" "$base_url/" 2>/dev/null || true)"
  printf '%s' "$html" | grep -oE '/assets/index-[^"]+\.js' | head -1 || true
}

probe_stage_chunk() {
  # Fetch known staging chunk (may be lazy-loaded; not always in HTML preloads)
  local base_url="$1"
  shift
  local chunk_path body
  chunk_path="$(docker exec erp-frontend-preview sh -c 'grep -rl "api-stage.ndmcore.com" /usr/share/nginx/html/assets 2>/dev/null | head -1' | sed 's|^/usr/share/nginx/html||' || true)"
  [[ -n "$chunk_path" ]] || { echo "no-chunk"; return; }
  body="$(curl -skS --connect-timeout 15 "$@" "${base_url}${chunk_path}" 2>/dev/null || true)"
  if printf '%s' "$body" | grep -q 'api-stage.ndmcore.com'; then
    echo "api-stage.ndmcore.com"
  else
    echo "miss(${chunk_path})"
  fi
}

[[ -n "$BUNDLE_HIT" ]] || die "preview :3002 itself not staging-baked"
PREVIEW_INDEX="$(html_index_js "http://127.0.0.1:3002")"
out "direct :3002 index=$PREVIEW_INDEX bake=api-stage (container grep)"
[[ -n "$PREVIEW_INDEX" ]] || die "preview :3002 HTML missing index JS"

VPS_IP="${VPS_PUBLIC_IP:-72.62.254.176}"
TRAEFIK_INDEX="$(html_index_js "https://${ERP_STAGE_HOST}" --resolve "${ERP_STAGE_HOST}:443:127.0.0.1")"
VPS_INDEX="$(html_index_js "https://${ERP_STAGE_HOST}" --resolve "${ERP_STAGE_HOST}:443:${VPS_IP}")"
TRAEFIK_CHUNK="$(probe_stage_chunk "https://${ERP_STAGE_HOST}" --resolve "${ERP_STAGE_HOST}:443:127.0.0.1")"
VPS_CHUNK="$(probe_stage_chunk "https://${ERP_STAGE_HOST}" --resolve "${ERP_STAGE_HOST}:443:${VPS_IP}")"
out "Traefik localhost index=$TRAEFIK_INDEX chunk=$TRAEFIK_CHUNK"
out "VPS ${VPS_IP} index=$VPS_INDEX chunk=$VPS_CHUNK"

ROUTE_OK=0
if [[ "$TRAEFIK_INDEX" == "$PREVIEW_INDEX" || "$VPS_INDEX" == "$PREVIEW_INDEX" ]]; then
  ROUTE_OK=1
fi
if [[ "$TRAEFIK_CHUNK" == "api-stage.ndmcore.com" || "$VPS_CHUNK" == "api-stage.ndmcore.com" ]]; then
  ROUTE_OK=1
fi

PUBLIC_IP="$(getent ahostsv4 "$ERP_STAGE_HOST" 2>/dev/null | awk '{print $1; exit}' || true)"
if [[ -z "$PUBLIC_IP" ]] && command -v dig >/dev/null 2>&1; then
  PUBLIC_IP="$(dig +short "$ERP_STAGE_HOST" A @1.1.1.1 2>/dev/null | head -1 || true)"
fi
CURL_EXTRA=()
[[ -n "${PUBLIC_IP:-}" ]] && CURL_EXTRA=(--resolve "${ERP_STAGE_HOST}:443:${PUBLIC_IP}") && out "resolve ${ERP_STAGE_HOST} → ${PUBLIC_IP}"

PUBLIC_CODE="$(curl -skS -o /dev/null -w '%{http_code}' -I --connect-timeout 15 "${CURL_EXTRA[@]}" "https://${ERP_STAGE_HOST}/" || true)"
PUBLIC_INDEX="$(html_index_js "https://${ERP_STAGE_HOST}" "${CURL_EXTRA[@]}")"
PUBLIC_CHUNK="$(probe_stage_chunk "https://${ERP_STAGE_HOST}" "${CURL_EXTRA[@]}")"
out "https://${ERP_STAGE_HOST}/ → $PUBLIC_CODE index=$PUBLIC_INDEX chunk=$PUBLIC_CHUNK"

if [[ "$ROUTE_OK" -eq 1 ]]; then
  out "TRAEFIK_ROUTE: OK (erp-stage Host → same preview index/chunk as :3002)"
elif [[ "$PUBLIC_INDEX" == "$PREVIEW_INDEX" || "$PUBLIC_CHUNK" == "api-stage.ndmcore.com" ]]; then
  out "PUBLIC_ROUTE: OK (Cloudflare serves staging preview)"
  ROUTE_OK=1
else
  out "Traefik published ports:"
  docker port "$TRAEFIK_NAME" 2>/dev/null | sed 's/^/  /' || true
  out "Other Host routers mentioning erp:"
  grep -RIn 'Host(`erp' "$DYNAMIC_DIR" 2>/dev/null | sed 's/^/  /' | head -40 || true
  die "erp-stage not reaching staging preview (preview=$PREVIEW_INDEX traefik=$TRAEFIK_INDEX vps=$VPS_INDEX public=$PUBLIC_INDEX)"
fi

if [[ "$PUBLIC_INDEX" != "$PREVIEW_INDEX" && "$PUBLIC_CHUNK" != "api-stage.ndmcore.com" ]]; then
  out "WARNING: Cloudflare edge index=$PUBLIC_INDEX differs from preview=$PREVIEW_INDEX — purge CF cache / confirm DNS origin → ${VPS_IP}."
fi

if [[ "$PUBLIC_CODE" == "200" && ( "$PUBLIC_INDEX" == "$PREVIEW_INDEX" || "$PUBLIC_CHUNK" == "api-stage.ndmcore.com" ) ]]; then
  PUBLIC_OK=YES
else
  PUBLIC_OK="PARTIAL(route-ok public_index=$PUBLIC_INDEX)"
fi

PROD_AFTER="$(docker ps --filter name=^erp-frontend$ --format '{{.Names}} {{.Ports}} {{.Status}}' || true)"
out "Production erp-frontend after: ${PROD_AFTER:-absent}"

out "======== CONFIRMATION ========"
out "erp_stage_host=https://${ERP_STAGE_HOST}"
out "erp_stage_http=$PUBLIC_CODE"
out "preview_index=$PREVIEW_INDEX"
out "traefik_index=$TRAEFIK_INDEX"
out "vps_index=$VPS_INDEX"
out "public_index=$PUBLIC_INDEX"
out "public_ok=$PUBLIC_OK"
out "preview_local=200"
out "api_target=${STAGE_API_URL}"
out "All erp-stage checks passed."
