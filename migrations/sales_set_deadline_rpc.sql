-- RPC to set sales.deadline (bypasses RLS column/update issues).
-- Run in Supabase SQL Editor if deadline still does not save from the app.
-- Then the app will call this after creating a sale when deadline is set.

CREATE OR REPLACE FUNCTION public.set_sale_deadline(p_sale_id UUID, p_deadline DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sales SET deadline = p_deadline WHERE id = p_sale_id;
END;
$$;

COMMENT ON FUNCTION public.set_sale_deadline(UUID, DATE) IS 'Sets sales.deadline for a given sale. Used by app when normal update fails (e.g. RLS).';
GRANT EXECUTE ON FUNCTION public.set_sale_deadline(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sale_deadline(UUID, DATE) TO service_role;
