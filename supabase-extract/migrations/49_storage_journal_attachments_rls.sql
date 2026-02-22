-- Allow journal entry attachments in payment-attachments bucket (path: journal-entries/...).
-- Fixes: "new row violates row-level security policy" when uploading from Manual Journal Entry.
-- Run this on your Supabase instance (e.g. SQL Editor or migration runner).
-- Ensure migration 20 (payment-attachments bucket + policies) is run first.

DO $$
BEGIN
  -- Ensure generic INSERT for payment-attachments exists (allows any path in bucket)
  DROP POLICY IF EXISTS "payment_attachments_insert" ON storage.objects;
  CREATE POLICY "payment_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-attachments');

  DROP POLICY IF EXISTS "payment_attachments_select" ON storage.objects;
  CREATE POLICY "payment_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-attachments');

  -- Extra policy for journal-entries path (in case above are missing)
  DROP POLICY IF EXISTS "payment_attachments_journal_insert" ON storage.objects;
  CREATE POLICY "payment_attachments_journal_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-attachments'
    AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries')
  );

  DROP POLICY IF EXISTS "payment_attachments_journal_select" ON storage.objects;
  CREATE POLICY "payment_attachments_journal_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-attachments'
    AND (name LIKE 'journal-entries/%' OR (storage.foldername(name))[1] = 'journal-entries')
  );
END $$;
