\set ON_ERROR_STOP on
\echo '--- BACKUP JSON ---'
SELECT json_build_object(
  'auth_user', (SELECT row_to_json(t) FROM (SELECT id, email, created_at, email_confirmed_at, confirmed_at, last_sign_in_at FROM auth.users WHERE id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade') t),
  'auth_identities', (SELECT coalesce(json_agg(row_to_json(i)), '[]'::json) FROM (SELECT id, user_id, provider, created_at FROM auth.identities WHERE user_id = 'a5ed7b79-0e25-4a1b-8c48-69113fec6ade') i),
  'company', (SELECT row_to_json(c) FROM (SELECT id, name, email, created_at FROM public.companies WHERE id = '845154ff-7c30-41b5-b69a-f1cd15c163a4') c),
  'users', (SELECT coalesce(json_agg(row_to_json(u)), '[]'::json) FROM (SELECT id, email, full_name, company_id, role, created_at, auth_user_id FROM public.users WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4') u),
  'branches', (SELECT coalesce(json_agg(row_to_json(b)), '[]'::json) FROM (SELECT id, name, code, company_id FROM public.branches WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4') b),
  'bootstrap_counts', json_build_object(
    'accounts', (SELECT count(*) FROM public.accounts WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4'),
    'contacts', (SELECT count(*) FROM public.contacts WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4'),
    'products', (SELECT count(*) FROM public.products WHERE company_id = '845154ff-7c30-41b5-b69a-f1cd15c163a4')
  )
);
