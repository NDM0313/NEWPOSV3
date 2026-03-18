#!/bin/bash
# Apply Studio Traefik config (middleware for storage policy) on VPS.
# Run from repo root on VPS: cd /root/NEWPOSV3 && bash deploy/apply-studio-traefik-config.sh
# Or: ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/apply-studio-traefik-config.sh"

set -e
DYNAMIC="${DYNAMIC:-/etc/dokploy/traefik/dynamic/supabase.yml}"
REPO_FILE="deploy/supabase-traefik.yml"
if [ ! -f "$REPO_FILE" ]; then
  echo "[apply-studio-traefik] $REPO_FILE not found. Run from repo root."
  exit 1
fi
if [ -w "$DYNAMIC" ]; then
  cp "$REPO_FILE" "$DYNAMIC"
  echo "[apply-studio-traefik] Copied $REPO_FILE to $DYNAMIC"
else
  echo "[apply-studio-traefik] Cannot write $DYNAMIC (need sudo?). Try: sudo cp $REPO_FILE $DYNAMIC"
  exit 1
fi
# Traefik reloads dynamic config automatically; optional restart:
# docker restart dokploy-traefik 2>/dev/null || true
echo "[apply-studio-traefik] Done. Studio route now uses studio-storage-policy middleware."
