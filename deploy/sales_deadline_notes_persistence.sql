-- Run once in Supabase SQL Editor to enable Deadline + Notes persistence for Studio Sales.
-- After this: Sale Form → Save → DB; Studio Sales list and Edit will show the same data.

ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deadline DATE;

COMMENT ON COLUMN sales.notes IS 'Sale notes from form; Studio may store StudioDeadline:YYYY-MM-DD.';
COMMENT ON COLUMN sales.deadline IS 'Delivery/deadline from form; used in Studio Sales list and Pipeline.';

-- RPC fallback: if normal UPDATE is blocked (e.g. RLS), app calls this to set deadline.
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
COMMENT ON FUNCTION public.set_sale_deadline(UUID, DATE) IS 'Sets sales.deadline; used when direct update fails.';
GRANT EXECUTE ON FUNCTION public.set_sale_deadline(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sale_deadline(UUID, DATE) TO service_role;
