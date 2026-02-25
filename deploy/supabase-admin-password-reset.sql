-- Reset password and confirm for admin@dincouture.pk (match ndm313 pattern)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users
SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_sent_at = COALESCE(confirmation_sent_at, now())
WHERE email = 'admin@dincouture.pk';
SELECT email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE email = 'admin@dincouture.pk';
