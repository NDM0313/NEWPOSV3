#!/bin/bash
# One-shot deploy script. Run from project root.
# On VPS:  cd /root/NEWPOSV3  then  bash deploy/deploy.sh
# Auto-fixes (run on every deploy): Studio storage JWT, expenses columns, storage buckets, storage RLS, RLS performance, enable RLS on public tables (Security Advisor), Studio settings API.
# DB backup (manual/cron): bash deploy/backup-supabase-db.sh [retention_days] — see deploy/SELF_HOSTED_STUDIO_GAPS.md
# Fixes-only (no build):  DEPLOY_ONLY_FIXES=1 bash deploy/deploy.sh   or   bash deploy/apply-fixes-now.sh

set -e
cd "$(dirname "$0")/.."

# Bootstrap: if full deploy and first run, fetch+reset then re-exec (skip when DEPLOY_ONLY_FIXES)
if [ -z "$RUN_DEPLOY" ] && [ -z "$DEPLOY_ONLY_FIXES" ]; then
  BRANCH="${BRANCH:-$(git branch --show-current 2>/dev/null)}"
  [ -z "$BRANCH" ] && BRANCH=main
  git fetch origin "$BRANCH" 2>/dev/null || true
  git reset --hard "origin/$BRANCH" 2>/dev/null || true
  export RUN_DEPLOY=1
  exec bash deploy/deploy.sh
  exit 0
fi

# --- Define fix functions (used by full deploy and by apply-fixes-now) ---
apply_rls() {
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
  [ -z "$CONTAINER" ] && return 0
  echo "[deploy] Ensuring storage buckets and RLS in $CONTAINER..."

  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'EOSQL' || true
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
    SELECT gen_random_uuid(), 'payment-attachments', false, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'payment-attachments');
    INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
    SELECT gen_random_uuid(), 'expense-receipts', false, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'expense-receipts');
    INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
    SELECT gen_random_uuid(), 'purchase-attachments', false, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'purchase-attachments');
    INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
    SELECT gen_random_uuid(), 'sale-attachments', false, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'sale-attachments');
    INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
    SELECT gen_random_uuid(), 'product-images', false, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'product-images');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
EOSQL

  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
DO $$
BEGIN
  DROP POLICY IF EXISTS "payment_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_update" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_journal_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_journal_select" ON storage.objects;
  CREATE POLICY "payment_attachments_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-attachments');
  CREATE POLICY "payment_attachments_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-attachments');
  CREATE POLICY "payment_attachments_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-attachments') WITH CHECK (bucket_id = 'payment-attachments');
  CREATE POLICY "payment_attachments_journal_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-attachments' AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries'));
  CREATE POLICY "payment_attachments_journal_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-attachments' AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries'));

  DROP POLICY IF EXISTS "expense_receipts_insert" ON storage.objects;
  DROP POLICY IF EXISTS "expense_receipts_select" ON storage.objects;
  DROP POLICY IF EXISTS "expense_receipts_update" ON storage.objects;
  CREATE POLICY "expense_receipts_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'expense-receipts');
  CREATE POLICY "expense_receipts_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'expense-receipts');
  CREATE POLICY "expense_receipts_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'expense-receipts') WITH CHECK (bucket_id = 'expense-receipts');

  DROP POLICY IF EXISTS "purchase_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_update" ON storage.objects;
  CREATE POLICY "purchase_attachments_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'purchase-attachments') WITH CHECK (bucket_id = 'purchase-attachments');
  DROP POLICY IF EXISTS "sale_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_update" ON storage.objects;
  CREATE POLICY "sale_attachments_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sale-attachments') WITH CHECK (bucket_id = 'sale-attachments');

  DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;
  CREATE POLICY "product_images_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
  CREATE POLICY "product_images_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images');
  CREATE POLICY "product_images_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
  CREATE POLICY "product_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
END $$;
EOSQL
  echo "[deploy] Storage buckets + RLS applied."
}

