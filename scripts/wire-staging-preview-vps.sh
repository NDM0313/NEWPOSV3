#!/usr/bin/env bash
# Wire Traefik staging hostnames + rebuild erp-frontend-preview (:3002) against staging Supabase.
# Safe: does not touch erp-frontend (:3001) or /root/supabase/docker production stack.
#
# Usage (on VPS):
#   bash scripts/wire-staging-preview-vps.sh
set -euo pipefail

STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
STAGE_NET="${STAGE_NET:-stage-supabase-net}"
TRAEFIK_NAME="${TRAEFIK_NAME:-dokploy-traefik}"
DYNAMIC_DIR="${DYNAMIC_DIR:-/etc/dokploy/traefik/dynamic}"
DYNAMIC_FILE="${DYNAMIC_FILE:-$DYNAMIC_DIR/supabase-stage.yml}"
REPO_ROOT="${REPO_ROOT:-/root/NEWPOSV3}"
PREVIEW_DIR="${PREVIEW_DIR:-/root/NEWPOSV3-preview-qa}"
BRANCH="${BRANCH:-cursor/supabase-stage-minipc-e9d2}"

STAGE_API_URL="${STAGE_API_URL:-https://api-stage.ndmcore.com}"
STAGE_STUDIO_HOST="${STAGE_STUDIO_HOST:-db-stage.ndmcore.com}"
# Prefer host file written by staging deploy; fall back to env / known key.
STAGE_ANON_KEY="${STAGE_ANON_KEY:-}"
if [[ -z "$STAGE_ANON_KEY" && -f "$STAGE_DIR/.stage_anon_key" ]]; then
  STAGE_ANON_KEY="$(tr -d '\r\n' < "$STAGE_DIR/.stage_anon_key")"
fi
if [[ -z "$STAGE_ANON_KEY" ]]; then
  STAGE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.OHbNef2x7CVNAPLi302ouCz3UN1sG1TK_uVFOivGM90"
fi

log() { echo "[wire-stage $(date -u +%H:%M:%S)] $*"; }
die() { echo "[wire-stage ERROR] $*" >&2; exit 1; }
trap 'echo FAIL > /tmp/wire-stage.failed' ERR

need() { command -v "$1" >/dev/null 2>&1 || die "missing $1"; }
need docker
need curl

# Exclusive lock — concurrent CI wires previously stuck for 30+ minutes.
exec 9>/tmp/wire-stage.lock
if ! flock -n 9; then
  die "another wire-stage process holds /tmp/wire-stage.lock"
fi
rm -f /tmp/wire-stage.done /tmp/wire-stage.failed

[[ -d "$STAGE_DIR" ]] || die "staging dir missing: $STAGE_DIR"
docker ps --format '{{.Names}}' | grep -qx 'stage-supabase-kong' || die "stage-supabase-kong not running"
docker ps --format '{{.Names}}' | grep -qx 'stage-supabase-studio' || die "stage-supabase-studio not running"

# ---------------------------------------------------------------------------
# 1) Traefik dynamic config + network attach
# ---------------------------------------------------------------------------
REPO_TRAEFIK="$REPO_ROOT/deploy/supabase-stage-traefik.yml"
if [[ ! -f "$REPO_TRAEFIK" ]]; then
  # Allow running from a checkout that has the file
  if [[ -f "$(dirname "$0")/../deploy/supabase-stage-traefik.yml" ]]; then
    REPO_TRAEFIK="$(cd "$(dirname "$0")/.." && pwd)/deploy/supabase-stage-traefik.yml"
  else
    die "missing deploy/supabase-stage-traefik.yml"
  fi
fi

mkdir -p "$DYNAMIC_DIR"
cp "$REPO_TRAEFIK" "$DYNAMIC_FILE"
chmod 644 "$DYNAMIC_FILE"
log "Wrote Traefik dynamic config → $DYNAMIC_FILE"

# Ensure stage network exists and Traefik can reach stage Kong/Studio by name
if ! docker network inspect "$STAGE_NET" >/dev/null 2>&1; then
  die "docker network $STAGE_NET not found"
fi

