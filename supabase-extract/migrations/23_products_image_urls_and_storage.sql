-- Product images: column on products + storage bucket RLS.
-- 1. Add image_urls to products (array of storage URLs).
-- 2. Create bucket "product-images" in Dashboard (Public optional), then run this.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]';

COMMENT ON COLUMN products.image_urls IS 'Array of image URLs (e.g. from storage bucket product-images).';

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
