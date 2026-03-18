#!/bin/bash
# Ensure Traefik can reach supabase-studio so studio.dincouture.pk does not return 502.
# Traefik (dokploy-traefik) is on dokploy-network; supabase-studio is on supabase_default only.
# Connect Traefik to supabase_default so the studio-dincouture route can proxy to http://supabase-studio:3000.
# Run on VPS. Idempotent (already connected → exit 0).
set -e
TRAEFIK_NAME="${TRAEFIK_NAME:-dokploy-traefik}"
SUPABASE_NET="${SUPABASE_NET:-supabase_default}"
if ! docker ps --format '{{.Names}}' | grep -q "^${TRAEFIK_NAME}$"; then
  echo "[ensure-studio-network] $TRAEFIK_NAME not running. Skip."
  exit 0
fi
if docker network inspect "$SUPABASE_NET" >/dev/null 2>&1; then
  if docker inspect "$TRAEFIK_NAME" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | grep -q "\b${SUPABASE_NET}\b"; then
    echo "[ensure-studio-network] $TRAEFIK_NAME already on $SUPABASE_NET. OK."
    exit 0
  fi
  echo "[ensure-studio-network] Connecting $TRAEFIK_NAME to $SUPABASE_NET for studio.dincouture.pk..."
  docker network connect "$SUPABASE_NET" "$TRAEFIK_NAME" || true
  echo "[ensure-studio-network] Done. studio.dincouture.pk should load."
else
  echo "[ensure-studio-network] Network $SUPABASE_NET not found. Skip."
fi
