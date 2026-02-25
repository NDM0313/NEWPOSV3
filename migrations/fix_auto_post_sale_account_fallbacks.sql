-- Fix: auto_post_sale_to_accounting inserts journal_entry_lines with null account_id
-- when subtype lookup fails (no accounts have subtype, or column missing).
-- Add fallback lookup by type when subtype returns null.
--
-- Requires function owner (supabase_admin on VPS). If run-migrations fails with
-- "must be owner", run: ./scripts/run-migration-as-postgres.sh migrations/fix_auto_post_sale_account_fallbacks.sql

CREATE OR REPLACE FUNCTION auto_post_sale_to_accounting()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_id UUID;
  v_cash_account_id UUID;
  v_sales_account_id UUID;
  v_ar_account_id UUID;
BEGIN
  -- Only post when status becomes 'final'
  IF NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final') THEN
    
    -- Cash/Bank account: for paid portion. Try subtype first (if column exists), then type.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='subtype') THEN
      SELECT id INTO v_cash_account_id FROM accounts
      WHERE company_id = NEW.company_id AND subtype = 'cash' AND is_active = true LIMIT 1;
    END IF;
    IF v_cash_account_id IS NULL THEN
      SELECT id INTO v_cash_account_id FROM accounts
      WHERE company_id = NEW.company_id AND LOWER(type) = 'cash' AND is_active = true LIMIT 1;
    END IF;
    IF v_cash_account_id IS NULL THEN
      SELECT id INTO v_cash_account_id FROM accounts
      WHERE company_id = NEW.company_id AND LOWER(type) = 'bank' AND is_active = true LIMIT 1;
    END IF;

    -- Sales revenue account
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='subtype') THEN
      SELECT id INTO v_sales_account_id FROM accounts
      WHERE company_id = NEW.company_id AND subtype = 'sales_revenue' AND is_active = true LIMIT 1;
    END IF;
    IF v_sales_account_id IS NULL THEN
      SELECT id INTO v_sales_account_id FROM accounts
      WHERE company_id = NEW.company_id AND LOWER(type) IN ('revenue', 'income') AND is_active = true LIMIT 1;
    END IF;

    -- Accounts receivable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='subtype') THEN
      SELECT id INTO v_ar_account_id FROM accounts
      WHERE company_id = NEW.company_id AND subtype = 'accounts_receivable' AND is_active = true LIMIT 1;
    END IF;
    IF v_ar_account_id IS NULL THEN
      SELECT id INTO v_ar_account_id FROM accounts
      WHERE company_id = NEW.company_id AND LOWER(type) = 'receivable' AND is_active = true LIMIT 1;
    END IF;

    -- Skip journal creation if required accounts are missing (avoid null account_id)
    IF v_sales_account_id IS NULL THEN
      RAISE WARNING 'auto_post_sale_to_accounting: No sales/revenue account for company %. Skipping journal.', NEW.company_id;
      RETURN NEW;
    END IF;
    IF NEW.paid_amount > 0 AND v_cash_account_id IS NULL THEN
      RAISE WARNING 'auto_post_sale_to_accounting: No cash/bank account for paid amount. Sale %. Skipping journal.', NEW.id;
      RETURN NEW;
    END IF;
    IF NEW.due_amount > 0 AND v_ar_account_id IS NULL THEN
      RAISE WARNING 'auto_post_sale_to_accounting: No AR account for due amount. Sale %. Skipping journal.', NEW.id;
      RETURN NEW;
    END IF;

    -- Create journal entry
    INSERT INTO journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      description,
      reference_type,
      reference_id,
      total_debit,
      total_credit,
      is_posted,
      posted_at,
      is_manual,
      created_by
    ) VALUES (
      NEW.company_id,
      NEW.branch_id,
      get_next_document_number(NEW.company_id, NEW.branch_id, 'journal'),
      NEW.invoice_date,
      'Sale to ' || NEW.customer_name || ' - Invoice ' || NEW.invoice_no,
      'sale',
      NEW.id,
      NEW.total,
      NEW.total,
      true,
      NOW(),
      false,
      NEW.created_by
    ) RETURNING id INTO v_journal_id;

    -- Debit entries (we've already validated accounts exist above)
    IF NEW.paid_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (
        v_journal_id,
        v_cash_account_id,
        NEW.paid_amount,
        0,
        'Cash received on sale'
      );
    END IF;

    IF NEW.due_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (
        v_journal_id,
        v_ar_account_id,
        NEW.due_amount,
        0,
        'Credit sale to ' || NEW.customer_name
      );
    END IF;

    -- Credit entry: Sales Revenue (required)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (
      v_journal_id,
      v_sales_account_id,
      0,
      NEW.total,
      'Sale revenue'
    );

    -- Update sale with journal reference
    UPDATE sales SET journal_entry_id = v_journal_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
