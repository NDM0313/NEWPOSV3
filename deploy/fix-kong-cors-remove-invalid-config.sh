#!/bin/bash
# Remove CORS plugin entries that have config with hide_credentials or key_in_query (Kong rejects these).
# Run on VPS after fix-kong-502-auth.sh if Kong still fails with "unknown field".
# Usage: bash deploy/fix-kong-cors-remove-invalid-config.sh

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"

[ ! -f "$KONG_YML" ] && { echo "[fix-cors] kong.yml not found"; exit 1; }

cp "$KONG_YML" "${KONG_YML}.bak-cors-$(date +%Y%m%d-%H%M%S)"

python3 - "$KONG_YML" << 'PY'
import sys, re
path = sys.argv[1]
with open(path) as f:
    lines = f.readlines()

out = []
i = 0
while i < len(lines):
    line = lines[i]
    # Match "- name: cors" at list indent (e.g. 6 spaces under plugins)
    if re.match(r'^\s*-\s+name:\s+cors\s*$', line):
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        # If next non-empty line is "config:", skip this entire plugin entry (cors + config block)
        if j < len(lines) and re.match(r'^\s{4,10}config:\s*$', lines[j]):
            list_indent = len(line) - len(line.lstrip())
            i += 1
            while i < len(lines):
                ln = lines[i]
                if ln.strip():
                    ind = len(ln) - len(ln.lstrip())
                    if ind <= list_indent + 2 and re.match(r'^\s*-\s+name:\s*', ln):
                        break
                i += 1
            continue
    out.append(line)
    i += 1

with open(path, 'w') as f:
    f.writelines(out)
print("[fix-cors] Removed all CORS plugin entries that had config (hide_credentials/key_in_query).")
PY

(cd "$SUPABASE_DIR" && docker compose restart kong) || true
echo "[fix-cors] Kong restarted. Wait ~20s then test: curl -sS -o /dev/null -w '%{http_code}' -H 'apikey: \$ANON_KEY' https://supabase.dincouture.pk/auth/v1/health"
