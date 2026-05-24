-- Normalize attachment JSONB arrays: full URLs (including localhost dev) → bucket/path refs.

DO $$
DECLARE
  r RECORD;
  elem jsonb;
  url text;
  path text;
  bucket text;
  new_urls jsonb;
  buckets text[] := ARRAY['sale-attachments', 'purchase-attachments', 'payment-attachments'];
  b text;
BEGIN
  FOR r IN
    SELECT 'sales' AS tbl, id, attachments AS raw FROM public.sales WHERE attachments IS NOT NULL
    UNION ALL
    SELECT 'purchases', id, attachments FROM public.purchases WHERE attachments IS NOT NULL
    UNION ALL
    SELECT 'payments', id, attachments FROM public.payments WHERE attachments IS NOT NULL
  LOOP
    IF jsonb_typeof(r.raw) <> 'array' THEN
      CONTINUE;
    END IF;

    new_urls := '[]'::jsonb;
    FOR elem IN SELECT value FROM jsonb_array_elements(r.raw) AS t(value)
    LOOP
      url := trim(both '"' from elem::text);

      IF url ~ '^(sale-attachments|purchase-attachments|payment-attachments)/' AND url !~ '://' THEN
        new_urls := new_urls || elem;
        CONTINUE;
      END IF;

      bucket := NULL;
      path := NULL;
      FOREACH b IN ARRAY buckets
      LOOP
        IF url ~ ('/' || b || '/') THEN
          bucket := b;
          path := regexp_replace(url, '^.*\/' || b || '\/', '');
          path := regexp_replace(path, '\?.*$', '');
          EXIT;
        END IF;
      END LOOP;

      IF bucket IS NOT NULL AND path <> '' THEN
        new_urls := new_urls || jsonb_build_object(
          'url', bucket || '/' || path,
          'name', COALESCE(elem->>'name', 'Attachment')
        );
      ELSE
        new_urls := new_urls || elem;
      END IF;
    END LOOP;

    IF new_urls IS DISTINCT FROM r.raw THEN
      EXECUTE format('UPDATE public.%I SET attachments = $1 WHERE id = $2', r.tbl)
        USING new_urls, r.id;
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.sales.attachments IS
  'Attachment refs: prefer bucket/path (e.g. sale-attachments/companyId/saleId/file.ext); avoid localhost dev URLs.';
