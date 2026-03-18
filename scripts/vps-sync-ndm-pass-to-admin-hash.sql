-- Set ndm313 users' password to same as admin (AdminDincouture2026) so hash format matches what GoTrue accepts
UPDATE auth.users
SET encrypted_password = (SELECT encrypted_password FROM auth.users WHERE email = 'admin@dincouture.pk' LIMIT 1)
WHERE email IN ('ndm313@yahoo.com', 'ndm313@live.com');
