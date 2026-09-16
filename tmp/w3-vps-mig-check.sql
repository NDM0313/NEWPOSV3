SELECT p.oid::regprocedure AS sig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'record_fx_currency_purchase_on_credit'
ORDER BY 1;

SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260801%' OR version LIKE '20260811%' OR version LIKE '20260813%'
ORDER BY version;
