-- ============================================================================
-- Ensure Accounts Receivable (1100) exists + fix payment journal function
-- Run on VPS: fixes "Accounts Receivable account (1100 or 2000) not found"
-- ============================================================================

-- 1) Ensure Accounts Receivable (1100) for every company that has Cash (1000)
--    Use INSERT only (company_id, code, name, type, is_active) for compatibility
INSERT INTO public.accounts (company_id, code, name, type, is_active)
SELECT c.id, '1100', 'Accounts Receivable', 'asset', true
FROM public.companies c
WHERE EXISTS (SELECT 1 FROM public.accounts a WHERE a.company_id = c.id AND a.code = '1000')
  AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.company_id = c.id AND a.code = '1100');

-- 2) Update payment journal function: SECURITY DEFINER so A/R lookup bypasses RLS
CREATE OR REPLACE FUNCTION create_payment_journal_entry(
  p_payment_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_amount NUMERIC,
  p_payment_account_id UUID,
  p_customer_name VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id UUID;
  v_receivable_account_id UUID;
  v_invoice_no VARCHAR;
BEGIN
  -- Run as function owner so RLS does not hide 1100 from non-admin users
  SELECT id INTO v_receivable_account_id
  FROM public.accounts
  WHERE company_id = p_company_id
    AND (is_active IS NULL OR is_active = true)
    AND (
      code = '1100'
      OR (code = '2000' AND (LOWER(name) LIKE '%receivable%' OR name = 'Accounts Receivable'))
    )
  ORDER BY CASE WHEN code = '1100' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_receivable_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (1100 or 2000) not found. Add an account with code 1100 and name "Accounts Receivable" in Chart of Accounts.';
  END IF;

  SELECT invoice_no INTO v_invoice_no FROM public.sales WHERE id = p_sale_id;

  INSERT INTO public.journal_entries (company_id, branch_id, entry_date, description, reference_type, reference_id, payment_id)
  VALUES (p_company_id, p_branch_id, NOW()::DATE, 'Payment received from ' || COALESCE(p_customer_name, 'Customer'), 'sale', p_sale_id, p_payment_id)
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, p_payment_account_id, p_amount, 0, 'Payment received - ' || COALESCE(v_invoice_no, ''));

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES (v_journal_entry_id, v_receivable_account_id, 0, p_amount, 'Payment received - ' || COALESCE(v_invoice_no, ''));

  RETURN v_journal_entry_id;
END;
$$;
