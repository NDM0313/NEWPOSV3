#!/bin/bash
# One-shot deploy script. Run from project root.
# Requires: .env.production with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
  echo "Create .env.production from deploy/.env.production.example"
  exit 1
fi

source .env.production
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production build --no-cache
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d
echo "ERP running on port 3000. Configure Caddy/Nginx for https://erp.dincouture.pk"
