-- Payment attachments storage: RLS policies for bucket "payment-attachments".
--
-- SETUP (do once):
--   1. Supabase Dashboard → Storage → New bucket → name: payment-attachments (private is fine).
--   2. Run this migration (e.g. Supabase SQL Editor or your migration runner).
--
DO $$
BEGIN
  DROP POLICY IF EXISTS "payment_attachments_insert" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_select" ON storage.objects;
  DROP POLICY IF EXISTS "payment_attachments_update" ON storage.objects;

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
END $$;
