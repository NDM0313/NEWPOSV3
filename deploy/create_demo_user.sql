CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Update password if user exists
UPDATE auth.users
SET encrypted_password = crypt('demo123', gen_salt('bf')),
    email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'demo@dincollection.com';
-- Insert if not exists
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'demo@dincollection.com',
  crypt('demo123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@dincollection.com');
