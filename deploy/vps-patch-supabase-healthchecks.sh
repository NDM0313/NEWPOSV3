#!/usr/bin/env bash
# Patch Supabase meta/studio healthcheck intervals (5s -> 30s) to reduce zombie node processes.
# Run on VPS as root. Does NOT restart the full Docker stack.
set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"
COMPOSE_FILE="${COMPOSE_FILE:-$SUPABASE_DIR/docker-compose.yml}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "ERROR: compose file not found: $COMPOSE_FILE"
  echo "Set SUPABASE_DIR or COMPOSE_FILE if your Supabase stack lives elsewhere."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${COMPOSE_FILE}.bak-healthcheck-${STAMP}"
cp "$COMPOSE_FILE" "$BACKUP"
echo "Backup: $BACKUP"

# Normalize interval: 5s -> 30s for meta and studio healthchecks only.
# Handles YAML forms: interval: 5s, interval: "5s", interval: 5s (under meta/studio blocks).
python3 - <<'PY' "$COMPOSE_FILE"
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
lines = text.splitlines()
out = []
in_target = False
target_depth = 0
for line in lines:
    m = re.match(r'^(\s*)(meta|studio):\s*$', line)
    if m:
        in_target = True
        target_depth = len(m.group(1))
        out.append(line)
        continue
    if in_target:
        cur_depth = len(line) - len(line.lstrip()) if line.strip() else target_depth + 1
        if line.strip() and cur_depth <= target_depth and not re.match(r'^\s*(meta|studio):\s*$', line):
            in_target = False
        elif re.search(r'^\s*interval:\s*"?5s"?\s*$', line):
            indent = re.match(r'^(\s*)', line).group(1)
            line = f"{indent}interval: 30s"
    out.append(line)
open(path, "w", encoding="utf-8").write("\n".join(out) + ("\n" if text.endswith("\n") else ""))
print("Patched healthcheck intervals for meta/studio (5s -> 30s)")
PY

cd "$SUPABASE_DIR"
docker compose up -d --no-deps meta studio
echo "Done. meta + studio recreated with 30s healthcheck interval."
