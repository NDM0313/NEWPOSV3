-- Backfill products.image_urls: replace localhost/dev full URLs with storage path-only.
-- Path-only entries work on native APK (signed URL) and web (proxy or production host).

DO $$
DECLARE
  r RECORD;
  elem jsonb;
  url text;
  path text;
  new_urls jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_urls'
  ) THEN
    RAISE NOTICE 'products.image_urls column not found; skip backfill.';
    RETURN;
  END IF;

  FOR r IN
    SELECT id, image_urls
    FROM public.products
    WHERE image_urls IS NOT NULL
      AND jsonb_typeof(image_urls) = 'array'
      AND image_urls::text ~* 'localhost|127\.0\.0\.1'
  LOOP
    new_urls := '[]'::jsonb;
    FOR elem IN SELECT value FROM jsonb_array_elements(r.image_urls) AS t(value)
    LOOP
      url := trim(both '"' from elem::text);
      IF url ~* 'localhost|127\.0\.0\.1' AND url ~ '/product-images/' THEN
        path := regexp_replace(url, '^.*\/product-images\/', '');
        path := regexp_replace(path, '\?.*$', '');
        IF path <> '' THEN
          new_urls := new_urls || to_jsonb(path);
          CONTINUE;
        END IF;
      END IF;
      IF elem #>> '{}' ~ '^[^/]+/[^/]+/' THEN
        new_urls := new_urls || elem;
      ELSIF url ~ '/product-images/' THEN
        path := regexp_replace(url, '^.*\/product-images\/', '');
        path := regexp_replace(path, '\?.*$', '');
        IF path <> '' THEN
          new_urls := new_urls || to_jsonb(path);
        ELSE
          new_urls := new_urls || elem;
        END IF;
      ELSE
        new_urls := new_urls || elem;
      END IF;
    END LOOP;

    UPDATE public.products SET image_urls = new_urls WHERE id = r.id;
  END LOOP;
END $$;

COMMENT ON COLUMN public.products.image_urls IS
  'Product image refs: prefer storage path-only (companyId/productId/file.ext) or production URL; avoid localhost dev URLs.';
