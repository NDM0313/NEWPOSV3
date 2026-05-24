-- Normalize products.image_urls: convert any full product-images URL to path-only (not only localhost).

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
      AND image_urls::text ~ '/product-images/'
  LOOP
    new_urls := '[]'::jsonb;
    FOR elem IN SELECT value FROM jsonb_array_elements(r.image_urls) AS t(value)
    LOOP
      url := trim(both '"' from elem::text);

      IF url ~ '^[^/]+/[^/]+/' AND url !~ '://' THEN
        new_urls := new_urls || elem;
        CONTINUE;
      END IF;

      IF url ~ '/product-images/' THEN
        path := regexp_replace(url, '^.*\/product-images\/', '');
        path := regexp_replace(path, '\?.*$', '');
        IF path <> '' THEN
          new_urls := new_urls || to_jsonb(path);
          CONTINUE;
        END IF;
      END IF;

      new_urls := new_urls || elem;
    END LOOP;

    IF new_urls IS DISTINCT FROM r.image_urls THEN
      UPDATE public.products SET image_urls = new_urls WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
