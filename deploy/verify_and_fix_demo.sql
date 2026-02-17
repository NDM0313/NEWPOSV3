-- Fix demo user password (bcrypt cost 10 to match GoTrue)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users
SET
  encrypted_password = crypt('demo123', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'demo@dincollection.com';
