-- Migration: Fix Issue 01 — AP/AR contamination
-- Problem: Sales, shipment, and sale_extra_expense were posting to account 2000 (Accounts Payable).
-- Canonical: 1100 = Accounts Receivable, 2000 = Accounts Payable.
-- This script moves existing journal_entry_lines from 2000 to 1100 where the journal entry
-- is customer-related (sale, shipment, sale_extra_expense). After this, AP statement (2000)
-- will only show supplier/courier payable activity.
-- ONE ISSUE ONLY. No mixing. Ref: ERP_COA_REVIEW_AND_ISSUES_TRACKER_v4.md Issue 01.

DO $$
DECLARE
  r RECORD;
  v_company_id UUID;
  v_account_2000_id UUID;
  v_account_1100_id UUID;
  v_updated BIGINT;
BEGIN
  FOR r IN (
    SELECT DISTINCT je.company_id
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    JOIN accounts a ON a.id = jel.account_id AND a.company_id = je.company_id
    WHERE je.reference_type IN ('sale', 'shipment', 'sale_extra_expense')
      AND a.code = '2000'
  )
  LOOP
    v_company_id := r.company_id;

    SELECT id INTO v_account_2000_id FROM accounts WHERE company_id = v_company_id AND code = '2000' LIMIT 1;
    SELECT id INTO v_account_1100_id FROM accounts WHERE company_id = v_company_id AND code = '1100' LIMIT 1;

    IF v_account_2000_id IS NULL OR v_account_1100_id IS NULL THEN
      RAISE NOTICE 'Company %: missing 1100 or 2000 account, skipping', v_company_id;
      CONTINUE;
    END IF;

    UPDATE journal_entry_lines jel
    SET account_id = v_account_1100_id
    FROM journal_entries je
    WHERE jel.journal_entry_id = je.id
      AND jel.account_id = v_account_2000_id
      AND je.reference_type IN ('sale', 'shipment', 'sale_extra_expense')
      AND je.company_id = v_company_id;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RAISE NOTICE 'Company %: moved % journal entry line(s) from AP (2000) to AR (1100)', v_company_id, v_updated;
  END LOOP;
END $$;
