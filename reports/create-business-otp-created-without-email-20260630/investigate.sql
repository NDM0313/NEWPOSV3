\set ON_ERROR_STOP on
\echo '--- AUTH USER ---'
SELECT id, email, created_at, email_confirmed_at, confirmed_at, last_sign_in_at, raw_app_meta_data->>'provider' AS provider
FROM auth.users WHERE email = 'khan5955+1@gmail.com';

\echo '--- AUTH IDENTITIES ---'
SELECT i.id, i.user_id, i.provider, i.created_at
FROM auth.identities i
JOIN auth.users u ON u.id = i.user_id
WHERE u.email = 'khan5955+1@gmail.com';

\echo '--- PUBLIC USERS ---'
SELECT u.id, u.email, u.full_name, u.company_id, u.role, u.created_at, u.auth_user_id
FROM public.users u
WHERE u.email = 'khan5955+1@gmail.com'
   OR u.auth_user_id IN (SELECT id FROM auth.users WHERE email = 'khan5955+1@gmail.com');

\echo '--- COMPANY ---'
SELECT c.id, c.name, c.email, c.created_at
FROM public.companies c
WHERE c.email = 'khan5955+1@gmail.com'
   OR c.name ILIKE '%ERP Master%'
ORDER BY c.created_at DESC
LIMIT 5;

\echo '--- COMPANY BY USER ---'
SELECT c.id, c.name, c.email, c.created_at
FROM public.companies c
JOIN public.users u ON u.company_id = c.id
WHERE u.email = 'khan5955+1@gmail.com';

\echo '--- TX COUNTS ---'
WITH cid AS (
  SELECT DISTINCT company_id AS id FROM public.users WHERE email = 'khan5955+1@gmail.com' AND company_id IS NOT NULL
  UNION
  SELECT id FROM public.companies WHERE email = 'khan5955+1@gmail.com' OR name = 'ERP Master'
)
SELECT 'sales' AS tbl, count(*) FROM public.sales s JOIN cid ON s.company_id = cid.id
UNION ALL SELECT 'purchases', count(*) FROM public.purchases p JOIN cid ON p.company_id = cid.id
UNION ALL SELECT 'payments', count(*) FROM public.payments p JOIN cid ON p.company_id = cid.id
UNION ALL SELECT 'journal_entries', count(*) FROM public.journal_entries j JOIN cid ON j.company_id = cid.id
UNION ALL SELECT 'expenses', count(*) FROM public.expenses e JOIN cid ON e.company_id = cid.id
UNION ALL SELECT 'rentals', count(*) FROM public.rentals r JOIN cid ON r.company_id = cid.id;

\echo '--- BOOTSTRAP COUNTS ---'
WITH cid AS (
  SELECT DISTINCT company_id AS id FROM public.users WHERE email = 'khan5955+1@gmail.com' AND company_id IS NOT NULL
  UNION
  SELECT id FROM public.companies WHERE email = 'khan5955+1@gmail.com' OR name = 'ERP Master'
)
SELECT 'accounts' AS tbl, count(*) FROM public.accounts a JOIN cid ON a.company_id = cid.id
UNION ALL SELECT 'branches', count(*) FROM public.branches b JOIN cid ON b.company_id = cid.id
UNION ALL SELECT 'contacts', count(*) FROM public.contacts ct JOIN cid ON ct.company_id = cid.id
UNION ALL SELECT 'products', count(*) FROM public.products pr JOIN cid ON pr.company_id = cid.id
UNION ALL SELECT 'user_branches', count(*) FROM public.user_branches ub JOIN public.users u ON u.id = ub.user_id WHERE u.email = 'khan5955+1@gmail.com';
