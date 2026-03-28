-- PostgREST / Supabase: allow JWT-authenticated clients to call operational AR/AP summary.
-- get_customer_ledger_sales / get_customer_ledger_payments already have GRANT in migrations;
-- get_contact_balances_summary did not — RPC could 403 while direct SELECT on sales (RLS) still worked,
-- so the mobile app fell back to partial row sums (wrong balances vs web Contacts).

GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(uuid, uuid) TO service_role;
