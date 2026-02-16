#!/usr/bin/env bash
# Run on VPS after deploy: checks network, Traefik, local curl, and prints Supabase reminder.
# Usage: bash scripts/vps-erp-diagnose.sh

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DOMAIN="erp.dincouture.pk"
NETWORK="dokploy-network"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== ERP domain diagnose ($DOMAIN) ==="
echo ""

# 1. dokploy-network exists
if docker network inspect "$NETWORK" &>/dev/null; then
  echo "[OK] Network $NETWORK exists"
else
  echo "[FIX] Create network: docker network create $NETWORK"
fi

# 2. Our container exists and is on dokploy-network
CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q erp-frontend 2>/dev/null | head -1)
if [ -n "$CONTAINER" ]; then
  NAME=$(docker inspect --format '{{.Name}}' "$CONTAINER" 2>/dev/null | tr -d '/')
  echo "[OK] Container: $NAME"
  if docker network inspect "$NETWORK" 2>/dev/null | grep -q "\"$CONTAINER\""; then
    echo "[OK] Container is on $NETWORK"
  else
    echo "[FIX] Attach: docker network connect $NETWORK $NAME"
  fi
else
  echo "[??] ERP container not running. Run: docker compose -f $COMPOSE_FILE up -d"
fi

# 3. Traefik on same network (Dokploy: dokploy-traefik)
TRAEFIK_NAME=$(docker ps --format '{{.Names}}' | grep -E 'traefik|dokploy-traefik' | head -1)
if [ -n "$TRAEFIK_NAME" ]; then
  if docker network inspect "$NETWORK" --format '{{range $k, $v := .Containers}}{{$v.Name}} {{end}}' 2>/dev/null | grep -qw "$TRAEFIK_NAME"; then
    echo "[OK] Traefik ($TRAEFIK_NAME) is on $NETWORK"
  else
    echo "[FIX] Run: docker network connect $NETWORK $TRAEFIK_NAME"
  fi
else
  echo "[??] No Traefik container (dokploy-traefik). Attach your reverse-proxy to $NETWORK."
fi

# 4. Local curl to container (if we have container)
if [ -n "$CONTAINER" ]; then
  IP=$(docker inspect --format '{{$n := index .NetworkSettings.Networks "'"$NETWORK"'"}}{{$n.IPAddress}}' "$CONTAINER" 2>/dev/null)
  if [ -n "$IP" ] && [ "$IP" != "<no value>" ]; then
    CODE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://$IP:80/" 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
      echo "[OK] Local curl http://container:80 => 200"
    else
      echo "[??] Local curl http://$IP:80 => $CODE (container may still be starting)"
    fi
  fi
fi

# 5. Public curl
echo ""
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$DOMAIN/" 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
  echo "[OK] https://$DOMAIN => $HTTP"
elif [ "$HTTP" = "000" ]; then
  echo "[??] https://$DOMAIN unreachable (DNS/firewall/SSL or Traefik not routing)"
  echo "     Run: bash scripts/vps-dns-verify.sh"
  echo "     To use app from PC now: add to C:\\Windows\\System32\\drivers\\etc\\hosts:"
  echo "       72.62.254.176 $DOMAIN"
else
  echo "[??] https://$DOMAIN => $HTTP"
fi

echo ""
echo "--- Supabase Auth (login redirect) ---"
echo "If login fails or redirects wrong: on VPS edit /root/supabase/docker/.env"
echo "  SITE_URL=https://$DOMAIN"
echo "  Add to redirect URLs: https://$DOMAIN and http://72.62.254.176"
echo "Then: docker restart \$(docker ps -q -f name=supabase-auth)"
echo ""
