#!/usr/bin/env bash
# Ensure Kong realtime-v1-ws (+ rest) have key-auth before acl — ACL alone returns 401.
# Run on VPS: bash deploy/fix-kong-realtime-key-auth.sh

set -euo pipefail

KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"

if [ ! -f "$KONG_YML" ]; then
  echo "[fix-kong-realtime] Missing $KONG_YML"
  exit 1
fi

cp "$KONG_YML" "${KONG_YML}.bak.$(date +%Y%m%d%H%M%S)"

python3 - "$KONG_YML" << 'PY'
import re
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

KEY_AUTH = """      - name: key-auth
        config:
          hide_credentials: false
"""

changed = False
for svc in ("realtime-v1-ws", "realtime-v1-rest"):
    section = re.search(rf"  - name: {svc}\n.*?(?=  - name: |\Z)", content, re.DOTALL)
    if not section:
        print(f"[fix-kong-realtime] {svc}: block not found")
        continue
    if "key-auth" in section.group(0):
        print(f"[fix-kong-realtime] {svc}: key-auth already present")
        continue
    pat = re.compile(rf"(  - name: {svc}\n.*?plugins:\n)(      - name: cors)", re.DOTALL)
    new_content, n = pat.subn(r"\1" + KEY_AUTH + r"\2", content, count=1)
    if n:
        content = new_content
        changed = True
        print(f"[fix-kong-realtime] Added key-auth to {svc}")
    else:
        print(f"[fix-kong-realtime] {svc}: could not insert key-auth")

if not changed:
    print("[fix-kong-realtime] No changes needed")
    sys.exit(0)

with open(path, "w") as f:
    f.write(content)
print("[fix-kong-realtime] kong.yml updated")
PY

SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate)
  echo "[fix-kong-realtime] Kong recreated"
fi

echo "[fix-kong-realtime] Verify: bash deploy/diagnose-realtime-ws-vps.sh"
