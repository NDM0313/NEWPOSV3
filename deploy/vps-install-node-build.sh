#!/bin/bash
# Install Node.js 20 LTS and npm on the VPS, then build the app in the project.
# Use this only if you need to run "npm run build" on the host (e.g. no Docker).
# Run: bash deploy/vps-install-node-build.sh

set -e
cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

# Install Node 20 + npm if not present
if ! command -v node >/dev/null 2>&1; then
  echo "[1/3] Installing Node.js 20 LTS..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  echo "  Node: $(node -v)  npm: $(npm -v)"
else
  echo "[1/3] Node already installed: $(node -v)"
fi

echo "[2/3] Installing dependencies..."
cd "$PROJECT_ROOT"
npm ci 2>/dev/null || npm install

echo "[3/3] Building app..."
npm run build

echo "Done. Build output in: $PROJECT_ROOT/dist"
