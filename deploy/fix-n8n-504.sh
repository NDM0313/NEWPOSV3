#!/bin/bash
# Fix n8n 504 Gateway Timeout - Run on VPS as root
# Usage: ssh root@72.62.254.176 -p 22
#        cd /root/NEWPOSV3 && ./deploy/fix-n8n-504.sh

set -e
echo "=== Fix n8n 504 Gateway Timeout ==="

# Step 1: Ensure project exists
if [ ! -f /root/NEWPOSV3/deploy/ssl-n8n-activation.sh ]; then
  echo "[1] Cloning project..."
  cd /root && git clone https://github.com/NDM0313/NEWPOSV3.git
fi
cd /root/NEWPOSV3

# Step 2: Run activation script
echo ""
echo "[2] Running ssl-n8n-activation.sh..."
chmod +x deploy/ssl-n8n-activation.sh
./deploy/ssl-n8n-activation.sh || true

# Step 3: Force label update & webhook
echo ""
echo "[3] Updating n8n service (labels + WEBHOOK_URL)..."
docker service update dincouture-n8n \
  --env-add WEBHOOK_URL=https://n8n.dincouture.pk/ \
  --label-add "traefik.enable=true" \
  --label-add "traefik.http.routers.n8n.rule=Host(\`n8n.dincouture.pk\`)" \
  --label-add "traefik.http.routers.n8n.entrypoints=websecure" \
  --label-add "traefik.http.routers.n8n.tls=true" \
  --label-add "traefik.http.routers.n8n.tls.certresolver=letsencrypt" \
  --label-add "traefik.http.services.n8n.loadbalancer.server.port=5678"

# Step 4: Restart Traefik
echo ""
echo "[4] Restarting Traefik..."
docker restart $(docker ps -q --filter name=traefik) 2>/dev/null || echo "Traefik container not found by name"
sleep 10

# Step 5: Health check
echo ""
echo "[5] Health check..."
echo "https://n8n.dincouture.pk:"
curl -sI --connect-timeout 10 https://n8n.dincouture.pk | head -8

echo ""
echo "=== Done. Open https://n8n.dincouture.pk in browser ==="
