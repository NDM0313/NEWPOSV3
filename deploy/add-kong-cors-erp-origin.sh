#!/bin/bash
# Ensure Kong CORS allows https://erp.dincouture.pk plus Capacitor / localhost Origins for mobile WebViews.
# Run on VPS: bash deploy/add-kong-cors-erp-origin.sh

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
ORIGIN="${ORIGIN:-https://erp.dincouture.pk}"

if [ ! -f "$KONG_YML" ]; then
  echo "[kong-cors] kong.yml not found at $KONG_YML. Skip."
  exit 0
fi

cp "$KONG_YML" "${KONG_YML}.bak"
python3 - "$KONG_YML" "$ORIGIN" << 'PY'
import re
import sys

path, _origin = sys.argv[1], sys.argv[2]

REQUIRED_ORIGINS = [
    "https://erp.dincouture.pk",
    "capacitor://localhost",
    "ionic://localhost",
    "http://localhost",
    "https://localhost",
]


def cors_block_multi():
    """Full cors plugin config block (multi-origin) for plugins that had no config."""
    lines = [
        "    config:",
        "      origins:",
    ]
    for o in REQUIRED_ORIGINS:
        lines.append('      - "%s"' % o)
    lines.extend(
        [
            "      credentials: true",
            "      methods:",
            "      - GET",
            "      - HEAD",
            "      - PUT",
            "      - PATCH",
            "      - POST",
            "      - DELETE",
            "      - OPTIONS",
            "      headers:",
            "      - Authorization",
            "      - Content-Type",
            "      - Accept",
            "      - apikey",
            "      - prefer",
            "      - x-client-info",
            "      - x-supabase-api-version",
            "      preflight_continue: false",
        ]
    )
    return lines


def merge_origins_blocks(lines):
    """Under every `origins:` key, ensure each REQUIRED_ORIGINS entry exists as a - \"url\" line."""
    res = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if re.match(r"^\s*origins:\s*$", line):
            res.append(line)
            i += 1
            indent = "      "
            have = set()
            dash_lines = []
            while i < n:
                m = re.match(r"^(\s+)-\s*\"([^\"]+)\"\s*$", lines[i])
                if m:
                    indent = m.group(1)
                    have.add(m.group(2))
                    dash_lines.append(lines[i])
                    i += 1
                elif not lines[i].strip():
                    res.append(lines[i])
                    i += 1
                else:
                    break
            for o in REQUIRED_ORIGINS:
                if o not in have:
                    dash_lines.append('%s- "%s"' % (indent, o))
                    have.add(o)
            res.extend(dash_lines)
            continue
        res.append(line)
        i += 1
    return res


with open(path) as f:
    content = f.read()

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
            for L in cors_block_multi():
                out.append(L)
        else:
            block_end = j
            while block_end < len(lines) and (lines[block_end].startswith("    ") or not lines[block_end].strip()):
                block_end += 1
            block = "\n".join(lines[j:block_end])
            if "preflight_continue:" not in block:
                k = j
                while k < block_end:
                    out.append(lines[k])
                    if "credentials: true" in lines[k]:
                        out.append("      methods:")
                        out.append("      - GET")
                        out.append("      - HEAD")
                        out.append("      - PUT")
                        out.append("      - PATCH")
                        out.append("      - POST")
                        out.append("      - DELETE")
                        out.append("      - OPTIONS")
                        out.append("      headers:")
                        out.append("      - Authorization")
                        out.append("      - Content-Type")
                        out.append("      - Accept")
                        out.append("      - apikey")
                        out.append("      - prefer")
                        out.append("      - x-client-info")
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

merged = merge_origins_blocks(out)
new_content = "\n".join(merged)
if new_content != content:
    with open(path, "w") as f:
        f.write(new_content)
    print("[kong-cors] Patched kong.yml (erp + mobile origins + methods/preflight where missing)")
else:
    print("[kong-cors] No change.")
PY

SUPABASE_DIR="$(dirname "$(dirname "$(dirname "$KONG_YML")")")"
if [ -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
  echo "[kong-cors] Kong recreated. Test login at https://erp.dincouture.pk"
fi
