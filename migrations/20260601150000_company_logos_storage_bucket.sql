-- Company-logos storage bucket + RLS (idempotent). Safe to re-run.
-- Fixes web Settings → Company logo: "Bucket 'company-logos' not found".

INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
SELECT gen_random_uuid(), 'company-logos', false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'company-logos');

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
