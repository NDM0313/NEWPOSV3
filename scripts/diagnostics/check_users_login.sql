-- Diagnostic: check auth.users vs public.users matching for login
SELECT 'auth.users' AS src, id::text, email, created_at
FROM auth.users
WHERE email IN ('ndm313@yahoo.com','info@dincouture.pk','admin@dincouture.pk','demo@dincollection.com')
ORDER BY email;

SELECT 'public.users' AS src, id::text, email, auth_user_id::text, company_id::text, role
FROM public.users
WHERE email IN ('ndm313@yahoo.com','info@dincouture.pk','admin@dincouture.pk','demo@dincollection.com')
ORDER BY email;

-- RLS policy check on public.users
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='users';
