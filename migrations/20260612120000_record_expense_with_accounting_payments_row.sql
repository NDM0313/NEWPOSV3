-- Expense posting: create payments row + link payment_id on JE (Roznamcha parity).
-- Backfill orphan expense JEs that touch liquidity accounts but have no payment_id.

CREATE OR REPLACE FUNCTION public._map_account_to_payment_method_enum(
  p_code TEXT,
  p_type TEXT,
  p_name TEXT
)
RETURNS payment_method_enum
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_code TEXT := LOWER(TRIM(COALESCE(p_code, '')));
  v_type TEXT := LOWER(TRIM(COALESCE(p_type, '')));
  v_name TEXT := LOWER(TRIM(COALESCE(p_name, '')));
BEGIN
  IF v_code = '1010' OR v_type = 'bank' OR v_name LIKE '%bank%' THEN
    RETURN 'bank'::payment_method_enum;
  END IF;
  IF v_code = '1020'
     OR v_code LIKE '102%'
     OR v_type IN ('wallet', 'mobile_wallet', 'other')
     OR v_name ~ '(wallet|jazz|easypaisa|easy.?paisa|ndm|mobicash|finja|upaisa|sadapay|nayapay)' THEN
    RETURN 'other'::payment_method_enum;
  END IF;
  RETURN 'cash'::payment_method_enum;
END;
$$;

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

    LOOP
      v_try := v_try + 1;
      IF v_try > 50 THEN
        EXIT;
      END IF;
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
  'Idempotent: ensure expense has a non-void payments row for Roznamcha and link journal_entries.payment_id.';

