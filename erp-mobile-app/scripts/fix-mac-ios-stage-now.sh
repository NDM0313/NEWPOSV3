#!/usr/bin/env bash
# One-shot: fix merge-broken TS from origin/main, build iOS Stage, open Xcode.
# Run on MacBook from ANY cwd inside the NEWPOSV3 repo:
#   bash erp-mobile-app/scripts/fix-mac-ios-stage-now.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "${ROOT}" ]; then
  echo "ERROR: not inside a git repo. cd into NEWPOSV3 first."
  exit 1
fi
cd "$ROOT"
echo "==> repo: $ROOT"
echo "==> host: $(hostname) $(uname -s)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: this script must run on macOS (Xcode / CocoaPods)."
  exit 1
fi

git fetch origin

if [ -n "$(git ls-files -u)" ]; then
  echo "==> aborting in-progress merge/rebase"
  git merge --abort 2>/dev/null || true
  git rebase --abort 2>/dev/null || true
fi

echo "==> restore clean files from origin/main"
git checkout origin/main -- \
  erp-mobile-app/vite.config.ts \
  erp-mobile-app/src/lib/supabase.ts \
  erp-mobile-app/src/lib/resolveSupabaseApiUrl.ts \
  erp-mobile-app/src/App.tsx \
  erp-mobile-app/src/components/StagingEnvBanner.tsx \
  erp-mobile-app/capacitor.config.ts \
  erp-mobile-app/package.json \
  erp-mobile-app/.env.staging.example \
  erp-mobile-app/scripts/badge-ios-stage-icon.py \
  erp-mobile-app/scripts/mac-merge-origin-main-stage.sh \
  erp-mobile-app/scripts/auto-resolve-merge-conflicts.mjs || true

# Fast-forward if possible (ignore dirty unrelated files)
git pull --ff-only origin main || true

cd erp-mobile-app

echo "==> tsc -b"
npx tsc -b

echo "==> .env.staging"
cp -n .env.staging.example .env.staging 2>/dev/null || true
test -f .env.staging

echo "==> ios:prep:mac:stage"
npm run ios:prep:mac:stage

echo "==> verify identity"
grep PRODUCT_BUNDLE_IDENTIFIER ios/App/App.xcodeproj/project.pbxproj | head -2
grep -A1 CFBundleDisplayName ios/App/App/Info.plist | head -3
python3 - <<'PY'
import json
from pathlib import Path
c=json.load(open("ios/App/App/capacitor.config.json"))
assert c["appId"]=="com.dincouture.erp.stage", c
assert c["appName"]=="ERP Stage", c
js=next(Path("dist/assets").glob("index-*.js")).read_text(errors="replace")
for s in ("api-stage.ndmcore.com","[STAGING DB]","Created by","Filters"):
    assert s in js, f"missing {s} in dist"
print("OK", c["appId"], c["appName"])
PY

echo "==> opening Xcode workspace"
npx cap open ios

# Best-effort: build+run on first connected iPhone if xcodebuild device list works
if command -v xcrun >/dev/null 2>&1; then
  DEVICES="$(xcrun xctrace list devices 2>/dev/null | grep -E 'iPhone|iPad' | grep -v Simulator | head -5 || true)"
  echo "==> devices:"
  echo "$DEVICES"
fi

echo ""
echo "DONE. In Xcode: select your iPhone → Product → Run (⌘R)."
echo "App name: ERP Stage  |  Bundle: com.dincouture.erp.stage"
