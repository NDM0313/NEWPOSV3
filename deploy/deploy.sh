#!/bin/bash
# One-shot deploy script. Run from project root.
# On VPS:  cd /root/NEWPOSV3  then  bash deploy/deploy.sh
# Auto-fixes: git pull, .env.production, container conflict, storage RLS.

set -e
cd "$(dirname "$0")/.."
# So VPS always runs latest script and fixes
git pull --rebase 2>/dev/null || true

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

source .env.production
COMPOSE_CMD="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
$COMPOSE_CMD build --no-cache
# Avoid "container name already in use": tear down then up (no manual steps on VPS)
$COMPOSE_CMD down 2>/dev/null || true
docker rm -f erp-frontend 2>/dev/null || true
$COMPOSE_CMD up -d

# Auto-apply storage RLS on VPS (no PGPASSWORD needed; uses docker exec into Supabase DB)
apply_rls() {
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
  [ -z "$CONTAINER" ] && return 0
  echo "[deploy] Applying storage RLS to $CONTAINER..."
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
END $$;
EOSQL
  echo "[deploy] Storage RLS applied."
}
if [ -f deploy/apply-storage-rls-vps.sh ]; then
  bash deploy/apply-storage-rls-vps.sh || apply_rls
else
  apply_rls
fi

echo "ERP running. Configure Caddy/Nginx for https://erp.dincouture.pk"
