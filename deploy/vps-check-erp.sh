#!/bin/bash
# Run on VPS from ~/NEWPOSV3 to debug "This page isn't working" for erp.dincouture.pk

set -e
echo "=== 1. Container running? ==="
docker ps -a --filter name=erp-frontend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== 2. Local curl (port 3000) ==="
curl -sI http://127.0.0.1:3000/ 2>/dev/null | head -5 || echo "FAIL: Cannot reach port 3000"

echo ""
echo "=== 3. Last 20 lines of container log ==="
docker logs erp-frontend --tail 20 2>&1

echo ""
echo "=== 4. Port 3000 listener ==="
ss -tlnp | grep 3000 || netstat -tlnp 2>/dev/null | grep 3000 || echo "Check if 3000 is bound"
