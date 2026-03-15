#!/usr/bin/env bash
# Run only when Kong is in restart loop. No-op when Kong is healthy.
# For cron: */5 * * * * /root/NEWPOSV3/deploy/kong-auto-repair-if-needed.sh
# Or run from ssh: ssh dincouture-vps "bash /root/NEWPOSV3/deploy/kong-auto-repair-if-needed.sh"

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPAIR_SCRIPT="${SCRIPT_DIR}/kong-safe-repair.sh"

if ! command -v docker &>/dev/null; then
  exit 0
fi
STATUS=$(docker ps -a --format "{{.Status}}" -f name=supabase-kong 2>/dev/null | head -1 || true)
if [ -z "$STATUS" ]; then
  exit 0
fi
if echo "$STATUS" | grep -q "Restarting"; then
  logger -t kong-auto-repair "Kong is Restarting; running kong-safe-repair.sh"
  exec bash "$REPAIR_SCRIPT"
fi
exit 0
