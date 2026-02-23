SELECT email, aud, role, instance_id
FROM auth.users
WHERE email IN ('ndm313@yahoo.com', 'admin@dincouture.pk')
ORDER BY email;
