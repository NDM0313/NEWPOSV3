#!/usr/bin/env bash
# Run only when supabase-studio is down or studio.dincouture.pk returns 502.
# For cron: */5 * * * * /root/NEWPOSV3/deploy/studio-auto-repair-if-needed.sh
# Or: ssh dincouture-vps "bash /root/NEWPOSV3/deploy/studio-auto-repair-if-needed.sh"

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENSURE_SCRIPT="${SCRIPT_DIR}/ensure-supabase-studio.sh"
STUDIO_NAME="${STUDIO_NAME:-supabase-studio}"

if ! command -v docker >/dev/null 2>&1; then
  exit 0
fi

NEEDS_REPAIR=0

STATUS="$(docker ps -a --format '{{.Status}}' -f "name=^${STUDIO_NAME}$" 2>/dev/null | head -1 || true)"
if [ -z "$STATUS" ]; then
  NEEDS_REPAIR=1
elif echo "$STATUS" | grep -qiE 'Created|Exited|Restarting'; then
  NEEDS_REPAIR=1
fi

if [ "$NEEDS_REPAIR" -eq 0 ] && command -v curl >/dev/null 2>&1; then
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 10 https://studio.dincouture.pk/ 2>/dev/null || echo 000)"
  if [ "$CODE" = "502" ] || [ "$CODE" = "000" ]; then
    NEEDS_REPAIR=1
  fi
fi

if [ "$NEEDS_REPAIR" -eq 1 ]; then
  logger -t studio-auto-repair "Studio unhealthy (status=${STATUS:-missing}); running ensure-supabase-studio.sh" 2>/dev/null || true
  exec bash "$ENSURE_SCRIPT"
fi

exit 0
