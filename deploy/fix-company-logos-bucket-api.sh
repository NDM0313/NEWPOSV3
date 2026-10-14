#!/usr/bin/env bash
KEY=$(docker exec supabase-storage printenv SERVICE_KEY)
BASE="http://127.0.0.1:8000/storage/v1/bucket"
WRONG_ID="1feb7798-91aa-4552-beff-4d17b983d1f5"

echo "Deleting mis-keyed bucket (if empty)..."
curl -sS -w "\nHTTP %{http_code}\n" -X DELETE "${BASE}/${WRONG_ID}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "apikey: ${KEY}"

echo "Creating company-logos bucket..."
curl -sS -w "\nHTTP %{http_code}\n" -X POST "${BASE}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "apikey: ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"id":"company-logos","name":"company-logos","public":false}'

echo "Verify:"
docker exec supabase-db psql -U postgres -d postgres -At -c "SELECT id, name FROM storage.buckets WHERE name = 'company-logos';"

docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
DO $$
BEGIN
  DROP POLICY IF EXISTS "company_logos_insert" ON storage.objects;
  DROP POLICY IF EXISTS "company_logos_select" ON storage.objects;
  DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
  DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;
  CREATE POLICY "company_logos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-logos');
  CREATE POLICY "company_logos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company-logos');
  CREATE POLICY "company_logos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-logos') WITH CHECK (bucket_id = 'company-logos');
  CREATE POLICY "company_logos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-logos');
END $$;
EOSQL

docker restart supabase-storage >/dev/null
echo "Done."
