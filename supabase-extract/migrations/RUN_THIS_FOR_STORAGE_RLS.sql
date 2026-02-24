-- =============================================================================
-- FIX: Storage upload blocked by RLS
-- Buckets: payment-attachments, sale-attachments, purchase-attachments
-- =============================================================================
-- Run this entire script in: Supabase Dashboard → SQL Editor → New query → Paste → Run
--
-- BEFORE: Create buckets if they don't exist (Storage → New bucket):
--   payment-attachments, sale-attachments, purchase-attachments
-- (Public or Private both work; RLS below allows authenticated users.)
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

  -- ========== sale-attachments (e.g. sale receipt images) ==========
  DROP POLICY IF EXISTS "sale_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_update" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_delete" ON storage.objects;
  CREATE POLICY "sale_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sale-attachments') WITH CHECK (bucket_id = 'sale-attachments');
  CREATE POLICY "sale_attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sale-attachments');

  -- ========== purchase-attachments ==========
  DROP POLICY IF EXISTS "purchase_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_update" ON storage.objects;
  DROP POLICY IF EXISTS "purchase_attachments_delete" ON storage.objects;
  CREATE POLICY "purchase_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'purchase-attachments') WITH CHECK (bucket_id = 'purchase-attachments');
  CREATE POLICY "purchase_attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'purchase-attachments');
END $$;
