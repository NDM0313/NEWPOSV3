SELECT u.email, pu.company_id, c.name, pu.role
FROM auth.users u
JOIN public.users pu ON pu.auth_user_id = u.id
JOIN public.companies c ON c.id = pu.company_id
WHERE u.email ILIKE 'ndm313%';
