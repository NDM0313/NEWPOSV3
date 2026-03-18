-- Reset password for ndm313@live.com to: 123456
-- Run: Get-Content scripts\vps-reset-password-ndm313.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
UPDATE auth.users
SET encrypted_password = crypt('123456', gen_salt('bf'))
WHERE email = 'ndm313@live.com';
