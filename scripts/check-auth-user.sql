-- Check if user exists in auth.users (run on VPS: docker exec -i supabase-db psql -U postgres -d postgres -t)
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed, created_at
FROM auth.users
WHERE email = 'ndm313@live.com';
