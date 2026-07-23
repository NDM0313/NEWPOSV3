-- Hybrid service expense: one EXP row, FIFO 4120 clearing chunks + category remainder in one JE.
-- Mobile sends expenses.clearing_allocations = [{ "sale_charge_id": uuid, "amount": n }, ...].

SET search_path = public;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS clearing_allocations JSONB;

COMMENT ON COLUMN public.expenses.clearing_allocations IS
  '4120 hybrid payouts: JSON array [{sale_charge_id, amount}]. Remainder (amount - sum) posts to category expense account.';

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
  v_clearing_total       NUMERIC(15,2) := 0;
  v_category_amt         NUMERIC(15,2) := 0;
  v_chunk_amt            NUMERIC(15,2);
  v_chunk_charge_id      UUID;
  v_chunk_sale_id        UUID;
  v_chunk_tailor_id      UUID;
  v_alloc_elem           JSONB;
  v_has_alloc_json       BOOLEAN;
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

  v_has_alloc_json := (
    v_expense.clearing_allocations IS NOT NULL
    AND jsonb_typeof(v_expense.clearing_allocations) = 'array'
    AND jsonb_array_length(v_expense.clearing_allocations) > 0
  );

  v_is_clearing := (
    v_category_lc IN ('stitching', 'dying', 'dyeing', 'lining')
    AND (v_has_alloc_json OR v_sale_charge_id IS NOT NULL)
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
      'Expense #' || COALESCE(v_expense.expense_no, v_expense.id::TEXT) || ' - 4120 clearing (hybrid)',
      'expense',
      p_expense_id,
      v_expense.created_by,
      true
    )
    RETURNING id INTO v_journal_entry_id;

    IF v_has_alloc_json THEN
      FOR v_alloc_elem IN
        SELECT value FROM jsonb_array_elements(v_expense.clearing_allocations) AS t(value)
      LOOP
        v_chunk_charge_id := NULLIF(trim(v_alloc_elem->>'sale_charge_id'), '')::uuid;
        v_chunk_amt := COALESCE((v_alloc_elem->>'amount')::numeric, 0);
        IF v_chunk_charge_id IS NULL OR v_chunk_amt <= 0.005 THEN
          CONTINUE;
        END IF;
        v_open_bal := public.open_4120_balance_for_sale_charge(v_chunk_charge_id);
        IF v_chunk_amt > v_open_bal + 0.005 THEN
          RETURN json_build_object(
            'success', false,
            'error',
            format(
              'Payout Rs. %s exceeds open Extra Service balance Rs. %s for sale charge %s.',
              to_char(v_chunk_amt, 'FM999,999,990.00'),
              to_char(v_open_bal, 'FM999,999,990.00'),
              v_chunk_charge_id::text
            )
          );
        END IF;
        SELECT sc.sale_id, sc.tailor_contact_id
        INTO v_chunk_sale_id, v_chunk_tailor_id
        FROM public.sale_charges sc
        WHERE sc.id = v_chunk_charge_id;
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, debit, credit, description,
          sale_id, sale_charge_id, tailor_contact_id
        )
        VALUES (
          v_journal_entry_id,
          v_extra_service_id,
          v_chunk_amt,
          0,
          'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT),
          v_chunk_sale_id,
          v_chunk_charge_id,
          v_chunk_tailor_id
        );
        v_clearing_total := v_clearing_total + v_chunk_amt;
      END LOOP;
      v_category_amt := v_amount - v_clearing_total;
    ELSIF v_sale_charge_id IS NOT NULL THEN
      v_open_bal := public.open_4120_balance_for_sale_charge(v_sale_charge_id);
      IF v_amount > v_open_bal + 0.005 THEN
        v_chunk_amt := v_open_bal;
        v_category_amt := v_amount - v_open_bal;
      ELSE
        v_chunk_amt := v_amount;
        v_category_amt := 0;
      END IF;
      IF v_chunk_amt > 0.005 THEN
        IF v_sale_id IS NULL THEN
          SELECT sc.sale_id INTO v_sale_id FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
        END IF;
        IF v_tailor_id IS NULL THEN
          SELECT sc.tailor_contact_id INTO v_tailor_id
          FROM public.sale_charges sc WHERE sc.id = v_sale_charge_id;
        END IF;
        INSERT INTO journal_entry_lines (
          journal_entry_id, account_id, debit, credit, description,
          sale_id, sale_charge_id, tailor_contact_id
        )
        VALUES (
          v_journal_entry_id,
          v_extra_service_id,
          v_chunk_amt,
          0,
          'Extra Service clearing - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT),
          v_sale_id,
          v_sale_charge_id,
          v_tailor_id
        );
        v_clearing_total := v_chunk_amt;
      END IF;
    END IF;

    IF v_category_amt < -0.005 THEN
      RETURN json_build_object(
        'success', false,
        'error',
        'Clearing allocations exceed expense amount.'
      );
    END IF;

    IF v_category_amt > 0.005 THEN
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
      v_expense_account_id := public._ensure_system_account(
        v_company_id, v_expense_code, v_expense_name, 'expense'
      );
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (
        v_journal_entry_id,
        v_expense_account_id,
        v_category_amt,
        0,
        v_expense_name || ' (service) - ' || COALESCE(v_expense.expense_no, p_expense_id::TEXT)
      );
    END IF;

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
      'expense_account_id', COALESCE(v_expense_account_id, v_extra_service_id),
      'payment_account_id', v_payment_account_id,
      'amount', v_amount,
      'clearing_4120', true,
      'clearing_total', v_clearing_total,
      'category_amount', GREATEST(0, v_category_amt)
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
  'Posts expense JE. Service categories: hybrid 4120 clearing_allocations JSON + category remainder in one entry.';
