SELECT id, email, length(encrypted_password) AS pw_len, email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users WHERE email = 'admin@dincouture.pk';