# RLS performance: use (select auth.role()) so not re-evaluated per row (Studio advisory)
apply_rls_performance() {
  if [ -f deploy/apply-rls-performance-vps.sh ]; then
    bash deploy/apply-rls-performance-vps.sh || true
  else
    CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
    [ -z "$CONTAINER" ] && return 0
    echo "[deploy] Applying RLS performance fix (account_transactions) in $CONTAINER..."
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'EOSQL' || true
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_transactions') THEN
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.account_transactions;
    CREATE POLICY "Allow authenticated read access" ON public.account_transactions
      FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
    DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.account_transactions;
    CREATE POLICY "Allow authenticated insert access" ON public.account_transactions
      FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
EOSQL
    echo "[deploy] RLS performance fix applied."
  fi
}

apply_expenses_columns() {
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
  [ -z "$CONTAINER" ] && return 0
  echo "[deploy] Ensuring expenses columns in $CONTAINER..."
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'EOSQL' || true
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'payment_account_id') THEN
    ALTER TABLE public.expenses ADD COLUMN payment_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'receipt_url') THEN
    ALTER TABLE public.expenses ADD COLUMN receipt_url TEXT;
  END IF;
END $$;
EOSQL
  echo "[deploy] Expenses columns done."
}

# Quick-login users: set passwords in auth.users so mobile app Admin/Info/Demo buttons work (auto on every deploy)
apply_quick_login_auth() {
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
  [ -z "$CONTAINER" ] && return 0
  echo "[deploy] Applying quick-login auth (admin/info/demo) in $CONTAINER..."
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'EOSQL' || true
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'admin@dincouture.pk', crypt('AdminDincouture2026', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dincouture.pk');
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'info@dincouture.pk', crypt('InfoDincouture2026', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'info@dincouture.pk');
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'demo@dincollection.com', crypt('demo123', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@dincollection.com');
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'admin@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('InfoDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'info@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'demo@dincollection.com';
EOSQL
  echo "[deploy] Quick-login auth applied."
}

# Fixes-only mode: apply DB/storage fixes and exit (no build, no docker up)
if [ -n "$DEPLOY_ONLY_FIXES" ]; then
  [ -f deploy/fix-supabase-storage-jwt.sh ] && bash deploy/fix-supabase-storage-jwt.sh || true
  [ -f /root/supabase/docker/.env ] && bash deploy/write-erp-env-from-supabase-docker-env.sh || true
  [ -f deploy/apply-studio-no-auto-assign.sh ] && bash deploy/apply-studio-no-auto-assign.sh || true
  apply_expenses_columns
  [ -f deploy/apply-storage-rls-vps.sh ] && bash deploy/apply-storage-rls-vps.sh || apply_rls
  apply_rls_performance
  apply_quick_login_auth
  [ -f deploy/apply-enable-rls-public.sh ] && bash deploy/apply-enable-rls-public.sh || true
  [ -f deploy/fix-supabase-studio-settings-api.sh ] && bash deploy/fix-supabase-studio-settings-api.sh || true
  [ -f deploy/add-kong-backup-route.sh ] && bash deploy/add-kong-backup-route.sh || true
  echo "[deploy] Fixes applied. Run deploy/deploy.sh for full build+up."
  exit 0
fi

# --- Storage JWT fix (Studio "Failed to retrieve buckets") before .env so Kong gets new keys ---
[ -f deploy/fix-supabase-storage-jwt.sh ] && bash deploy/fix-supabase-storage-jwt.sh || true

# --- ERP Vite env: canonical ANON from /root/supabase/docker/.env (see docs/infra/AUTH_PRODUCTION_LOCKED.md) ---
# Order: GoTrue/Kong URLs + redirects → Kong CORS → write .env.production (never read anon from running Kong — avoids race/drift).
[ -f deploy/fix-supabase-kong-domain.sh ] && bash deploy/fix-supabase-kong-domain.sh || true
[ -f deploy/add-kong-cors-erp-origin.sh ] && bash deploy/add-kong-cors-erp-origin.sh || true
bash deploy/write-erp-env-from-supabase-docker-env.sh || exit 1
set -a
. ./.env.production
set +a
echo "[deploy] Using VITE_SUPABASE_URL=$VITE_SUPABASE_URL (anon key length: ${#VITE_SUPABASE_ANON_KEY})"
# Ensure mobile source has latest login UI (4 buttons, "auto-fills"); fail so user runs git pull
if ! grep -q "auto-fills and signs in" erp-mobile-app/src/components/LoginScreen.tsx 2>/dev/null; then
  echo "[deploy] ERROR: LoginScreen.tsx is old (no 'auto-fills and signs in'). Run: git pull origin main && bash deploy/deploy.sh"
  exit 1
fi
# Fresh CACHEBUST so Docker never uses cached mobile build (always get latest login UI on /m/)
CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production > .env.production.tmp 2>/dev/null || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
mv .env.production.tmp .env.production
set -a
. ./.env.production
set +a
if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "[deploy] ERROR: VITE_SUPABASE_ANON_KEY is empty after write-erp-env. Ensure /root/supabase/docker/.env has ANON_KEY= or SUPABASE_ANON_KEY=, run deploy/fix-supabase-storage-jwt.sh, then re-run deploy."
  exit 1
fi
# Non-interactive SSH often has no node in PATH; match fix-supabase-storage-jwt.sh pattern.
run_project_node() {
  if command -v node >/dev/null 2>&1; then
    node "$@"
  else
    echo "[deploy] node not in PATH; using Docker node:20-alpine for: $*"
    docker run --rm -v "$(pwd):/w" -w /w node:20-alpine node "$@"
  fi
}
run_project_node scripts/verify-mobile-build-env.mjs .env.production || exit 1
run_project_node scripts/sync-mobile-env.js || true
COMPOSE_CMD="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
# Build only ERP (avoids studio-injector pull of python:3.11-alpine which can TLS timeout on VPS)
echo "[deploy] Building ERP (CACHEBUST=$CACHEBUST) - fresh mobile /m/ build..."
$COMPOSE_CMD build --no-cache erp
# Fixed container_name= — kill/remove containers, tear down project, drop default network if orphaned, then up erp.
docker kill erp-frontend erp-backup-page erp-studio-injector 2>/dev/null || true
docker rm -f erp-frontend erp-backup-page erp-studio-injector 2>/dev/null || true
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
docker network rm deploy_default 2>/dev/null || true
sleep 2
$COMPOSE_CMD up -d --force-recreate erp

# Auto-apply migrations (accounts.subtype, journal_entries columns, etc.)
[ -f deploy/run-migrations-vps.sh ] && bash deploy/run-migrations-vps.sh || true

# Deploy Edge Functions (create-erp-user, user-admin-actions)
[ -f deploy/deploy-edge-functions-vps.sh ] && bash deploy/deploy-edge-functions-vps.sh || true

# Studio: Assign/Receive workflow RPCs + no-auto-assign guard (run as supabase_admin)
[ -f deploy/apply-studio-no-auto-assign.sh ] && bash deploy/apply-studio-no-auto-assign.sh || true

# Auto-apply expenses columns + storage buckets + RLS + RLS performance + Studio API fix + quick-login auth
apply_expenses_columns
if [ -f deploy/apply-storage-rls-vps.sh ]; then
  bash deploy/apply-storage-rls-vps.sh || apply_rls
else
  apply_rls
fi
apply_rls_performance
apply_quick_login_auth
[ -f deploy/apply-enable-rls-public.sh ] && bash deploy/apply-enable-rls-public.sh || true
[ -f deploy/fix-supabase-studio-settings-api.sh ] && bash deploy/fix-supabase-studio-settings-api.sh || true

# Supabase /backup route: https://supabase.dincouture.pk/backup serves backup page (erp-backup-page)
[ -d deploy/backup-page ] && chmod -R 755 deploy/backup-page || true
$COMPOSE_CMD up -d backup-page 2>/dev/null || true
[ -f deploy/add-kong-backup-route.sh ] && bash deploy/add-kong-backup-route.sh || true

# Studio sidebar: inject "Backups" under Platform (Kong -> studio-injector -> Studio). Skip build if Docker Hub timeout.
$COMPOSE_CMD up -d studio-injector 2>/dev/null || true
[ -f deploy/point-kong-dashboard-to-injector.sh ] && bash deploy/point-kong-dashboard-to-injector.sh || true

# studio.dincouture.pk: Traefik must be on supabase_default to reach supabase-studio:3000 (avoid 502)
[ -f deploy/ensure-studio-traefik-network.sh ] && bash deploy/ensure-studio-traefik-network.sh || true

echo "ERP running. Configure Caddy/Nginx for https://erp.dincouture.pk"
echo "Backup: https://supabase.dincouture.pk/backup (and under Studio Platform after injector)"
