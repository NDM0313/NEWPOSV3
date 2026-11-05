-- Fix list_rental_1100_leakage_defects: cast varchar columns to text for RETURNS TABLE match.

CREATE OR REPLACE FUNCTION public.list_rental_1100_leakage_defects(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  defect_id TEXT,
  journal_entry_line_id UUID,
  journal_entry_id UUID,
  entry_no TEXT,
  entry_date DATE,
  contact_id UUID,
  customer_name TEXT,
  party_ar_account_id UUID,
  party_ar_account_code TEXT,
  amount NUMERIC,
  direction TEXT,
  reference_type TEXT,
  source_label TEXT,
  fingerprint TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control_id UUID;
BEGIN
  SELECT a.id INTO v_control_id
  FROM public.accounts a
  WHERE a.company_id = p_company_id
    AND trim(COALESCE(a.code, '')) = '1100'
    AND COALESCE(a.is_active, TRUE)
  LIMIT 1;

  IF v_control_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT
      jel.id AS line_id,
      je.id AS je_id,
      je.entry_no AS je_no,
      je.entry_date AS je_date,
      je.reference_type AS je_ref_type,
      jel.debit AS line_debit,
      jel.credit AS line_credit,
      COALESCE(r.customer_id, pay.contact_id) AS cust_id,
      COALESCE(c.name, r.customer_name, pay.contact_name, 'Customer') AS cust_name,
      COALESCE(r.booking_no, pay.reference_number, je.entry_no) AS src_label,
      CASE
        WHEN COALESCE(jel.debit, 0) > 0.001 THEN 'debit_on_control'
        ELSE 'credit_on_control'
      END AS line_direction,
      GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0)) AS line_amt
    FROM public.journal_entry_lines jel
    INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN public.rentals r
      ON je.reference_type = 'rental' AND je.reference_id = r.id
    LEFT JOIN public.payments pay ON je.payment_id = pay.id
    LEFT JOIN public.contacts c ON c.id = COALESCE(r.customer_id, pay.contact_id)
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id = v_control_id
      AND GREATEST(COALESCE(jel.debit, 0), COALESCE(jel.credit, 0)) > 0.001
      AND (
        p_branch_id IS NULL
        OR je.branch_id IS NULL
        OR je.branch_id = p_branch_id
      )
      AND (
        (je.reference_type = 'rental' AND r.customer_id IS NOT NULL)
        OR (
          lower(trim(COALESCE(je.reference_type, ''))) = 'payment'
          AND pay.reference_type = 'rental'
          AND pay.contact_id IS NOT NULL
        )
      )
      AND trim(COALESCE(je.entry_no, '')) NOT IN ('JE-0160', 'JE-0161')
  )
  SELECT
    ('rental-1100-leakage:' || s.line_id::text)::text,
    s.line_id,
    s.je_id,
    s.je_no::text,
    s.je_date,
    s.cust_id,
    s.cust_name::text,
    public._ensure_ar_subaccount_for_contact(p_company_id, s.cust_id),
    (
      SELECT trim(COALESCE(a.code, ''))
      FROM public.accounts a
      WHERE a.id = public._ensure_ar_subaccount_for_contact(p_company_id, s.cust_id)
      LIMIT 1
    )::text,
    round(s.line_amt, 2),
    s.line_direction::text,
    s.je_ref_type::text,
    s.src_label::text,
    ('developer_repair:gl_correction:rental-1100-leakage:' || s.line_id::text)::text
  FROM src s
  WHERE s.cust_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.journal_entries corr
      WHERE corr.company_id = p_company_id
        AND corr.action_fingerprint = 'developer_repair:gl_correction:rental-1100-leakage:' || s.line_id::text
        AND COALESCE(corr.is_void, FALSE) = FALSE
    )
  ORDER BY s.je_date DESC, s.line_amt DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_rental_1100_leakage_defects(UUID, UUID) TO authenticated;
