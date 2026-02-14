#!/bin/bash
# Deploy ERP as Docker Swarm service with Traefik
# Run on VPS (where Dokploy/Traefik is active)
# Usage: ./deploy/deploy-erp-swarm.sh

set -e
DOMAIN="erp.dincouture.pk"
SERVICE_NAME="erp"
STACK_NAME="erp"

echo "=============================================="
echo "ERP Swarm Deployment"
echo "=============================================="

# 1. List all swarm services
echo ""
echo "[1] SWARM SERVICES"
echo "---"
docker service ls
echo ""
echo "Networks:"
docker network ls | grep -E "overlay|traefik|dokploy"

# 2. Check if ERP exists
echo ""
echo "[2] ERP SERVICE CHECK"
echo "---"
ERP_SVC=$(docker service ls -q --filter name=erp 2>/dev/null | head -1)
if [ -n "$ERP_SVC" ]; then
  echo "ERP service exists: $ERP_SVC"
  docker service ps "$ERP_SVC" --no-trunc 2>/dev/null | head -5
else
  echo "ERP service NOT found. Will deploy."
fi

# 3. Deploy if not exists
if [ -z "$ERP_SVC" ]; then
  echo ""
  echo "[3] DEPLOYING ERP"
  echo "---"
  
  # Need project root with Dockerfile and built image
  # Option A: Build and deploy from project
  if [ -f "deploy/Dockerfile" ] && [ -f "package.json" ]; then
    echo "Building ERP image..."
    docker build -t erp-frontend:latest \
      --build-arg VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
      --build-arg VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
      -f deploy/Dockerfile .
    
    # Detect Traefik network (Dokploy: dokploy_default, traefik-public, or ingress)
    NET_NAME="traefik-public"
    for net in dokploy_default traefik-public ingress; do
      if docker network ls -q --filter name="$net" 2>/dev/null | head -1 | grep -q .; then
        NET_NAME="$net"
        break
      fi
    done
    echo "Using network: $NET_NAME"
    
    echo "Creating ERP service..."
    docker service create \
      --name erp \
      --replicas 1 \
      --network "$NET_NAME" \
      --label "traefik.enable=true" \
      --label "traefik.http.routers.erp.rule=Host(\`$DOMAIN\`)" \
      --label "traefik.http.routers.erp.entrypoints=websecure" \
      --label "traefik.http.routers.erp.tls=true" \
      --label "traefik.http.services.erp.loadbalancer.server.port=80" \
      erp-frontend:latest
  else
    echo "ERROR: Run from project root (with deploy/Dockerfile, package.json)"
    echo "Or ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set."
    exit 1
  fi
fi

# 4. Verify Traefik routing
echo ""
echo "[4] TRAEFIK ROUTING"
echo "---"
docker service inspect erp --format '{{json .Spec.Labels}}' 2>/dev/null | jq -r 'to_entries[] | "\(.key): \(.value)"' 2>/dev/null || docker service inspect erp 2>/dev/null | grep -A2 traefik

# 5. HTTPS verify
echo ""
echo "[5] HTTPS VERIFY"
echo "---"
sleep 3
curl -sI --connect-timeout 10 "https://$DOMAIN" | head -10

echo ""
echo "=============================================="
echo "SUMMARY"
echo "=============================================="
echo "Services:"
docker service ls | grep -E "erp|traefik|dokploy"
echo ""
echo "HTTPS: curl -I https://$DOMAIN"
