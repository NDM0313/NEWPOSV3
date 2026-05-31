-- Company-logos bucket storage RLS (idempotent). Safe to re-run.
-- Create bucket "company-logos" in Supabase Dashboard → Storage (private recommended).

DO $$
BEGIN
  DROP POLICY IF EXISTS "company_logos_insert" ON storage.objects;
  DROP POLICY IF EXISTS "company_logos_select" ON storage.objects;
  DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
  DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;

  CREATE POLICY "company_logos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

  CREATE POLICY "company_logos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos');

  CREATE POLICY "company_logos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');

  CREATE POLICY "company_logos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos');
END $$;
