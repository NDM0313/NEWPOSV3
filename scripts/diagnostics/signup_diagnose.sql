-- One-shot signup diagnosis (run via: docker exec -i supabase-db psql -U postgres -d postgres -f -)

\echo '=== din@yahoo.com in auth.users ==='
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed, created_at
FROM auth.users
WHERE LOWER(email) = 'din@yahoo.com';

\echo '=== Orphan auth users (no public.users link) ==='
SELECT au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_user_id = au.id OR pu.id = au.id
WHERE pu.id IS NULL
ORDER BY au.created_at;

\echo '=== Triggers on auth.users ==='
SELECT tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

\echo '=== create_business_transaction RPC ==='
SELECT routine_name, data_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_business_transaction';

\echo '=== auth.users count ==='
SELECT count(*) AS auth_users_count FROM auth.users;
