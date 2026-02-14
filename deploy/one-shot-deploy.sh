#!/bin/bash
# ONE-SHOT ERP DEPLOY - Run this ON the VPS
# Copy entire script, paste in VPS terminal, run: bash one-shot-deploy.sh
# OR: curl -sL https://raw.../one-shot-deploy.sh | bash

set -e
echo "=== ERP One-Shot Deploy ==="

# 1. Get project (clone if not exists)
PROJECT_DIR="/root/NEWPOSV3"
if [ ! -f "$PROJECT_DIR/deploy/Dockerfile" ]; then
  echo "Cloning from GitHub..."
  git clone --depth 1 https://github.com/NDM0313/NEWPOSV3.git "$PROJECT_DIR" || exit 1
fi
cd "$PROJECT_DIR"

# 2. Get network
NET=$(docker network ls --format '{{.Name}}' | grep -E 'dokploy|traefik|ingress' | head -1)
[ -z "$NET" ] && NET="ingress"
echo "Using network: $NET"

# 3. Env (EDIT THESE)
export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://wrwljqzckmnmuphwhslt.supabase.co}"
export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "Set: export VITE_SUPABASE_ANON_KEY='your-key'"
  exit 1
fi

# 4. Build
echo "Building..."
docker build -t erp-frontend:latest \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -f deploy/Dockerfile .

# 5. Remove old if exists
docker service rm erp-frontend 2>/dev/null || true

# 6. Create service
echo "Deploying..."
docker service create --name erp-frontend --replicas 1 \
  --network "$NET" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.erp.rule=Host(\`erp.dincouture.pk\`)" \
  --label "traefik.http.routers.erp.entrypoints=websecure" \
  --label "traefik.http.services.erp.loadbalancer.server.port=80" \
  erp-frontend:latest

echo "Done. Wait 30s then: curl -I https://erp.dincouture.pk"
