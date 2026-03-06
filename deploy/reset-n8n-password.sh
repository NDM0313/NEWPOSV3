#!/bin/bash
# Reset n8n owner/login – removes all users; next sign-in will create new owner.
# Run on VPS: ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/reset-n8n-password.sh"

set -e
echo "=== Reset n8n password (user-management reset) ==="

# Find n8n container (Swarm task or standalone)
N8N_CONTAINER=$(docker ps -q --filter "name=n8n" | head -1)
if [ -z "$N8N_CONTAINER" ]; then
  echo "ERROR: No n8n container found. Check: docker ps | grep n8n"
  exit 1
fi

echo "[1] Found n8n container: $N8N_CONTAINER"
echo "[2] Running: n8n user-management:reset (this removes ALL users)..."
echo "y" | docker exec -i -u node "$N8N_CONTAINER" n8n user-management:reset

echo "[3] Forcing service update so container restarts and reset takes effect..."
docker service update --force dincouture-n8n 2>/dev/null || docker restart "$N8N_CONTAINER" 2>/dev/null || true

echo ""
echo "=== Done. Open https://n8n.dincouture.pk – you will be asked to create a new owner (email + password). ==="
