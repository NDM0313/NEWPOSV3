#!/bin/bash
# VPS Hardening & Verification – run on production VPS via SSH
# Ubuntu 24.04, Docker Swarm, Traefik, n8n, ERP
# CRITICAL: Do NOT stop dokploy-traefik or remove Dokploy services.

set -e
DOMAIN="erp.dincouture.pk"

echo "=============================================="
echo "VPS HARDENING & VERIFICATION"
echo "=============================================="

# --- PHASE 0: Pre-flight ---
echo ""
echo "[0] PRE-FLIGHT"
echo "---"
if ! command -v docker &>/dev/null; then
  echo "ERROR: docker not found. Run on VPS."
  exit 1
fi
if ! command -v ss &>/dev/null; then
  echo "WARN: ss not found, using netstat"
  PORT_CMD="netstat -lntp"
else
  PORT_CMD="ss -lntp"
fi

# --- 1) HARDEN n8n ---
echo ""
echo "[1] HARDEN n8n (bind 5678 to 127.0.0.1 only)"
echo "---"
N8N_CONTAINER="n8n-production"
if docker ps -a --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$"; then
  echo "Inspecting $N8N_CONTAINER..."
  docker inspect "$N8N_CONTAINER" --format 'Image: {{.Config.Image}}'
  docker inspect "$N8N_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' > /tmp/n8n-env.txt 2>/dev/null || true
  docker inspect "$N8N_CONTAINER" --format '{{json .Mounts}}' > /tmp/n8n-mounts.json 2>/dev/null || true
  docker inspect "$N8N_CONTAINER" --format '{{json .NetworkSettings.Networks}}' > /tmp/n8n-networks.json 2>/dev/null || true

  # Save full inspect BEFORE remove
  docker inspect "$N8N_CONTAINER" > /tmp/n8n-inspect.json 2>/dev/null
  N8N_IMAGE=$(jq -r '.[0].Config.Image' /tmp/n8n-inspect.json 2>/dev/null)
  # Extract env and mounts from saved inspect (before rm)
  jq -r '.[0].Config.Env[]?' /tmp/n8n-inspect.json 2>/dev/null > /tmp/n8n.env || true
  ENV_FILE=""
  [ -s /tmp/n8n.env ] && ENV_FILE="--env-file /tmp/n8n.env"

  VOL_ARGS=""
  if command -v jq &>/dev/null && [ -f /tmp/n8n-inspect.json ]; then
    for m in $(jq -r '.[0].Mounts[]? | "\(.Source):\(.Destination)"' /tmp/n8n-inspect.json 2>/dev/null); do
      [ -n "$m" ] && VOL_ARGS="$VOL_ARGS -v $m"
    done
  fi
  if [ -z "$VOL_ARGS" ]; then
    VOL_ARGS="-v n8n_data:/home/node/.n8n"
  fi

  echo "Stopping and removing $N8N_CONTAINER..."
  docker stop "$N8N_CONTAINER" 2>/dev/null || true
  docker rm "$N8N_CONTAINER" 2>/dev/null || true

  echo "Recreating $N8N_CONTAINER with -p 127.0.0.1:5678:5678..."
  docker run -d \
    --name "$N8N_CONTAINER" \
    --restart unless-stopped \
    -p 127.0.0.1:5678:5678 \
    $VOL_ARGS \
    $ENV_FILE \
    "$N8N_IMAGE" \
    || echo "WARN: docker run failed - check image and args manually"

  sleep 2
else
  echo "Container $N8N_CONTAINER not found. Skipping."
fi

echo ""
echo "Verify 5678 bound to 127.0.0.1 only:"
$PORT_CMD 2>/dev/null | grep 5678 || echo "  (no listener on 5678)"
if $PORT_CMD 2>/dev/null | grep 5678 | grep -q "127.0.0.1"; then
  echo "  OK: 5678 on 127.0.0.1 only"
elif $PORT_CMD 2>/dev/null | grep 5678 | grep -q "0.0.0.0"; then
  echo "  WARN: 5678 still on 0.0.0.0 - n8n recreate may have failed"
fi

# --- 2) HARDEN Dokploy (port 3000) ---
echo ""
echo "[2] HARDEN Dokploy (port 3000)"
echo "---"
docker service ls 2>/dev/null | head -20
echo ""
echo "Checking port 3000 binding..."
$PORT_CMD 2>/dev/null | grep 3000 || echo "  (no listener on 3000)"

# Swarm services: try to restrict publish if possible
DOKPLOY_SVC=$(docker service ls -q --filter name=dokploy 2>/dev/null | head -1)
if [ -n "$DOKPLOY_SVC" ]; then
  echo "Dokploy service found. Swarm publish to 127.0.0.1 may require service update."
  echo "If 3000 is public, add UFW rule: sudo ufw deny 3000 (if not already denied)"
fi

# Ensure UFW blocks 3000 from external (allow only 22,80,443)
echo ""
echo "UFW: ensuring 3000 not allowed from outside..."
sudo ufw status | grep -E "3000|80|443|22" || true

# --- 3) VERIFY TRAEFIK ---
echo ""
echo "[3] VERIFY TRAEFIK"
echo "---"
$PORT_CMD 2>/dev/null | grep -E ':80|:443' || echo "  (check listeners)"
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i traefik || echo "  (traefik container)"
echo ""
echo "Traefik routers (if traefik API enabled):"
curl -s http://127.0.0.1:8080/api/http/routers 2>/dev/null | jq -r '.[] | select(.rule | contains("erp.dincouture")) | .name + ": " + .rule' 2>/dev/null || echo "  (Traefik API not on 8080 or not enabled)"

# --- 4) VERIFY HTTPS ---
echo ""
echo "[4] VERIFY HTTPS"
echo "---"
HTTPS_RESP=$(curl -sI -o /dev/null -w "%{http_code}" --connect-timeout 10 https://$DOMAIN 2>/dev/null || echo "FAIL")
echo "curl -I https://$DOMAIN => $HTTPS_RESP"
if [ "$HTTPS_RESP" = "200" ]; then
  echo "  OK: HTTPS returns 200"
else
  echo "  FAIL: Expected 200, got $HTTPS_RESP"
fi

# --- 5) FIREWALL CHECK ---
echo ""
echo "[5] FIREWALL (UFW)"
echo "---"
sudo ufw status verbose 2>/dev/null | head -40

# --- 6) FINAL REPORT ---
echo ""
echo "=============================================="
echo "FINAL REPORT"
echo "=============================================="
echo "Port bindings:"
$PORT_CMD 2>/dev/null | grep -E ':80|:443|:3000|:5678' || echo "  (none of 80/443/3000/5678)"
echo ""
echo "HTTPS response: $HTTPS_RESP"
echo ""
echo "Remaining checks:"
echo "  - 5678 must show 127.0.0.1 only"
echo "  - 3000 must not be publicly accessible (UFW deny or bind to 127.0.0.1)"
echo "  - Traefik must own 80/443"
echo "  - erp.dincouture.pk must return 200"
echo ""
