-- Fix "Invalid email or password" (400). Run on VPS: bash deploy/run-fix-login-auth.sh
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'admin@dincouture.pk', crypt('AdminDincouture2026', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dincouture.pk');
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'info@dincouture.pk', crypt('InfoDincouture2026', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'info@dincouture.pk');
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'demo@dincollection.com', crypt('demo123', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@dincollection.com');
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'admin@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('InfoDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'info@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'demo@dincollection.com';
SELECT email, email_confirmed_at IS NOT NULL AS ok FROM auth.users WHERE email IN ('admin@dincouture.pk', 'info@dincouture.pk', 'demo@dincollection.com');
