#!/usr/bin/env bash
set -euo pipefail

KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"
PROJECT_DIR="${PROJECT_DIR:-/root/NEWPOSV3}"
DOMAIN="${DOMAIN:-https://supabase.dincouture.pk}"
FIXER="${FIXER:-$PROJECT_DIR/deploy/fix-kong-cors-yaml.py}"
TMP_FIXER="/tmp/fix-kong-cors-yaml.py"

log() { echo "[kong-safe-repair] $*"; }

log "Starting safe Kong repair"
log "KONG_YML=$KONG_YML"

if [[ ! -f "$KONG_YML" ]]; then
  log "ERROR: kong.yml not found at $KONG_YML"
  exit 1
fi

if [[ ! -f "$FIXER" ]]; then
  log "Repo fixer not found at $FIXER"
  log "Trying fallback from current directory or /tmp"
fi

if [[ ! -f "$FIXER" ]]; then
  if [[ -f "./deploy/fix-kong-cors-yaml.py" ]]; then
    FIXER="./deploy/fix-kong-cors-yaml.py"
  elif [[ -f "$TMP_FIXER" ]]; then
    FIXER="$TMP_FIXER"
  else
    log "ERROR: fix-kong-cors-yaml.py not found"
    exit 1
  fi
fi

log "Current git commit (if available):"
(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)

log "Container status before repair:"
(docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'supabase-kong|supabase-auth|supabase-rest' || true)

log "Recent Kong logs before repair:"
(docker logs --tail=20 supabase-kong || true)

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$KONG_YML.bak-$STAMP"
cp "$KONG_YML" "$BACKUP"
log "Backup created: $BACKUP"

log "Previewing proposed YAML fix"
python3 "$FIXER" "$KONG_YML"

log "Applying YAML fix in-place"
python3 "$FIXER" "$KONG_YML" --write

log "Showing repaired lines around auth/rest section"
(nl -ba "$KONG_YML" | sed -n '140,240p' || true)

if [[ -f "$SUPABASE_DIR/docker-compose.yml" ]]; then
  log "Restarting Kong via docker compose"
  (cd "$SUPABASE_DIR" && docker compose restart kong)
else
  log "docker-compose.yml not found; trying docker restart supabase-kong"
  docker restart supabase-kong
fi

log "Waiting for Kong startup"
sleep 20

log "Container status after repair:"
(docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'supabase-kong|supabase-auth|supabase-rest' || true)

log "Recent Kong logs after repair:"
(docker logs --tail=40 supabase-kong || true)

log "Health check: auth"
(curl -i "$DOMAIN/auth/v1/health" || true)

log "Health check: rest"
(curl -i "$DOMAIN/rest/v1/" || true)

log "Done"
log "If healthy, commit these scripts to GitHub and always use the same recovery command from any machine:"
log "ssh dincouture-vps \"cd /root/NEWPOSV3 && bash deploy/kong-safe-repair.sh\""
