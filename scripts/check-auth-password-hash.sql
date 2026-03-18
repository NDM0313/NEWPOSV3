SELECT email, left(encrypted_password, 30) AS hash_prefix, length(encrypted_password) AS len
FROM auth.users WHERE email IN ('ndm313@yahoo.com', 'ndm313@live.com');