if docker ps --format '{{.Names}}' | grep -qx "$TRAEFIK_NAME"; then
  if docker inspect "$TRAEFIK_NAME" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -qw "$STAGE_NET"; then
    log "$TRAEFIK_NAME already on $STAGE_NET"
  else
    log "Connecting $TRAEFIK_NAME → $STAGE_NET"
    docker network connect "$STAGE_NET" "$TRAEFIK_NAME" || true
  fi
else
  log "WARNING: $TRAEFIK_NAME not running — Traefik file written but SSL routes inactive until Traefik is up"
fi

# Point staging GoTrue/Kong public URL at the new hostname (auth redirects / emails)
if [[ -f "$STAGE_DIR/.env" ]]; then
  python3 - "$STAGE_DIR/.env" "$STAGE_API_URL" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
api = sys.argv[2]
text = path.read_text(encoding="utf-8")
for key in ("API_EXTERNAL_URL", "SUPABASE_PUBLIC_URL", "GOTRUE_SITE_URL", "SITE_URL"):
    pat = re.compile(rf"(?m)^{re.escape(key)}=.*$")
    line = f"{key}={api}"
    if pat.search(text):
        text = pat.sub(line, text, count=1)
    else:
        text += f"\n{line}\n"
path.write_text(text, encoding="utf-8")
print("updated staging public URLs")
PY
  # Recreate auth + kong so env takes effect (db/data untouched)
  cd "$STAGE_DIR"
  docker compose -f docker-compose.yml -f docker-compose.stage-ports.yml -p supabase-stage \
    up -d --no-deps --force-recreate kong auth 2>/dev/null \
    || docker compose -p supabase-stage up -d --no-deps --force-recreate kong auth || true
fi

# ---------------------------------------------------------------------------
# 2) Preview frontend :3002 → staging Supabase
# ---------------------------------------------------------------------------
log "Preparing preview checkout at $PREVIEW_DIR (branch=$BRANCH)"
if [[ ! -d "$PREVIEW_DIR/.git" ]]; then
  git clone --branch "$BRANCH" https://github.com/NDM0313/NEWPOSV3.git "$PREVIEW_DIR" \
    || git clone https://github.com/NDM0313/NEWPOSV3.git "$PREVIEW_DIR"
fi
cd "$PREVIEW_DIR"
git fetch origin "$BRANCH" || git fetch origin
git checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout "$BRANCH" || true
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo stagewire)"
# Ensure web-only Dockerfile is present even if preview checkout lags the push
if [[ -f "$REPO_ROOT/deploy/Dockerfile.preview-webonly" ]]; then
  mkdir -p "$PREVIEW_DIR/deploy"
  cp -f "$REPO_ROOT/deploy/Dockerfile.preview-webonly" "$PREVIEW_DIR/deploy/Dockerfile.preview-webonly"
fi

# Write dedicated staging env for preview build (do NOT overwrite prod .env.production on main ERP tree)
ENV_FILE="$PREVIEW_DIR/.env.production"
cat > "$ENV_FILE" <<EOF
VITE_SUPABASE_URL=${STAGE_API_URL}
VITE_SUPABASE_URL_MOBILE=${STAGE_API_URL}
VITE_SUPABASE_ANON_KEY=${STAGE_ANON_KEY}
VITE_DISABLE_REALTIME=true
VITE_BUILD_COMMIT=${COMMIT}
CACHEBUST=$(date +%s)
EOF
chmod 600 "$ENV_FILE"
log "Wrote $ENV_FILE → VITE_SUPABASE_URL=${STAGE_API_URL}"

# Snapshot prod ERP identity before we touch preview
PROD_PORTS_BEFORE="$(docker ps --filter name=^erp-frontend$ --format '{{.Names}} {{.Ports}} {{.Status}}' || true)"
log "Production erp-frontend (must stay untouched): ${PROD_PORTS_BEFORE:-absent}"

export VITE_SUPABASE_URL="$STAGE_API_URL"
export VITE_SUPABASE_URL_MOBILE="$STAGE_API_URL"
export VITE_SUPABASE_ANON_KEY="$STAGE_ANON_KEY"
export VITE_DISABLE_REALTIME=true
export VITE_BUILD_COMMIT="$COMMIT"
CACHEBUST="$(date +%s)"
export CACHEBUST

