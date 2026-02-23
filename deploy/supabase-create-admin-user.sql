-- Task 2: Create admin user (admin@dincouture.pk). Change password after first login.
-- Run on VPS: docker exec -i supabase-db psql -U postgres -d postgres < deploy/supabase-create-admin-user.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  role,
  aud,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'admin@dincouture.pk',
  crypt('Admin@Dincouture2026!', gen_salt('bf')),
  now(),
  'authenticated',
  'authenticated',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dincouture.pk');
