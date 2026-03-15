#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/root/NEWPOSV3}"
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
DOMAIN="${DOMAIN:-https://supabase.dincouture.pk}"

echo "=== git commit ==="
(git -C "$PROJECT_DIR" rev-parse HEAD || true)

echo "=== container status ==="
(docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'supabase-kong|supabase-auth|supabase-rest' || true)

echo "=== recent Kong logs ==="
(docker logs --tail=80 supabase-kong || true)

echo "=== kong.yml suspicious section ==="
(nl -ba "$KONG_YML" | sed -n '140,240p' || true)

echo "=== public health ==="
(curl -i "$DOMAIN/auth/v1/health" || true)
(curl -i "$DOMAIN/rest/v1/" || true)
