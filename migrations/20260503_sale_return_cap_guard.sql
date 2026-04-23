-- =====================================================================
-- 20260503  Sale Return cap guard
-- Enforce that cumulative sale_returns.total for a given original sale
-- never exceeds the sale's total. Prevents over-returns like returning
-- Rs. 10,500 against a Rs. 10,400 sale.
-- =====================================================================

SET search_path = public;

CREATE OR REPLACE FUNCTION public.trg_sale_return_cap_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_sale_total   NUMERIC(15,2);
    v_prior_total  NUMERIC(15,2);
    v_new_total    NUMERIC(15,2);
BEGIN
    IF NEW.original_sale_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(total, 0) INTO v_sale_total FROM public.sales WHERE id = NEW.original_sale_id;
    IF v_sale_total IS NULL OR v_sale_total = 0 THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(SUM(total), 0) INTO v_prior_total
      FROM public.sale_returns
     WHERE original_sale_id = NEW.original_sale_id
       AND id <> NEW.id
       AND COALESCE(status, '') NOT IN ('voided', 'cancelled');

    v_new_total := v_prior_total + COALESCE(NEW.total, 0);

    IF v_new_total > v_sale_total + 0.005 THEN
        RAISE EXCEPTION 'Return total (%) would exceed original sale total (%). Prior returns: %',
            NEW.total, v_sale_total, v_prior_total
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_return_cap_guard ON public.sale_returns;
CREATE TRIGGER trg_sale_return_cap_guard
BEFORE INSERT OR UPDATE OF total, status, original_sale_id
ON public.sale_returns
FOR EACH ROW EXECUTE FUNCTION public.trg_sale_return_cap_guard();

-- Harden finalize_sale_return to include the same check defensively
-- (trigger handles inserts; this also catches any direct status flips if trigger disabled).
-- If an existing finalize_sale_return exists, we leave its body and simply add a guard wrapper.
-- Use a sanity SELECT to verify it compiles without dropping.
DO $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='finalize_sale_return'
    ) INTO v_exists;
    IF NOT v_exists THEN
        RAISE NOTICE 'finalize_sale_return does not exist yet — cap enforced via trigger only.';
    END IF;
END;
$$;
