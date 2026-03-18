-- Reset passwords for ndm313@live.com and ndm313@yahoo.com (same format as deploy: gen_salt('bf', 10))
-- ndm313@live.com -> 123456
-- ndm313@yahoo.com -> 123456 (same so you can use either account with one password)
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'ndm313@live.com';
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'ndm313@yahoo.com';
