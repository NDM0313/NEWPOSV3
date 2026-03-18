CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'admin@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('InfoDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'info@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'demo@dincollection.com';
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email IN ('ndm313@yahoo.com', 'ndm313@live.com');
