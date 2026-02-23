#!/bin/bash
# One-shot deploy script. Run from project root.
# On VPS:  cd /root/NEWPOSV3  then  bash deploy/deploy.sh
# Auto-fixes (run on every deploy): expenses columns, storage buckets, storage RLS.
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
END $$;
EOSQL
  echo "[deploy] Storage buckets + RLS applied."
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

# Fixes-only mode: apply DB/storage fixes and exit (no build, no docker up)
if [ -n "$DEPLOY_ONLY_FIXES" ]; then
  apply_expenses_columns
  [ -f deploy/apply-storage-rls-vps.sh ] && bash deploy/apply-storage-rls-vps.sh || apply_rls
  echo "[deploy] Fixes applied. Run deploy/deploy.sh for full build+up."
  exit 0
fi

# --- Auto-fix .env.production (VPS: use Supabase API URL + Kong anon key) ---
SUPABASE_API_URL="https://supabase.dincouture.pk"
ANON_KEY=""
[ -f .env.production ] && source .env.production 2>/dev/null || true
# Correct URL: app must call Supabase API (Kong), not the ERP app URL
if [ -z "$VITE_SUPABASE_URL" ] || [ "$VITE_SUPABASE_URL" = "https://erp.dincouture.pk" ] || [ "$VITE_SUPABASE_URL" = "https://your-supabase-api-url" ]; then
  VITE_SUPABASE_URL="$SUPABASE_API_URL"
fi
# Get anon key from Kong (same VPS) or Supabase docker .env
if docker ps --format '{{.Names}}' | grep -q 'supabase-kong'; then
  ANON_KEY=$(docker exec supabase-kong sh -c 'echo "$SUPABASE_ANON_KEY"' 2>/dev/null | tr -d '\n\r')
fi
[ -z "$ANON_KEY" ] && [ -f /root/supabase/docker/.env ] && \
  ANON_KEY=$(grep -E '^ANON_KEY=|^SUPABASE_ANON_KEY=' /root/supabase/docker/.env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\n\r" ')
[ -n "$ANON_KEY" ] && VITE_SUPABASE_ANON_KEY="$ANON_KEY"
[ -z "$VITE_DISABLE_REALTIME" ] && VITE_DISABLE_REALTIME=true
# Write .env.production (keep existing anon key if we didn't find one from Kong/Supabase)
{
  echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
  echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-}"
  echo "VITE_DISABLE_REALTIME=${VITE_DISABLE_REALTIME:-true}"
} > .env.production
[ -z "$VITE_SUPABASE_ANON_KEY" ] && echo "WARN: VITE_SUPABASE_ANON_KEY empty. Set it in .env.production or ensure Kong is running."
echo "[deploy] Using VITE_SUPABASE_URL=$VITE_SUPABASE_URL"

# Kong fix BEFORE build so app image gets correct anon key (avoids "Invalid authentication credentials")
[ -f deploy/fix-supabase-kong-domain.sh ] && bash deploy/fix-supabase-kong-domain.sh || true
source .env.production
COMPOSE_CMD="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
$COMPOSE_CMD build --no-cache
# Avoid "container name already in use": tear down then up (no manual steps on VPS)
$COMPOSE_CMD down 2>/dev/null || true
docker rm -f erp-frontend 2>/dev/null || true
$COMPOSE_CMD up -d

# Auto-apply expenses columns + storage buckets + RLS (same as apply-fixes-now)
apply_expenses_columns
if [ -f deploy/apply-storage-rls-vps.sh ]; then
  bash deploy/apply-storage-rls-vps.sh || apply_rls
else
  apply_rls
fi

# Fix supabase.dincouture.pk: Kong host + anon key (API_EXTERNAL_URL, sync key, restart Kong)
[ -f deploy/fix-supabase-kong-domain.sh ] && bash deploy/fix-supabase-kong-domain.sh || true

echo "ERP running. Configure Caddy/Nginx for https://erp.dincouture.pk"