log "Building erp-frontend-preview (web-only Dockerfile) with staging Supabase URL"
# Stop any leftover preview compose builds from a prior crashed CI wire
docker rm -f erp-frontend-preview 2>/dev/null || true
docker network create erp-preview_net 2>/dev/null || true

DOCKERFILE="deploy/Dockerfile.preview-webonly"
if [[ ! -f "$DOCKERFILE" ]]; then
  DOCKERFILE="deploy/Dockerfile"
  log "web-only Dockerfile missing — falling back to $DOCKERFILE"
fi

docker build \
  -f "$DOCKERFILE" \
  --build-arg "VITE_SUPABASE_URL=${STAGE_API_URL}" \
  --build-arg "VITE_SUPABASE_ANON_KEY=${STAGE_ANON_KEY}" \
  --build-arg "VITE_SUPABASE_URL_MOBILE=${STAGE_API_URL}" \
  --build-arg "VITE_DISABLE_REALTIME=true" \
  --build-arg "VITE_BUILD_COMMIT=${COMMIT}" \
  --build-arg "CACHEBUST=${CACHEBUST}" \
  -t erp-frontend-preview:latest \
  .

docker run -d \
  --name erp-frontend-preview \
  --restart unless-stopped \
  --network erp-preview_net \
  -p 3002:80 \
  erp-frontend-preview:latest

# ---------------------------------------------------------------------------
# 3) Verification
# ---------------------------------------------------------------------------
log "Verification"
PREVIEW_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:3002/ || true)"
KONG_LOCAL="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:8010/rest/v1/ || true)"
STUDIO_LOCAL="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:3010/ || true)"
PROD_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:3001/ || true)"

# Bundle must embed staging URL (not production supabase.dincouture.pk as sole API)
BUNDLE_HINT="$(docker exec erp-frontend-preview sh -c 'grep -rl "api-stage.ndmcore.com" /usr/share/nginx/html/assets 2>/dev/null | head -1' || true)"
PROD_LEAK="$(docker exec erp-frontend-preview sh -c 'grep -rl "supabase.dincouture.pk" /usr/share/nginx/html/assets 2>/dev/null | head -3' || true)"

# Public hostname checks (DNS + Traefik + LE) — best-effort
API_PUBLIC="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 -I "https://api-stage.ndmcore.com/rest/v1/" || true)"
STUDIO_PUBLIC="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 -I "https://${STAGE_STUDIO_HOST}/" || true)"

PROD_PORTS_AFTER="$(docker ps --filter name=^erp-frontend$ --format '{{.Names}} {{.Ports}} {{.Status}}' || true)"

cat <<EOF

======== STAGING WIRE COMPLETE ========
Preview :3002 HTTP:          ${PREVIEW_CODE} (expect 200)
Staging Kong :8010:          ${KONG_LOCAL} (expect 401)
Staging Studio :3010:        ${STUDIO_LOCAL} (expect 200/307)
Prod ERP :3001:              ${PROD_CODE} (untouched smoke)
api-stage.ndmcore.com:       ${API_PUBLIC} (expect 401 once DNS+LE ready)
db-stage.ndmcore.com:        ${STUDIO_PUBLIC} (expect 200/307 once DNS+LE ready)
Bundle contains api-stage:   ${BUNDLE_HINT:-MISSING}
Prod erp-frontend before:    ${PROD_PORTS_BEFORE:-absent}
Prod erp-frontend after:     ${PROD_PORTS_AFTER:-absent}
VITE_SUPABASE_URL:           ${STAGE_API_URL}
=======================================
EOF

[[ "$PREVIEW_CODE" == "200" ]] || die "preview :3002 not 200 (got $PREVIEW_CODE)"
[[ "$KONG_LOCAL" == "401" ]] || die "staging Kong not 401 (got $KONG_LOCAL)"
[[ -n "$BUNDLE_HINT" ]] || die "preview bundle missing api-stage.ndmcore.com — rebuild args not applied"
if [[ -n "$PROD_PORTS_BEFORE" && -n "$PROD_PORTS_AFTER" && "$PROD_PORTS_BEFORE" != "$PROD_PORTS_AFTER" ]]; then
  log "WARNING: erp-frontend container status string changed (inspect manually)"
fi
# Success marker for CI pollers (in addition to workflow wrapper)
echo OK > /tmp/wire-stage.done
log "Done — :3002 wired to staging Supabase."
