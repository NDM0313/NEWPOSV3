#!/bin/bash
# One-shot: build, start ERP, connect to proxy network. Run on VPS: bash deploy/vps-fix-and-run.sh

set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "[1/5] Project root: $ROOT"
test -f .env.production || { echo "ERROR: .env.production missing"; exit 1; }

echo "[2/5] Build and start container..."
docker compose -f deploy/docker-compose.prod.yml --project-directory "$ROOT" --env-file .env.production up -d --build

echo "[3/5] Wait for container to be ready..."
sleep 5

echo "[4/5] Connect to proxy network (Dokploy/Traefik)..."
docker network connect dokploy-network erp-frontend 2>/dev/null || true

echo "[5/5] Check..."
docker ps --filter name=erp-frontend --format "{{.Names}} {{.Status}} {{.Ports}}"
echo ""
if curl -sf -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/ | grep -q 200; then
  echo "OK: App responding on port 3001."
  echo "Open: https://erp.dincouture.pk (Traefik must route to erp-frontend:80 on dokploy-network)"
else
  echo "WARN: curl localhost:3001 did not return 200. Check: docker logs erp-frontend --tail 50"
fi
