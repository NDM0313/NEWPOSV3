#!/bin/bash
# Capture Kong (and auth) logs to see why Kong is restarting / returning 502.
# Run on VPS:  bash deploy/kong-logs.sh
# From local:  ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/kong-logs.sh"

set -e
echo "=== Kong status ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -E "kong|auth|traefik" || true

echo ""
echo "=== Kong logs (last 150 lines) – look for 'error', 'failed', 'panic', 'parse' ==="
docker logs supabase-kong --tail 150 2>&1 || true

echo ""
echo "=== Auth logs (last 30 lines) ==="
docker logs supabase-auth --tail 30 2>&1 || true

echo ""
echo "=== If Kong shows 'failed parsing declarative configuration', run: bash deploy/fix-kong-502-auth.sh ==="
echo "=== If Kong shows another error (e.g. hide_credentials, plugin), fix kong.yml accordingly ==="
