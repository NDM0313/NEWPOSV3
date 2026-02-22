-- Storage RLS for payment-attachments bucket (journal entry + payment uploads).
-- Idempotent: DROP IF EXISTS then CREATE. Runs with npm run migrate.

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
