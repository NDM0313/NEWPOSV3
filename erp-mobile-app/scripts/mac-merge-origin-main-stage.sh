#!/usr/bin/env bash
# Run on MacBook Pro from erp-mobile-app (or repo root) when local edits block `git pull`.
# 1) Commits local work  2) Merges origin/main  3) Preps iOS staging for Xcode
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
cd "$REPO"

echo "==> git status"
git status -sb
echo "==> git diff --stat"
git diff --stat || true

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "==> staging & committing local Mac changes"
  git add -A erp-mobile-app
  # Keep secrets out if somehow staged
  git reset HEAD -- erp-mobile-app/.env erp-mobile-app/.env.local erp-mobile-app/.env.production erp-mobile-app/.env.staging 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "feat(mac): preserve local mobile app changes and sales filters"
  else
    echo "No staged erp-mobile-app changes to commit (env secrets skipped)."
  fi
else
  echo "Working tree clean — nothing to commit."
fi

echo "==> git pull --no-rebase origin main"
git pull --no-rebase origin main

if [ -n "$(git ls-files -u)" ]; then
  echo ""
  echo "MERGE CONFLICTS DETECTED. Resolve keeping BOTH:"
  echo "  - origin: production HTTPS endpoints + iOS staging (capacitor.config, package scripts, badge icon)"
  echo "  - local: SalesListFilterSheet / SalesHome filters and UI"
  echo "Then: git add <files> && git commit && re-run this script."
  git status -sb
  exit 1
fi

cd "$ROOT"
if [ ! -f .env.staging ]; then
  cp .env.staging.example .env.staging
  echo "Created .env.staging from .env.staging.example"
fi

echo "==> iOS staging prep"
npm ci
npm run ios:prep:mac:stage

echo ""
echo "OK — merged origin/main, staging synced."
echo "  Bundle: com.dincouture.erp.stage / ERP Stage"
echo "  Next: npm run cap:ios   # or: npx cap open ios"
grep PRODUCT_BUNDLE_IDENTIFIER ios/App/App.xcodeproj/project.pbxproj | head -2
grep -A1 CFBundleDisplayName ios/App/App/Info.plist | head -3
