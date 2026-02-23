#!/bin/bash
# Build iOS app for erp-mobile-app
# Run from project root: bash scripts/build-ios.sh
# Requires: Mac, Xcode, Apple Developer account

set -e
cd "$(dirname "$0")/.."

echo "[1/2] Building web assets..."
cd erp-mobile-app
npm run build:mobile

echo "[2/2] Syncing to iOS..."
npx cap sync

echo ""
echo "Next: open Xcode and build"
echo "  npx cap open ios"
echo ""
echo "In Xcode:"
echo "  1. Select your Team (Signing & Capabilities)"
echo "  2. Product → Run (simulator) or Archive (IPA)"
