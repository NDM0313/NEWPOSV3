#!/bin/bash
# Add root path (/) route so https://supabase.dincouture.pk/ returns friendly JSON
# instead of "no Route matched with those values".
# Run on VPS: bash deploy/add-kong-root-route.sh (or run during deploy).

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"

if [ ! -f "$KONG_YML" ]; then
  echo "[kong-root] kong.yml not found at $KONG_YML. Skip."
  exit 0
fi

cp "$KONG_YML" "${KONG_YML}.bak-root"
python3 - "$KONG_YML" << 'PY'
import sys
path = sys.argv[1]
root_block = """  ## Root path - friendly response instead of "no Route matched"
  - name: root-info
    _comment: 'GET / -> 200 JSON (no apikey required)'
    url: http://127.0.0.1:1
    routes:
      - name: root-route
        paths:
          - /
    plugins:
      - name: request-termination
        config:
          status_code: 200
          content_type: application/json
          body: '{"service":"Supabase API","message":"Use /auth/v1/health with apikey header for health check. ERP: https://erp.dincouture.pk"}'

"""
with open(path) as f:
    content = f.read()

# Already has root route
if "name: root-route" in content and "name: root-info" in content:
    print("[kong-root] Root route already present. Skip.")
    sys.exit(0)

marker = "services:\n"
idx = content.find(marker)
if idx == -1:
    print("[kong-root] 'services:' not found. Skip.")
    sys.exit(1)
end = idx + len(marker)
new_content = content[:end] + root_block + content[end:]
with open(path, "w") as f:
    f.write(new_content)
print("[kong-root] Root route added to kong.yml")
PY

SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  (cd "$SUPABASE_DIR" && docker compose restart kong 2>/dev/null) || true
  echo "[kong-root] Kong restarted. Open https://supabase.dincouture.pk/"
fi
