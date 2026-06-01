#!/usr/bin/env bash
# Ensure supabase-studio is running and Traefik can reach it (studio.dincouture.pk).
# Root cause of recurring 502: studio stuck in Created/Exited after JWT recreate or partial compose.
# Run on VPS: cd /root/NEWPOSV3 && bash deploy/ensure-supabase-studio.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"
STUDIO_NAME="${STUDIO_NAME:-supabase-studio}"
WAIT_SECS="${WAIT_SECS:-60}"

studio_needs_start() {
  local status running health
  if ! docker inspect "$STUDIO_NAME" >/dev/null 2>&1; then
    return 0
  fi
  status="$(docker inspect "$STUDIO_NAME" --format '{{.State.Status}}' 2>/dev/null || echo missing)"
  running="$(docker inspect "$STUDIO_NAME" --format '{{.State.Running}}' 2>/dev/null || echo false)"
  health="$(docker inspect "$STUDIO_NAME" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo missing)"
  if [ "$status" = "created" ] || [ "$running" != "true" ]; then
    return 0
  fi
  if [ "$health" = "unhealthy" ] || [ "$health" = "starting" ]; then
    return 0
  fi
  return 1
}

wait_for_studio() {
  echo "[ensure-studio] Waiting for $STUDIO_NAME (up to ${WAIT_SECS}s)..."
  for i in $(seq 1 "$WAIT_SECS"); do
    if ! docker inspect "$STUDIO_NAME" >/dev/null 2>&1; then
      sleep 1
      continue
    fi
    local running health
    running="$(docker inspect "$STUDIO_NAME" --format '{{.State.Running}}' 2>/dev/null || echo false)"
    health="$(docker inspect "$STUDIO_NAME" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo missing)"
    if [ "$running" = "true" ]; then
      if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
        echo "[ensure-studio] $STUDIO_NAME is up (health=$health)"
        return 0
      fi
    fi
    sleep 1
  done
  echo "[ensure-studio] ERROR: $STUDIO_NAME not healthy after ${WAIT_SECS}s"
  docker ps -a --filter "name=$STUDIO_NAME" || true
  docker logs "$STUDIO_NAME" --tail 30 2>&1 || true
  return 1
}

echo "[ensure-studio] Checking $STUDIO_NAME..."

if [ ! -f "$SUPABASE_DIR/docker-compose.yml" ] && [ ! -f "$SUPABASE_DIR/docker-compose.yaml" ]; then
  echo "[ensure-studio] Missing docker-compose in $SUPABASE_DIR"
  exit 1
fi

if studio_needs_start; then
  echo "[ensure-studio] Starting studio (compose up -d studio)..."
  (cd "$SUPABASE_DIR" && docker compose up -d studio 2>&1) || true
  wait_for_studio || exit 1
else
  echo "[ensure-studio] $STUDIO_NAME already running. OK."
fi

if [ -f "$SCRIPT_DIR/ensure-studio-traefik-network.sh" ]; then
  bash "$SCRIPT_DIR/ensure-studio-traefik-network.sh" || true
fi

# External verify when curl is available
if command -v curl >/dev/null 2>&1; then
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 https://studio.dincouture.pk/ 2>/dev/null || echo 000)"
  if [ "$code" = "200" ] || [ "$code" = "307" ]; then
    echo "[ensure-studio] https://studio.dincouture.pk HTTP $code — OK"
  else
    echo "[ensure-studio] WARN: https://studio.dincouture.pk HTTP $code (expected 200 or 307)"
    exit 1
  fi
fi

echo "[ensure-studio] Done."
