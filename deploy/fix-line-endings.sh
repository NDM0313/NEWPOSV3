#!/bin/bash
# Strip CRLF from deploy scripts so they run on VPS. Run from repo root or deploy/.
# Usage: bash deploy/fix-line-endings.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for f in "$SCRIPT_DIR"/*.sh "$SCRIPT_DIR"/*.sql; do
  [ -f "$f" ] && sed -i 's/\r$//' "$f" 2>/dev/null || true
done
echo "[fix-line-endings] Done. All .sh and .sql in deploy/ use LF."
