#!/bin/bash
# Update Kong backup route (priority + /backup/). Calls add script which now upserts.
# Run on VPS: bash deploy/fix-kong-backup-route.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/add-kong-backup-route.sh"
