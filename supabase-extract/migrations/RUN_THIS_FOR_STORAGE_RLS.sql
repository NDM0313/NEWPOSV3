-- =============================================================================
-- FIX: Storage upload blocked by RLS (payment-attachments + journal-entries)
-- =============================================================================
-- Run this entire script in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- BEFORE: Create the bucket if it doesn't exist:
--   Supabase Dashboard → Storage → New bucket → Name: payment-attachments
--   (Public or Private both work; RLS below allows authenticated users.)
-- =============================================================================

DO $$
BEGIN
  -- Drop existing policies (from migration 20 and 49)
  DROP POLICY IF EXISTS "payment_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_update" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_journal_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_journal_select" ON storage.objects;

  -- 1) INSERT: any authenticated user can upload to payment-attachments (any path)
  CREATE POLICY "payment_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-attachments');

  -- 2) SELECT: any authenticated user can read from payment-attachments
  CREATE POLICY "payment_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-attachments');

  -- 3) UPDATE: for updating metadata if needed
  CREATE POLICY "payment_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-attachments')
  WITH CHECK (bucket_id = 'payment-attachments');

  -- 4) Extra INSERT for journal-entries path (backup; main insert above already allows all paths)
  CREATE POLICY "payment_attachments_journal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-attachments'
    AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries')
  );

  -- 5) Extra SELECT for journal-entries path
  CREATE POLICY "payment_attachments_journal_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-attachments'
    AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries')
  );
END $$;
