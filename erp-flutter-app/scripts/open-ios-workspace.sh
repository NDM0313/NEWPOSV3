#!/usr/bin/env bash
# Open Xcode for signing / Team selection before first device install.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_ROOT/ios"
pod install
open Runner.xcworkspace
