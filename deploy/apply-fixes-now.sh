#!/bin/bash
# Apply DB + storage fixes only (no build, no docker up). Run from project root.
# On VPS:  cd /root/NEWPOSV3  &&  bash deploy/apply-fixes-now.sh
# Fixes: Studio storage JWT, expenses columns, storage buckets, storage RLS, RLS performance, enable RLS on public tables, Studio settings API.

cd "$(dirname "$0")/.."
export DEPLOY_ONLY_FIXES=1
exec bash deploy/deploy.sh
