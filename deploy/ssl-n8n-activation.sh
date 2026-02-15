#!/bin/bash
# SSL Activation & n8n Environment Check
# Run on VPS as root after DNS updated to 72.62.254.176

set -e
echo "=== SSL & n8n Activation ==="

# 1. Restart Traefik (trigger new cert request)
echo ""
echo "[1] Restarting Traefik..."
TRAEFIK=$(docker ps -q --filter name=traefik | head -1)
if [ -n "$TRAEFIK" ]; then
  docker restart $TRAEFIK
  echo "Traefik restarted. Waiting 15s for cert request..."
  sleep 15
else
  echo "Traefik container not found. Check: docker ps | grep traefik"
fi

# 2. n8n WEBHOOK_URL check
echo ""
echo "[2] n8n WEBHOOK_URL..."
N8N_CONTAINER=$(docker ps -q --filter "name=n8n" | head -1)
if [ -n "$N8N_CONTAINER" ]; then
  docker exec $N8N_CONTAINER env | grep -i webhook || echo "WEBHOOK_URL not set in n8n"
  echo ""
  echo "Expected: WEBHOOK_URL=https://n8n.dincouture.pk/"
  echo "To update (standalone): docker stop n8n; docker run ... -e WEBHOOK_URL=https://n8n.dincouture.pk/ ..."
  echo "To update (Swarm): docker service update dincouture-n8n -e WEBHOOK_URL=https://n8n.dincouture.pk/"
else
  echo "n8n container not found"
fi

# 3. Verify n8n Traefik labels
echo ""
echo "[3] n8n service Traefik labels..."
docker service inspect dincouture-n8n --format '{{json .Spec.Labels}}' 2>/dev/null | jq -r 'to_entries[] | select(.key | startswith("traefik")) | "\(.key): \(.value)"' 2>/dev/null || echo "Check manually: docker service inspect dincouture-n8n"

# 4. Test HTTPS
echo ""
echo "[4] HTTPS Test..."
echo "erp.dincouture.pk:"
curl -sI --connect-timeout 5 https://erp.dincouture.pk 2>/dev/null | head -5
echo ""
echo "n8n.dincouture.pk:"
curl -sI --connect-timeout 5 https://n8n.dincouture.pk 2>/dev/null | head -5

echo ""
echo "=== Done. Check browser: https://n8n.dincouture.pk ==="
