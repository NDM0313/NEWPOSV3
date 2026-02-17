#!/bin/bash
# Fix ERP 401 auth: ensure VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY at BUILD time, rebuild, restart.
# Run on VPS: bash deploy/fix-erp-supabase-auth-on-vps.sh
# Or from local: ssh root@72.62.254.176 -p 22 "bash -s" < deploy/fix-erp-supabase-auth-on-vps.sh

set -e
DOMAIN="erp.dincouture.pk"
PROJECT_DIR="${PROJECT_DIR:-/root/NEWPOSV3}"

echo "=============================================="
echo "ERP Supabase auth fix (build-time env)"
echo "=============================================="

# 1. Find project (accept deploy/Dockerfile or root Dockerfile)
if [ -f "$PROJECT_DIR/deploy/Dockerfile" ]; then
  DOCKERFILE="$PROJECT_DIR/deploy/Dockerfile"
  COMPOSE_FILE="$PROJECT_DIR/deploy/docker-compose.prod.yml"
elif [ -f "$PROJECT_DIR/Dockerfile" ]; then
  DOCKERFILE="$PROJECT_DIR/Dockerfile"
  COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
elif [ -f "deploy/Dockerfile" ]; then
  PROJECT_DIR="$(pwd)"
  DOCKERFILE="$PROJECT_DIR/deploy/Dockerfile"
  COMPOSE_FILE="$PROJECT_DIR/deploy/docker-compose.prod.yml"
elif [ -f "Dockerfile" ]; then
  PROJECT_DIR="$(pwd)"
  DOCKERFILE="$PROJECT_DIR/Dockerfile"
  COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
else
  echo "ERROR: Project not found at $PROJECT_DIR (no Dockerfile in root or deploy/)."
  exit 1
fi
cd "$PROJECT_DIR"
echo "[1] Project: $PROJECT_DIR"

# 2. Ensure .env.production with valid VITE_*
if [ ! -f .env.production ]; then
  echo "[2] No .env.production – creating from Supabase docker env or defaults"
  # Try self-hosted Supabase env (same VPS)
  if [ -f /root/supabase/docker/.env ]; then
    source /root/supabase/docker/.env 2>/dev/null || true
    ANON="${ANON_KEY:-$SUPABASE_ANON_KEY}"
    API_URL="${API_EXTERNAL_URL:-}"
  fi
  if [ -z "$ANON" ] && [ -f /opt/supabase/.env ]; then
    source /opt/supabase/.env 2>/dev/null || true
    ANON="${ANON_KEY:-$SUPABASE_ANON_KEY}"
    API_URL="${API_EXTERNAL_URL:-}"
  fi
  export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$API_URL}"
  [ -z "$VITE_SUPABASE_URL" ] && export VITE_SUPABASE_URL="https://$DOMAIN"
  export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$ANON}"
  if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "ERROR: VITE_SUPABASE_ANON_KEY not set. Create .env.production with:"
    echo "  VITE_SUPABASE_URL=https://$DOMAIN"
    echo "  VITE_SUPABASE_ANON_KEY=<your-anon-key>"
    exit 1
  fi
  printf "VITE_SUPABASE_URL=%s\nVITE_SUPABASE_ANON_KEY=%s\n" "$VITE_SUPABASE_URL" "$VITE_SUPABASE_ANON_KEY" > .env.production
  echo "    Created .env.production with VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
else
  source .env.production 2>/dev/null || true
  export VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://$DOMAIN}"
  export VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}"
  if [ -z "$VITE_SUPABASE_ANON_KEY" ] || [ "$VITE_SUPABASE_ANON_KEY" = "your-anon-key" ]; then
    echo "ERROR: .env.production has no valid VITE_SUPABASE_ANON_KEY. Edit and set both:"
    echo "  VITE_SUPABASE_URL=https://$DOMAIN (or your Supabase API URL)"
    echo "  VITE_SUPABASE_ANON_KEY=<anon-key>"
    exit 1
  fi
  if [ -z "$VITE_SUPABASE_URL" ] || [ "$VITE_SUPABASE_URL" = "https://your-supabase-api-url" ]; then
    export VITE_SUPABASE_URL="https://$DOMAIN"
    sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$VITE_SUPABASE_URL|" .env.production 2>/dev/null || true
  fi
  echo "[2] Using .env.production (VITE_SUPABASE_URL=$VITE_SUPABASE_URL)"
fi

# 3. Pull latest (optional)
if git rev-parse --git-dir >/dev/null 2>&1; then
  git pull --rebase 2>/dev/null || echo "    (git pull skipped)"
fi

# 4. Rebuild with env
echo "[3] Building image with VITE_SUPABASE_*..."
docker build -t erp-frontend:latest \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -f "$DOCKERFILE" .

# 5. Restart: Swarm service or compose
ERP_SVC=$(docker service ls -q --filter name=erp 2>/dev/null | head -1)
if [ -n "$ERP_SVC" ]; then
  echo "[4] Updating Swarm service: $ERP_SVC"
  docker service update --image erp-frontend:latest "$ERP_SVC" --force 2>/dev/null || \
  docker service update --image erp-frontend:latest erp-frontend --force 2>/dev/null || true
else
  echo "[4] Restarting with docker compose..."
  docker compose -f "$COMPOSE_FILE" --env-file .env.production up -d --build 2>/dev/null || {
    docker compose -f "$COMPOSE_FILE" --env-file .env.production up -d --force-recreate 2>/dev/null || true
  }
fi

echo ""
echo "=============================================="
echo "Done. Wait ~30s then test:"
echo "  curl -sI https://$DOMAIN | head -5"
echo "  Open https://$DOMAIN and try login."
echo "=============================================="
