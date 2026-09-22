-- Repair SALE_RETURN-0001 / SL-0049 settlement GL (additive, idempotent).
-- Bad JE-0289: Dr 4010 Studio 26k / Cr 1010 Bank 26k (old exclusive bank path).
-- Correct: Dr 4000 Sales 26k / Cr AR-CUS0000 16k / Cr 1002 CASH G140 10k
--          + inventory reversal Dr 1200 / Cr 5010 15,500 (from original sale COGS).

DO $$
DECLARE
  v_company_id UUID := '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
  v_sale_id UUID := 'b0b4b5c1-bab3-4b7c-9278-a142fccd29c2';
  v_return_id UUID := '0852facf-3056-4010-8f86-d792f8fcbe29';
  v_bad_je_id UUID := '3f127e2b-6870-450a-8915-1e746b501438';
  v_branch_id UUID;
  v_entry_date DATE := '2026-08-23';
  v_settle_fp TEXT;
  v_cogs_fp TEXT;
  v_acct_4000 UUID;
  v_acct_ar UUID;
  v_acct_1002 UUID;
  v_acct_1200 UUID;
  v_acct_5010 UUID;
  v_settle_je_id UUID;
  v_cogs_je_id UUID;
  v_entry_no TEXT;
  v_cogs_entry_no TEXT;
  v_return_total NUMERIC := 26000;
  v_ar_portion NUMERIC := 16000;
  v_refund_portion NUMERIC := 10000;
  v_cogs_amount NUMERIC := 15500;
BEGIN
  v_settle_fp := 'sale_return_settlement:' || v_company_id::text || ':' || v_return_id::text;
  v_cogs_fp := 'sale_return_cogs:' || v_company_id::text || ':' || v_return_id::text;

  SELECT sr.branch_id INTO v_branch_id
  FROM sale_returns sr
  WHERE sr.id = v_return_id
    AND sr.company_id = v_company_id
    AND sr.original_sale_id = v_sale_id
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE NOTICE 'repair_sale_return_0001: return/sale not found — skip';
    RETURN;
  END IF;

  SELECT id INTO v_acct_4000 FROM accounts WHERE company_id = v_company_id AND code = '4000' LIMIT 1;
  SELECT id INTO v_acct_ar FROM accounts WHERE company_id = v_company_id AND code = 'AR-CUS0000' LIMIT 1;
  SELECT id INTO v_acct_1002 FROM accounts WHERE company_id = v_company_id AND code = '1002' LIMIT 1;
  SELECT id INTO v_acct_1200 FROM accounts WHERE company_id = v_company_id AND code = '1200' LIMIT 1;
  SELECT id INTO v_acct_5010 FROM accounts WHERE company_id = v_company_id AND code = '5010' LIMIT 1;

  IF v_acct_4000 IS NULL OR v_acct_ar IS NULL OR v_acct_1002 IS NULL THEN
    RAISE EXCEPTION 'repair_sale_return_0001: missing 4000 / AR-CUS0000 / 1002';
  END IF;

  -- 1) Void bad exclusive-bank settlement JE-0289
  UPDATE journal_entries
  SET
    is_void = true,
    void_reason = 'Repair SALE_RETURN-0001: wrong exclusive Cr Bank 26k + Dr 4010; replace with due-first AR 16k + cash 10k on 4000',
    voided_at = COALESCE(voided_at, now())
  WHERE id = v_bad_je_id
    AND company_id = v_company_id
    AND COALESCE(is_void, false) = false;

  -- 2) Correct settlement JE (idempotent via fingerprint)
  IF NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.company_id = v_company_id
      AND je.action_fingerprint = v_settle_fp
      AND COALESCE(je.is_void, false) = false
  ) THEN
    BEGIN
      v_entry_no := public.generate_document_number(v_company_id, v_branch_id, 'MANUAL_JOURNAL', false);
    EXCEPTION WHEN OTHERS THEN
      v_entry_no := 'JE-SR-REP-' || to_char(now(), 'YYYYMMDDHH24MISS');
    END;

    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id,
      is_posted,
      posted_at,
      total_debit,
      total_credit,
      action_fingerprint
    )
    VALUES (
      v_company_id,
      v_branch_id,
      v_entry_no,
      v_entry_date,
      'Repair Sale Return: SALE_RETURN-0001 (Original: SL-0049) - Due adjust 16000 / Refund 10000',
      'sale_return',
      v_return_id,
      true,
      now(),
      v_return_total,
      v_return_total,
      v_settle_fp
    )
    RETURNING id INTO v_settle_je_id;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sale_id)
    VALUES
      (
        v_settle_je_id,
        v_acct_4000,
        v_return_total,
        0,
        'Sales return revenue reversal - SALE_RETURN-0001',
        v_sale_id
      ),
      (
        v_settle_je_id,
        v_acct_ar,
        0,
        v_ar_portion,
        'Due adjust (AR) - SALE_RETURN-0001',
        v_sale_id
      ),
      (
        v_settle_je_id,
        v_acct_1002,
        0,
        v_refund_portion,
        'Cash refund (collection account) - SALE_RETURN-0001',
        v_sale_id
      );
  ELSE
    RAISE NOTICE 'repair_sale_return_0001: settlement fingerprint already present — skip settle insert';
  END IF;

  -- 3) Missing inventory / COGS reversal (15,500 from original sale JE-0266)
  IF v_acct_1200 IS NULL OR v_acct_5010 IS NULL THEN
    RAISE NOTICE 'repair_sale_return_0001: missing 1200/5010 — skip COGS JE';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM journal_entries je
    WHERE je.company_id = v_company_id
      AND je.action_fingerprint = v_cogs_fp
      AND COALESCE(je.is_void, false) = false
  ) THEN
    BEGIN
      v_cogs_entry_no := public.generate_document_number(v_company_id, v_branch_id, 'MANUAL_JOURNAL', false);
    EXCEPTION WHEN OTHERS THEN
      v_cogs_entry_no := 'JE-SR-COGS-' || to_char(now(), 'YYYYMMDDHH24MISS');
    END;

    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id,
      is_posted,
      posted_at,
      total_debit,
      total_credit,
      action_fingerprint
    )
    VALUES (
      v_company_id,
      v_branch_id,
      v_cogs_entry_no,
      v_entry_date,
      'Repair Sale Return inventory/COGS: SALE_RETURN-0001 (Original: SL-0049)',
      'sale_return',
      v_return_id,
      true,
      now(),
      v_cogs_amount,
      v_cogs_amount,
      v_cogs_fp
    )
    RETURNING id INTO v_cogs_je_id;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, sale_id)
    VALUES
      (
        v_cogs_je_id,
        v_acct_1200,
        v_cogs_amount,
        0,
        'Inventory in - sale return SALE_RETURN-0001',
        v_sale_id
      ),
      (
        v_cogs_je_id,
        v_acct_5010,
        0,
        v_cogs_amount,
        'COGS reversal - sale return SALE_RETURN-0001',
        v_sale_id
      );
  ELSE
    RAISE NOTICE 'repair_sale_return_0001: COGS fingerprint already present — skip COGS insert';
  END IF;
END $$;
