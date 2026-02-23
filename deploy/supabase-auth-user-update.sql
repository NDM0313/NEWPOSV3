-- Task 1: Change password and confirm email for ndm313@yahoo.com
-- Run: docker exec -i supabase-db psql -U postgres -d postgres -f - < deploy/supabase-auth-user-update.sql
-- Or on VPS: cat deploy/supabase-auth-user-update.sql | docker exec -i supabase-db psql -U postgres -d postgres

-- Ensure pgcrypto is available (Supabase auth usually has it)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update password (bcrypt)
UPDATE auth.users
SET encrypted_password = crypt('iPhone@14max', gen_salt('bf'))
WHERE email = 'ndm313@yahoo.com';

-- Ensure email is confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'ndm313@yahoo.com';

-- Show result
SELECT id, email, email_confirmed_at IS NOT NULL AS email_confirmed, created_at
FROM auth.users
WHERE email = 'ndm313@yahoo.com';
