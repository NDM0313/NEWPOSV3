#!/bin/bash
# One-shot: apply storage RLS on VPS. No repo files needed; SQL is inline.
# Copy to VPS and run:  bash apply-storage-rls-one-shot.sh
# Or from project:     bash deploy/apply-storage-rls-one-shot.sh

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "No Postgres container (db, supabase-db, postgres). Exit."
  exit 1
fi
echo "Applying storage RLS to $CONTAINER..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
DO $$
BEGIN
  DROP POLICY IF EXISTS "payment_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_update" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_journal_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_journal_select" ON storage.objects;

  CREATE POLICY "payment_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-attachments');

  CREATE POLICY "payment_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-attachments');

  CREATE POLICY "payment_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-attachments')
  WITH CHECK (bucket_id = 'payment-attachments');

  CREATE POLICY "payment_attachments_journal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-attachments'
    AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries')
  );

  CREATE POLICY "payment_attachments_journal_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-attachments'
    AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries')
  );
END $$;
EOSQL
echo "Done. payment-attachments RLS updated."
