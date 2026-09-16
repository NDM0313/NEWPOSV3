SELECT 'auth_users' AS check, count(*)::text AS n FROM auth.users WHERE email = 'khan5955+1@gmail.com'
UNION ALL SELECT 'company', count(*)::text FROM public.companies WHERE id = '845154ff-7c30-41b5-b69a-f1cd15c163a4'
UNION ALL SELECT 'din_china', count(*)::text FROM public.companies WHERE name = 'DIN CHINA'
UNION ALL SELECT 'din_bridal', count(*)::text FROM public.companies WHERE name = 'DIN BRIDAL'
UNION ALL SELECT 'din_couture', count(*)::text FROM public.companies WHERE name = 'DIN COUTURE';
