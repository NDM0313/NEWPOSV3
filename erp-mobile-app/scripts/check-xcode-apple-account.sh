#!/usr/bin/env bash
# Fail fast when Xcode has no Apple Developer account (CLI archive needs this).
set -euo pipefail

XCODE_PLIST="$HOME/Library/Preferences/com.apple.dt.Xcode.plist"
TEAM_ID="${IOS_DEVELOPMENT_TEAM:-NLNZN84GX4}"

if [[ ! -f "$XCODE_PLIST" ]]; then
  echo "[check-xcode-apple-account] Xcode preferences not found — open Xcode once."
  exit 1
fi

ACCOUNTS="$(/usr/libexec/PlistBuddy -c 'Print DVTDeveloperAccountManagerAppleIDLists:IDE.Identifiers.Prod' "$XCODE_PLIST" 2>/dev/null || true)"
if [[ -z "$ACCOUNTS" || "$ACCOUNTS" == *"Array {"* && "$ACCOUNTS" == *"}"* && $(echo "$ACCOUNTS" | wc -c) -lt 20 ]]; then
  echo ""
  echo "ERROR: No Apple ID in Xcode → Settings → Accounts."
  echo "       CLI archive with -allowProvisioningUpdates cannot create provisioning profiles without this."
  echo ""
  echo "Fix (one time, ~1 min):"
  echo "  1. Open Xcode → Settings (⌘,) → Accounts → + → Apple ID"
  echo "  2. Sign in: nadeem313khan@yahoo.com (team $TEAM_ID)"
  echo "  3. Select team → Download Manual Profiles (optional)"
  echo "  4. Re-run: npm run ios:ipa:release:mac"
  echo ""
  echo "Certificate in Keychain is OK; expired/missing provisioning profile needs Xcode account to refresh."
  exit 1
fi

if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Development"; then
  echo "[check-xcode-apple-account] No Apple Development certificate in Keychain."
  echo "  Xcode → Settings → Accounts → Manage Certificates → + → Apple Development"
  exit 1
fi

echo "[check-xcode-apple-account] OK — Apple ID and development certificate present."
