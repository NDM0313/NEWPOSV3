#!/bin/bash
# Add /backup route to Kong so https://supabase.dincouture.pk/backup serves backup page (erp-backup-page).
# Run on VPS: bash deploy/add-kong-backup-route.sh

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$KONG_YML" ]; then
  echo "[kong-backup] kong.yml not found at $KONG_YML. Skip."
  exit 0
fi

cp "$KONG_YML" "${KONG_YML}.bak"
python3 - "$KONG_YML" << 'PY'
import sys, re
path = sys.argv[1]
block = """  ## Backup page (self-hosted - Studio has no Backup menu)
  - name: backup-page
    _comment: 'Serve backup instructions at /backup'
    url: http://erp-backup-page:80/
    routes:
      - name: backup-route
        strip_path: true
        paths:
          - /backup
          - /backup/
    plugins:
      - name: cors

"""
with open(path) as f:
    content = f.read()
marker = "  ## Protected Dashboard - catch all remaining routes"
if marker not in content:
    print("[kong-backup] Marker not found in kong.yml. Skip.")
    sys.exit(0)
# Remove existing backup block if present (from "  ## Backup page" to next "  ## ")
if "name: backup-route" in content:
    content = re.sub(
        r'\n  ## Backup page[^\n]*\n.*?(?=\n  ## )',
        '\n',
        content,
        flags=re.DOTALL
    )
    content = re.sub(r'\n{3,}', '\n\n', content)
new_content = content.replace(marker, block + marker)
with open(path, "w") as f:
    f.write(new_content)
print("[kong-backup] Backup route added/updated in kong.yml")
PY

SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
  echo "[kong-backup] Recreated Kong. Open https://supabase.dincouture.pk/backup"
fi
