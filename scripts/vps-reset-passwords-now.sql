-- Reset passwords for quick login (run on VPS: docker exec -i supabase-db psql -U postgres -d postgres -f - < this file, or pipe)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'admin@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'ndm313@yahoo.com';
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'ndm313@live.com';
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'demo@dincollection.com';