-- Patch record_expense_with_accounting: call helper before success returns.
CREATE OR REPLACE FUNCTION public.record_expense_with_accounting(p_expense_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense              expenses%ROWTYPE;
  v_company_id           UUID;
  v_branch_id            UUID;
  v_category_lc          TEXT;
  v_expense_code         VARCHAR(50);
  v_expense_name         VARCHAR(255);
  v_expense_account_id   UUID;
  v_payment_account_id   UUID;
  v_cash_account_id      UUID;
  v_bank_account_id      UUID;
  v_journal_entry_id     UUID;
  v_existing_je_id       UUID;
  v_amount               NUMERIC(15,2);
  v_extra_service_id     UUID;
  v_open_bal             NUMERIC(15,2);
  v_sale_id              UUID;
  v_sale_charge_id       UUID;
  v_tailor_id            UUID;
  v_expense_category_id  UUID;
  v_tailor_name          TEXT;
  v_invoice_no           TEXT;
  v_is_clearing          BOOLEAN;
  v_payment_id           UUID;
BEGIN
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
  IF v_expense.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Expense not found');
  END IF;

  v_company_id := v_expense.company_id;
  v_branch_id  := v_expense.branch_id;
  v_amount     := COALESCE(v_expense.amount, 0);
  v_category_lc := LOWER(COALESCE(v_expense.category::TEXT, ''));

  IF v_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Expense amount must be greater than 0');
  END IF;

  v_sale_id := v_expense.sale_id;
  v_sale_charge_id := v_expense.sale_charge_id;
  v_tailor_id := v_expense.tailor_contact_id;
  v_expense_category_id := v_expense.expense_category_id;

  v_is_clearing := (
    v_sale_charge_id IS NOT NULL
    AND v_category_lc IN ('stitching', 'dying', 'dyeing', 'lining')
  );

  SELECT id INTO v_existing_je_id
  FROM journal_entries
  WHERE company_id = v_company_id
    AND reference_type = 'expense'
    AND reference_id = p_expense_id
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_je_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE id = v_existing_je_id AND description LIKE 'Expense #%'
    ) THEN
      BEGIN
        UPDATE journal_entries
        SET is_void = true,
            void_reason = 'Re-posted via record_expense_with_accounting'
        WHERE id = v_existing_je_id;
      EXCEPTION WHEN undefined_column THEN
        DELETE FROM journal_entry_lines WHERE journal_entry_id = v_existing_je_id;
        DELETE FROM journal_entries WHERE id = v_existing_je_id;
      END;
    ELSE
      v_payment_id := public._ensure_expense_payment_row(
        p_expense_id,
        v_existing_je_id,
        COALESCE(
          (SELECT l.account_id
           FROM journal_entry_lines l
           WHERE l.journal_entry_id = v_existing_je_id AND l.credit > 0
           ORDER BY l.credit DESC
           LIMIT 1),
          v_expense.payment_account_id
        )
      );
      RETURN json_build_object(
        'success', true,
        'skipped', true,
        'journal_entry_id', v_existing_je_id,
        'payment_id', v_payment_id,
        'reason', 'Journal entry already exists'
      );
    END IF;
  END IF;

  v_payment_account_id := v_expense.payment_account_id;
  IF v_payment_account_id IS NULL THEN
    SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = v_company_id AND code = '1000' LIMIT 1;
    SELECT id INTO v_bank_account_id FROM accounts WHERE company_id = v_company_id AND code = '1010' LIMIT 1;
    IF LOWER(COALESCE(v_expense.payment_method::TEXT, 'cash')) = 'cash' THEN
      v_payment_account_id := v_cash_account_id;
    ELSE
      v_payment_account_id := v_bank_account_id;
    END IF;
  END IF;

  IF v_payment_account_id IS NULL THEN
    v_payment_account_id := public._ensure_system_account(v_company_id, '1000', 'Cash in Hand', 'asset');
  END IF;

  IF v_is_clearing THEN
    v_extra_service_id := public._ensure_system_account(
      v_company_id, '4120', 'Extra Service Income', 'revenue'
    );
    v_open_bal := public.open_4120_balance_for_sale_charge(v_sale_charge_id);
    IF v_amount > v_open_bal + 0.005 THEN
      RETURN json_build_object(
        'success', false,
        'error',
        format(
          'Payout Rs. %s exceeds open Extra Service balance Rs. %s for this sale charge.',
          to_char(v_amount, 'FM999,999,990.00'),
          to_char(v_open_bal, 'FM999,999,990.00')
        )
      );
    END IF;

    IF v_sale_id IS NULL THEN
      SELECT sc.sale_id INTO v_sale_id FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;
    IF v_tailor_id IS NULL OR v_expense_category_id IS NULL THEN
      SELECT sc.tailor_contact_id, sc.expense_category_id
      INTO v_tailor_id, v_expense_category_id
      FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
    END IF;
    v_tailor_name := NULL;
    IF v_expense_category_id IS NOT NULL THEN
      SELECT name INTO v_tailor_name FROM public.expense_categories WHERE id = v_expense_category_id;
    END IF;
    IF v_tailor_name IS NULL AND v_tailor_id IS NOT NULL THEN
      SELECT name INTO v_tailor_name FROM public.contacts WHERE id = v_tailor_id;
    END IF;

    SELECT COALESCE(s.invoice_no, s.order_no, s.id::TEXT) INTO v_invoice_no
    FROM public.sales s WHERE s.id = v_sale_id;

    INSERT INTO journal_entries (
      company_id, branch_id, entry_no, entry_date, description,
      reference_type, reference_id, created_by, is_posted
    )
    VALUES (
      v_company_id,
      v_branch_id,
      'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
        (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = v_company_id)::TEXT,
        4, '0'
      ),
      COALESCE(v_expense.expense_date, NOW()::DATE),
      'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)
        || ' - 4120 clearing'
        || CASE WHEN v_invoice_no IS NOT NULL THEN ' - ' || v_invoice_no ELSE '' END
        || CASE WHEN v_tailor_name IS NOT NULL THEN ' - ' || v_tailor_name ELSE '' END,
      'expense',
      p_expense_id,
      v_expense.created_by,
      true
    )
    RETURNING id INTO v_journal_entry_id;

    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, debit, credit, description,
      sale_id, sale_charge_id, tailor_contact_id
    )
    VALUES (
      v_journal_entry_id,
      v_extra_service_id,
      v_amount,
      0,
      'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)
        || CASE WHEN v_tailor_name IS NOT NULL THEN ' - ' || v_tailor_name ELSE '' END,
      v_sale_id,
      v_sale_charge_id,
      v_tailor_id
    );

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (
      v_journal_entry_id,
      v_payment_account_id,
      0,
      v_amount,
      'Tailor payout - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)
    );

    BEGIN
      UPDATE journal_entries
      SET total_debit  = v_amount,
          total_credit = v_amount
      WHERE id = v_journal_entry_id;
    EXCEPTION WHEN undefined_column THEN NULL;
    END;

    v_payment_id := public._ensure_expense_payment_row(
      p_expense_id,
      v_journal_entry_id,
      v_payment_account_id
    );

    RETURN json_build_object(
      'success', true,
      'journal_entry_id', v_journal_entry_id,
      'payment_id', v_payment_id,
      'expense_account_id', v_extra_service_id,
      'payment_account_id', v_payment_account_id,
      'amount', v_amount,
      'clearing_4120', true,
      'open_balance_after', GREATEST(0, v_open_bal - v_amount)
    );
  END IF;

  v_expense_code := CASE
    WHEN v_category_lc IN ('salaries', 'salary', 'wages') THEN '6110'
    WHEN v_category_lc IN ('marketing', 'advertising') THEN '6120'
    WHEN v_category_lc IN ('rent', 'utilities', 'office_supplies', 'office') THEN '6100'
    WHEN v_category_lc IN ('shipping', 'freight', 'courier') THEN '5100'
    WHEN v_category_lc IN ('production', 'manufacturing') THEN '5000'
    WHEN v_category_lc IN ('travel') THEN '6130'
    WHEN v_category_lc IN ('repairs') THEN '6140'
    WHEN v_category_lc IN ('professional_fees') THEN '6150'
    WHEN v_category_lc IN ('insurance') THEN '6160'
    WHEN v_category_lc IN ('taxes') THEN '6170'
    ELSE '6000'
  END;

  v_expense_name := CASE v_expense_code
    WHEN '6110' THEN 'Salaries & Wages'
    WHEN '6120' THEN 'Marketing & Advertising'
    WHEN '6100' THEN 'General Administrative'
    WHEN '5100' THEN 'Shipping & Freight'
    WHEN '5000' THEN 'Production / Manufacturing'
    WHEN '6130' THEN 'Travel'
    WHEN '6140' THEN 'Repairs & Maintenance'
    WHEN '6150' THEN 'Professional Fees'
    WHEN '6160' THEN 'Insurance'
    WHEN '6170' THEN 'Taxes (non-sales)'
    ELSE 'Miscellaneous Expense'
  END;

  v_expense_account_id := public._ensure_system_account(v_company_id, v_expense_code, v_expense_name, 'expense');

  INSERT INTO journal_entries (
    company_id, branch_id, entry_no, entry_date, description,
    reference_type, reference_id, created_by, is_posted
  )
  VALUES (
    v_company_id,
    v_branch_id,
    'JE-' || to_char(NOW(), 'YYYYMMDD') || '-' || lpad(
      (SELECT COUNT(*) + 1 FROM journal_entries WHERE company_id = v_company_id)::TEXT,
      4, '0'
    ),
    COALESCE(v_expense.expense_date, NOW()::DATE),
    'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT)
      || CASE WHEN v_expense.description IS NOT NULL THEN ' - ' || v_expense.description ELSE '' END,
    'expense',
    p_expense_id,
    v_expense.created_by,
    true
  )
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
  VALUES
    (v_journal_entry_id, v_expense_account_id, v_amount, 0,
     v_expense_name || ' - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)),
    (v_journal_entry_id, v_payment_account_id, 0, v_amount,
     'Expense payment - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT));

  BEGIN
    UPDATE journal_entries
    SET total_debit  = v_amount,
        total_credit = v_amount
    WHERE id = v_journal_entry_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  v_payment_id := public._ensure_expense_payment_row(
    p_expense_id,
    v_journal_entry_id,
    v_payment_account_id
  );

  RETURN json_build_object(
    'success', true,
    'journal_entry_id', v_journal_entry_id,
    'payment_id', v_payment_id,
    'expense_account_id', v_expense_account_id,
    'payment_account_id', v_payment_account_id,
    'amount', v_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.record_expense_with_accounting(UUID) IS
  'Posts expense JE and ensures payments row + payment_id link for Roznamcha.';

-- Backfill: expense JEs with liquidity credit line but no payment_id / payments row.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (je.reference_id)
      je.id AS je_id,
      je.reference_id AS expense_id,
      l.account_id AS payment_account_id
    FROM journal_entries je
    JOIN journal_entry_lines l ON l.journal_entry_id = je.id AND l.credit > 0
    JOIN accounts a ON a.id = l.account_id
    WHERE je.reference_type = 'expense'
      AND je.reference_id IS NOT NULL
      AND COALESCE(je.is_void, false) = false
      AND (
        a.code IN ('1000', '1010', '1020')
        OR a.code LIKE '102%'
        OR LOWER(COALESCE(a.type, '')) IN ('cash', 'bank', 'wallet', 'mobile_wallet', 'card', 'pos')
        OR LOWER(COALESCE(a.name, '')) ~ '(cash|bank|wallet|jazz|easypaisa|easy.?paisa|ndm|mobicash|finja|upaisa|sadapay|nayapay)'
      )
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.reference_type = 'expense'
          AND p.reference_id = je.reference_id
          AND p.voided_at IS NULL
      )
    ORDER BY je.reference_id, je.created_at DESC
  LOOP
    PERFORM public._ensure_expense_payment_row(r.expense_id, r.je_id, r.payment_account_id);
  END LOOP;
END;
$$;
