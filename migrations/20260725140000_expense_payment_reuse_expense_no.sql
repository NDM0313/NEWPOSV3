-- Expense payment voucher: reuse expenses.expense_no (no second EXP/PAY burn when document exists).
-- Safe historical backfill where payments.reference_number unique allows.

CREATE OR REPLACE FUNCTION public._ensure_expense_payment_row(
  p_expense_id UUID,
  p_journal_entry_id UUID,
  p_payment_account_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense        expenses%ROWTYPE;
  v_payment_id     UUID;
  v_ref_no         TEXT;
  v_doc_ref        TEXT;
  v_try            INT := 0;
  v_method         payment_method_enum;
  v_code           TEXT;
  v_type           TEXT;
  v_name           TEXT;
BEGIN
  IF p_expense_id IS NULL OR p_journal_entry_id IS NULL OR p_payment_account_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
  IF v_expense.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id INTO v_payment_id
  FROM payments p
  WHERE p.company_id = v_expense.company_id
    AND p.reference_type = 'expense'
    AND p.reference_id = p_expense_id
    AND p.voided_at IS NULL
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_payment_id IS NULL THEN
    SELECT a.code, a.type, a.name
    INTO v_code, v_type, v_name
    FROM accounts a
    WHERE a.id = p_payment_account_id;

    v_method := public._map_account_to_payment_method_enum(v_code, v_type, v_name);
    v_doc_ref := NULLIF(TRIM(COALESCE(v_expense.expense_no, '')), '');

    LOOP
      v_try := v_try + 1;
      IF v_try > 50 THEN
        EXIT;
      END IF;

      IF v_try = 1 AND v_doc_ref IS NOT NULL THEN
        -- Canonical: same EXP-* as the expense document (COA + Expenses parity).
        v_ref_no := v_doc_ref;
      ELSE
        BEGIN
          v_ref_no := public.generate_document_number(
            v_expense.company_id,
            COALESCE(v_expense.branch_id, public.erp_numbering_global_branch_sentinel()),
            'payment',
            false
          );
        EXCEPTION WHEN OTHERS THEN
          v_ref_no := 'PAY-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || floor(random() * 1000)::TEXT;
        END;
      END IF;

      BEGIN
        INSERT INTO payments (
          company_id,
          branch_id,
          payment_type,
          reference_type,
          reference_id,
          amount,
          payment_method,
          payment_date,
          payment_account_id,
          reference_number,
          notes,
          created_by,
          received_by
        )
        VALUES (
          v_expense.company_id,
          v_expense.branch_id,
          'paid',
          'expense',
          p_expense_id,
          COALESCE(v_expense.amount, 0),
          v_method,
          COALESCE(v_expense.expense_date, CURRENT_DATE),
          p_payment_account_id,
          v_ref_no,
          COALESCE(v_expense.description, 'Expense payment'),
          v_expense.created_by,
          v_expense.created_by
        )
        RETURNING id INTO v_payment_id;
        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          -- expense_no already used on another payment → fall back to payment sequence on next try
          CONTINUE;
      END;
    END LOOP;
  END IF;

  IF v_payment_id IS NOT NULL THEN
    UPDATE journal_entries
    SET payment_id = v_payment_id
    WHERE id = p_journal_entry_id
      AND (payment_id IS NULL OR payment_id = v_payment_id);
  END IF;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION public._ensure_expense_payment_row(UUID, UUID, UUID) IS
  'Idempotent: ensure expense has a non-void payments row using expenses.expense_no when available; link journal_entries.payment_id.';

-- Historical: align payment voucher to expense_no where unique allows.
UPDATE payments p
SET reference_number = e.expense_no
FROM expenses e
WHERE p.reference_type = 'expense'
  AND p.reference_id = e.id
  AND p.voided_at IS NULL
  AND NULLIF(TRIM(COALESCE(e.expense_no, '')), '') IS NOT NULL
  AND p.reference_number IS DISTINCT FROM e.expense_no
  AND NOT EXISTS (
    SELECT 1
    FROM payments p2
    WHERE p2.company_id = p.company_id
      AND p2.reference_number = e.expense_no
      AND p2.id <> p.id
  );
