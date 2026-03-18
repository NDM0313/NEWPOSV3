-- Verify that '123456' matches the stored hash (crypt(password, stored_hash) = stored_hash)
SELECT email, (encrypted_password = crypt('123456', encrypted_password)) AS password_123456_matches
FROM auth.users WHERE email IN ('ndm313@yahoo.com', 'ndm313@live.com');
