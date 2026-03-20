-- ============================================================================
-- Extra expense on SALES: stop broken duplicate journal entries
-- ============================================================================
-- Problem:
--   Main sale create already posts Dr AR (unpaid) + Cr Sales Revenue for full
--   invoice total (includes stitching / extra line charges).
--   create_extra_expense_journal_entry() added a second voucher (EXP-*) that
--   either double-counted AR/revenue or posted two debits (Dr Expense + Dr AR)
--   with no credit → imbalanced ledger.
-- Fix:
--   1) RPC becomes a no-op (returns NULL). App no longer calls it on sale create.
--   2) Sale edits: use saleAccountingService postSaleEditAdjustments (Dr AR / Cr Revenue).
-- Apply: Supabase SQL Editor or `supabase db push` after adding to migration chain.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_extra_expense_journal_entry(
  p_sale_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_expense_amount NUMERIC,
  p_expense_name VARCHAR,
  p_invoice_no VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invoice extra charges are fully reflected in the main sale journal entry
  -- (reference_type = 'sale', same p_sale_id). Separate EXP-* entries caused
  -- double posting and trial balance errors.
  IF p_expense_amount IS NOT NULL AND p_expense_amount > 0 THEN
    RAISE NOTICE 'create_extra_expense_journal_entry skipped: extra charges on invoice are in main sale JE (sale %, % %)',
      p_sale_id, p_expense_amount, COALESCE(p_invoice_no, '');
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION create_extra_expense_journal_entry(UUID, UUID, UUID, NUMERIC, VARCHAR, VARCHAR) IS
  'Deprecated no-op: extra invoice charges are booked only via main sale journal (AR vs Sales Revenue).';
