-- GL-only cutover: remove operational contact balance RPC path.
-- Keep party GL RPC as the single source for AR/AP contact balances.

DROP VIEW IF EXISTS public.v_basis_operational_totals_by_type;
DROP VIEW IF EXISTS public.v_basis_contact_operational_summary;
DROP FUNCTION IF EXISTS public.get_contact_balances_summary(UUID, UUID);
