-- PostgREST fails when two overloads exist and RPC sends only p_company_id + p_branch_id
-- ("function get_contact_party_gl_balances(uuid, unknown) is not unique").
-- Keep the 3-arg version (p_as_of_date DEFAULT NULL).

DROP VIEW IF EXISTS public.v_basis_party_gl_summary;

DROP FUNCTION IF EXISTS public.get_contact_party_gl_balances(UUID, UUID);

GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) TO service_role;

COMMENT ON FUNCTION public.get_contact_party_gl_balances(UUID, UUID, DATE) IS
  'Per-contact AR/AP/worker GL slices; p_as_of_date optional (NULL = all dates). Single overload for PostgREST.';
