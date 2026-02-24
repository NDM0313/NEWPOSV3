-- =============================================================================
-- FIX: Product image upload "new row violates row-level security policy"
-- =============================================================================
-- Run this in: Supabase Dashboard → SQL Editor (for the project your app uses,
-- e.g. supabase.dincouture.pk → Project Settings → Dashboard → SQL Editor).
--
-- 1. Create bucket if missing: Storage → New bucket → name: product-images
-- 2. Paste this entire script → Run
-- =============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
  DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;

  CREATE POLICY "product_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

  CREATE POLICY "product_images_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

  CREATE POLICY "product_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

  CREATE POLICY "product_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');
END $$;
