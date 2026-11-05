#!/usr/bin/env bash
# One-shot on MacBook (from NEWPOSV3 root OR erp-mobile-app):
#   npm run fix:mac-ios-stage
#   # or: bash erp-mobile-app/scripts/fix-mac-ios-stage-now.sh
#
# Pulls main, builds ERP Stage (api-stage), pods, opens Xcode, and installs+launches
# on the first connected physical iPhone/iPad when possible.
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

echo "==> fast-forward origin/main"
git pull --ff-only origin main || true

cd erp-mobile-app

echo "==> tsc -b"
npx tsc -b

echo "==> .env.staging"
cp -n .env.staging.example .env.staging 2>/dev/null || true
test -f .env.staging

echo "==> ios:prep:mac:stage"
npm run ios:prep:mac:stage

echo "==> ensure CocoaPods (Pods is gitignored — required for Capacitor search paths)"
(
  cd ios/App
  # Always reinstall so Xcode FRAMEWORK_SEARCH_PATHS resolve under Pods/
  pod install --repo-update || pod install
  test -d Pods/Pods.xcodeproj || test -f Pods/Manifest.lock
  test -f App.xcworkspace/contents.xcworkspacedata
  if ! grep -q 'Pods/Pods.xcodeproj' App.xcworkspace/contents.xcworkspacedata; then
    echo "ERROR: App.xcworkspace is missing Pods — open workspace after pod install, never .xcodeproj alone."
    exit 1
  fi
  echo "OK Pods present: $(ls -d Pods | head -1)"
)

echo "==> clean stale DerivedData (fixes Capacitor search-path not found)"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/App-"* 2>/dev/null || true
rm -rf ios/build/DerivedData-stage 2>/dev/null || true

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

SCHEME="NDM ERP"
WORKSPACE="ios/App/App.xcworkspace"
BUNDLE_ID="com.dincouture.erp.stage"
DERIVED="$(pwd)/ios/build/DerivedData-stage"
mkdir -p "$DERIVED"

pick_device_udid() {
  # Prefer wired/network physical devices from devicectl JSON when available.
  if xcrun devicectl list devices --json-output /tmp/erp-devices.json >/dev/null 2>&1; then
    python3 - <<'PY'
import json
from pathlib import Path
data=json.loads(Path("/tmp/erp-devices.json").read_text())
devices=[]
# Shape varies by Xcode version; walk for plausible device dicts.
def walk(o):
    if isinstance(o, dict):
        udid=o.get("identifier") or o.get("udid") or o.get("hardwareIdentifier")
        name=o.get("name") or o.get("deviceName") or ""
        conn=str(o.get("connectionProperties") or o.get("connectionState") or o.get("state") or "")
        dtype=str(o.get("deviceType") or o.get("hardwareProperties") or o.get("platform") or "")
        if udid and ("iPhone" in name or "iPad" in name or "iOS" in dtype or "iphone" in dtype.lower()):
            if "Simulator" in name:
                return
            devices.append((str(udid), name, conn))
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for i in o:
            walk(i)
walk(data)
# Prefer available / connected
def rank(item):
    _, _, conn = item
    c=conn.lower()
    if "available" in c or "connected" in c:
        return 0
    return 1
devices.sort(key=rank)
if devices:
    print(devices[0][0])
PY
    return
  fi
  # Fallback: xctrace text list
  xcrun xctrace list devices 2>/dev/null \
    | grep -E 'iPhone|iPad' \
    | grep -v Simulator \
    | head -1 \
    | sed -E 's/.*\(([0-9A-Fa-f-]+)\).*/\1/' || true
}

open_workspace() {
  echo "==> open App.xcworkspace (never App.xcodeproj — Pods will not link)"
  osascript -e 'tell application "Xcode" to quit' >/dev/null 2>&1 || true
  sleep 1
  open "$ROOT/erp-mobile-app/ios/App/App.xcworkspace"
}

echo "==> detecting connected iPhone/iPad"
UDID="$(pick_device_udid | tr -d '[:space:]')"
if [[ -z "${UDID}" ]]; then
  echo "WARN: no physical device UDID found."
  open_workspace
  echo "In Xcode: select physical iPhone → Product → Clean Build Folder → Run (⌘R)."
  exit 0
fi
echo "==> device UDID: $UDID"
xcrun xctrace list devices 2>/dev/null | grep -E 'iPhone|iPad' | grep -v Simulator | head -5 || true

echo "==> xcodebuild Debug → device (auto provisioning)"
if ! xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=${UDID}" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM=NLNZN84GX4 \
  build
then
  echo "ERROR: xcodebuild failed. Opening workspace for manual fix."
  open_workspace
  exit 1
fi

APP_PATH="$(find "$DERIVED/Build/Products" -type d -name '*.app' | head -1 || true)"
if [[ -z "${APP_PATH}" ]]; then
  echo "ERROR: built .app not found under $DERIVED"
  open_workspace
  exit 1
fi
echo "==> app: $APP_PATH"

echo "==> install on device"
if xcrun devicectl device install app --device "$UDID" "$APP_PATH"; then
  echo "==> launch $BUNDLE_ID"
  xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" || true
  echo ""
  echo "DONE. ERP Stage installed+launched on device."
  echo "Bundle: $BUNDLE_ID"
else
  echo "WARN: devicectl install failed — opening workspace for manual Run (⌘R)."
  open_workspace
  exit 1
fi

open_workspace
