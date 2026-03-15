#!/bin/bash
# Fix 502 Bad Gateway on supabase.dincouture.pk/auth/v1/* (Kong crash due to invalid kong.yml).
# Removes misplaced CORS config blocks that cause "failed parsing declarative configuration".
#
# Run on VPS:  cd /root/NEWPOSV3 && bash deploy/fix-kong-502-auth.sh
# From local:  ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/fix-kong-502-auth.sh"

set -e
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"

echo "[fix-kong-502] Checking Kong and kong.yml..."

if [ ! -f "$KONG_YML" ]; then
  echo "[fix-kong-502] kong.yml not found at $KONG_YML. Set KONG_YML or run on VPS where Supabase lives."
  exit 1
fi

# Only apply fix when Kong is failing with "failed parsing declarative configuration" (misplaced CORS).
# If Kong is healthy or fails for another reason (e.g. hide_credentials), do not modify kong.yml.
NEED_FIX=false
if command -v docker &>/dev/null; then
  docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | grep -E "kong|auth" || true
  if docker logs supabase-kong --tail 80 2>/dev/null | grep -q "failed parsing declarative configuration"; then
    NEED_FIX=true
    echo "[fix-kong-502] Kong is failing due to config parse error (misplaced CORS). Applying fix."
  fi
fi

if [ "$NEED_FIX" != "true" ]; then
  echo "[fix-kong-502] Kong is not in 'failed parsing declarative configuration' state. Skipping config change (runbook: fix kong.yml only when logs show that error)."
  echo "[fix-kong-502] To test auth: curl -sS -o /dev/null -w '%{http_code}' -H \"apikey: \$ANON_KEY\" https://supabase.dincouture.pk/auth/v1/health"
  exit 0
fi

# Backup
BAK="${KONG_YML}.bak-502-$(date +%Y%m%d-%H%M%S)"
cp "$KONG_YML" "$BAK"
echo "[fix-kong-502] Backed up to $BAK"

# Remove misplaced CORS config blocks (config: at same indent as "- name: cors", not nested under it)
python3 - "$KONG_YML" << 'PY'
import sys, re

path = sys.argv[1]
with open(path) as f:
    lines = f.readlines()

out = []
i = 0
while i < len(lines):
    line = lines[i]
    # After "  - name: cors", next non-empty line may be misplaced "    config:" (sibling, not child)
    if re.match(r"^\s*-\s+name:\s+cors\s*$", line):
        out.append(line)
        i += 1
        while i < len(lines) and not lines[i].strip():
            out.append(lines[i])
            i += 1
        if i >= len(lines):
            continue
        # Misplaced: "config:" at same indent as the list item (e.g. 4 spaces)
        if re.match(r"^\s{2,6}config:\s*$", lines[i]):
            # Skip this line and all following until we see next plugin "  - name:" at same indent
            list_indent = len(line) - len(line.lstrip())  # indent of "- name: cors"
            while i < len(lines):
                ln = lines[i]
                if ln.strip():
                    indent = len(ln) - len(ln.lstrip())
                    if indent <= list_indent + 2 and re.match(r"^\s*-\s+name:\s*", ln):
                        break
                i += 1
            continue
    out.append(line)
    i += 1

new_content = "".join(out)
with open(path, "w") as f:
    f.write(new_content)
print("[fix-kong-502] Removed misplaced CORS config blocks from kong.yml")
PY

# Restart Kong
if [ -f "$SUPABASE_DIR/docker-compose.yml" ] && command -v docker &>/dev/null; then
  (cd "$SUPABASE_DIR" && docker compose restart kong) || true
  echo "[fix-kong-502] Kong restarted. Waiting 25s for startup..."
  sleep 25
fi

# Verify auth health (optional: needs ANON_KEY in env)
if command -v curl &>/dev/null; then
  if [ -n "${ANON_KEY}" ]; then
    CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H "apikey: ${ANON_KEY}" https://supabase.dincouture.pk/auth/v1/health 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
      echo "[fix-kong-502] OK: auth/v1/health returned 200"
    else
      echo "[fix-kong-502] auth/v1/health returned $CODE (set ANON_KEY and retry, or test from browser)"
    fi
  else
    # Try .env
    if [ -f "$SUPABASE_DIR/.env" ]; then
      source "$SUPABASE_DIR/.env" 2>/dev/null || true
      CODE=$(curl -sS -o /dev/null -w '%{http_code}' -H "apikey: ${ANON_KEY}" https://supabase.dincouture.pk/auth/v1/health 2>/dev/null || echo "000")
      if [ "$CODE" = "200" ]; then
        echo "[fix-kong-502] OK: auth/v1/health returned 200"
      else
        echo "[fix-kong-502] auth/v1/health returned $CODE"
      fi
    else
      echo "[fix-kong-502] Test from browser: https://erp.dincouture.pk (login should work if Kong is up)"
    fi
  fi
fi

echo "[fix-kong-502] Done. If 502 persists, check: docker logs supabase-kong --tail 50"
