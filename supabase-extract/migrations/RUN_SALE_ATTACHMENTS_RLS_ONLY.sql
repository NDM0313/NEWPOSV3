-- =============================================================================
-- FIX: Sale attachment upload "new row violates row-level security policy"
-- Run this in: Supabase Dashboard → SQL Editor (same project as your app)
-- =============================================================================
-- 1. Create bucket if missing: Storage → New bucket → name: sale-attachments
-- 2. Paste this script → Run
-- =============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "sale_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_update" ON storage.objects;
  DROP POLICY IF EXISTS "sale_attachments_delete" ON storage.objects;

  CREATE POLICY "sale_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sale-attachments');

  CREATE POLICY "sale_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sale-attachments');

  CREATE POLICY "sale_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sale-attachments')
  WITH CHECK (bucket_id = 'sale-attachments');

  CREATE POLICY "sale_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sale-attachments');
END $$;
