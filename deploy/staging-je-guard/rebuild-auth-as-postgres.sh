#!/usr/bin/env bash
set -euo pipefail
# Rebuild AUTH_URI as postgres superuser on clone so GoTrue can migrate/operate
# without reserved-role ownership issues. Staging-only.
STAGE_DIR=/root/je-guard-stage
CLONE_DB=ledger_stage_20260919_prodcheck
source /root/supabase/docker/.env
python3 - <<PY
from urllib.parse import quote
pw = """$POSTGRES_PASSWORD"""
clone = "$CLONE_DB"
uri = f"postgres://postgres:{quote(pw, safe='')}@db:5432/{clone}?search_path=auth"
open("/root/je-guard-stage/_auth_uri","w").write(uri)
print("AUTH_URI_REBUILT_AS_POSTGRES")
PY
chmod 600 "$STAGE_DIR/_auth_uri"

# Ensure schema_migrations exists and note version count (no secrets)
docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='auth' AND table_name='schema_migrations';"
docker exec supabase-db psql -U postgres -d "$CLONE_DB" -t -A -c \
  "SELECT COUNT(*) FROM auth.schema_migrations;" 2>/dev/null || echo "0"

# Restart only staging auth with updated compose env — regenerate compose from existing rest uri
bash /tmp/bootstrap-http-stack.sh
