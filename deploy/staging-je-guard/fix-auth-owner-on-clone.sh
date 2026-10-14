#!/usr/bin/env bash
set -euo pipefail
CLONE_DB=ledger_stage_20260919_prodcheck
docker exec -i supabase-db psql -U postgres -d "$CLONE_DB" -v ON_ERROR_STOP=1 <<'SQL'
ALTER SCHEMA auth OWNER TO supabase_auth_admin;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS fq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relkind = 'r'
  LOOP
    EXECUTE 'ALTER TABLE ' || r.fq || ' OWNER TO supabase_auth_admin';
  END LOOP;

  FOR r IN
    SELECT format('%I.%I', n.nspname, c.relname) AS fq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relkind = 'S'
  LOOP
    EXECUTE 'ALTER SEQUENCE ' || r.fq || ' OWNER TO supabase_auth_admin';
  END LOOP;

  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS fq
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth'
  LOOP
    BEGIN
      EXECUTE 'ALTER FUNCTION ' || r.fq || ' OWNER TO supabase_auth_admin';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

SELECT n.nspname, n.nspowner::regrole AS owner
FROM pg_namespace n WHERE n.nspname = 'auth';
SQL
echo "AUTH_OWNER_OK"
