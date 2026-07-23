#!/usr/bin/env bash
# Fix company-logos bucket: id must equal name (Supabase Storage API requirement).
# Self-hosted: temporarily disable storage protect triggers to replace mis-keyed bucket row.

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^supabase-db$|^db$' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "Postgres container not found"
  exit 1
fi

echo "[fix-company-logos] Fixing bucket id in $CONTAINER..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
DO $$
DECLARE
  wrong_id text;
  obj_count bigint;
BEGIN
  SELECT id INTO wrong_id
  FROM storage.buckets
  WHERE name = 'company-logos' AND id <> 'company-logos'
  LIMIT 1;

  IF wrong_id IS NULL AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-logos') THEN
    RAISE NOTICE 'company-logos bucket already has correct id';
    RETURN;
  END IF;

  IF wrong_id IS NOT NULL THEN
    SELECT count(*) INTO obj_count FROM storage.objects WHERE bucket_id = wrong_id;
    IF obj_count > 0 THEN
      RAISE EXCEPTION 'company-logos has % object(s) under wrong id % — remove via Storage API first', obj_count, wrong_id;
    END IF;

    ALTER TABLE storage.buckets DISABLE TRIGGER ALL;
    DELETE FROM storage.buckets WHERE id = wrong_id;
    ALTER TABLE storage.buckets ENABLE TRIGGER ALL;
  END IF;

  INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
  SELECT 'company-logos', 'company-logos', false, now(), now()
  WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-logos');
END $$;

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

SELECT id, name, public FROM storage.buckets WHERE name = 'company-logos';
EOSQL

STORAGE=$(docker ps --format '{{.Names}}' | grep -E '^supabase-storage$' | head -1)
if [ -n "$STORAGE" ]; then
  echo "[fix-company-logos] Restarting $STORAGE..."
  docker restart "$STORAGE" >/dev/null
fi

echo "[fix-company-logos] Done."
