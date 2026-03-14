#!/bin/bash
# Ensure Kong CORS allows https://erp.dincouture.pk so login from ERP returns JSON (no "request was denied").
# Run on VPS: bash deploy/add-kong-cors-erp-origin.sh

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
ORIGIN="https://erp.dincouture.pk"

if [ ! -f "$KONG_YML" ]; then
  echo "[kong-cors] kong.yml not found at $KONG_YML. Skip."
  exit 0
fi

# Backup and patch: add config.origins and config.credentials to every cors plugin
cp "$KONG_YML" "${KONG_YML}.bak"
python3 - "$KONG_YML" "$ORIGIN" << 'PY'
import sys, re
path, origin = sys.argv[1], sys.argv[2]
with open(path) as f:
    content = f.read()

# Already has full config (origins + preflight_continue)?
if re.search(r"origins:\s*\n\s*-\s*" + re.escape(origin), content) and "preflight_continue:" in content:
    print("[kong-cors] CORS already allows erp.dincouture.pk with full config. No change.")
    sys.exit(0)

def cors_block(origin):
    return [
        "    config:",
        "      origins:",
        '      - "%s"' % origin,
        "      credentials: true",
        "      methods:",
        "      - GET", "      - HEAD", "      - PUT", "      - PATCH", "      - POST", "      - DELETE", "      - OPTIONS",
        "      headers:",
        "      - Authorization", "      - Content-Type", "      - Accept", "      - apikey", "      - prefer",
        "      - x-client-info", "      - x-supabase-api-version",
        "      preflight_continue: false",
    ]

lines = content.split("\n")
out = []
i = 0
while i < len(lines):
    line = lines[i]
    out.append(line)
    if re.match(r"^\s*-\s+name:\s+cors\s*$", line):
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            out.append(lines[j])
            j += 1
        if j >= len(lines):
            i += 1
            continue
        if "config:" not in lines[j]:
            for L in cors_block(origin):
                out.append(L)
        else:
            # Already has config; add methods/headers/preflight if missing
            block_end = j
            while block_end < len(lines) and (lines[block_end].startswith("    ") or not lines[block_end].strip()):
                block_end += 1
            block = "\n".join(lines[j:block_end])
            if "preflight_continue:" not in block:
                # Insert after credentials: true
                k = j
                while k < block_end:
                    out.append(lines[k])
                    if "credentials: true" in lines[k]:
                        out.append("      methods:")
                        out.append("      - GET"); out.append("      - HEAD"); out.append("      - PUT")
                        out.append("      - PATCH"); out.append("      - POST"); out.append("      - DELETE"); out.append("      - OPTIONS")
                        out.append("      headers:")
                        out.append("      - Authorization"); out.append("      - Content-Type"); out.append("      - Accept")
                        out.append("      - apikey"); out.append("      - prefer"); out.append("      - x-client-info")
                        out.append("      - x-supabase-api-version")
                        out.append("      preflight_continue: false")
                        k += 1
                        while k < block_end:
                            out.append(lines[k])
                            k += 1
                        break
                    k += 1
                i = block_end - 1
            else:
                while j < block_end:
                    out.append(lines[j])
                    j += 1
                i = block_end - 1
    i += 1

new_content = "\n".join(out)
if new_content != content:
    with open(path, "w") as f:
        f.write(new_content)
    print("[kong-cors] Added CORS config (origins: %s, credentials: true) in kong.yml" % origin)
else:
    print("[kong-cors] No change.")
PY

SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
  echo "[kong-cors] Kong recreated. Test login at https://erp.dincouture.pk"
fi
