-- Fix: "column journal_entry_id of relation sales does not exist"
-- The trigger auto_post_sale_to_accounting updates sales.journal_entry_id after creating a journal entry.
-- If your sales table has no journal_entry_id column, run this to make the trigger skip that update.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION auto_post_sale_to_accounting()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_id UUID;
  v_cash_account_id UUID;
  v_sales_account_id UUID;
  v_ar_account_id UUID;
BEGIN
  IF NEW.status = 'final' AND (OLD.status IS NULL OR OLD.status != 'final') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='subtype') THEN
      SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = NEW.company_id AND subtype = 'cash' AND is_active = true LIMIT 1;
    END IF;
    IF v_cash_account_id IS NULL THEN
      SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = NEW.company_id AND LOWER(type) = 'cash' AND is_active = true LIMIT 1;
    END IF;
    IF v_cash_account_id IS NULL THEN
      SELECT id INTO v_cash_account_id FROM accounts WHERE company_id = NEW.company_id AND LOWER(type) = 'bank' AND is_active = true LIMIT 1;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='subtype') THEN
      SELECT id INTO v_sales_account_id FROM accounts WHERE company_id = NEW.company_id AND subtype = 'sales_revenue' AND is_active = true LIMIT 1;
    END IF;
    IF v_sales_account_id IS NULL THEN
      SELECT id INTO v_sales_account_id FROM accounts WHERE company_id = NEW.company_id AND LOWER(type) IN ('revenue', 'income') AND is_active = true LIMIT 1;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='accounts' AND column_name='subtype') THEN
      SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = NEW.company_id AND subtype = 'accounts_receivable' AND is_active = true LIMIT 1;
    END IF;
    IF v_ar_account_id IS NULL THEN
      SELECT id INTO v_ar_account_id FROM accounts WHERE company_id = NEW.company_id AND LOWER(type) = 'receivable' AND is_active = true LIMIT 1;
    END IF;

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

    INSERT INTO journal_entries (company_id, branch_id, entry_no, entry_date, description, reference_type, reference_id, total_debit, total_credit, is_posted, posted_at, is_manual, created_by)
    VALUES (NEW.company_id, NEW.branch_id, get_next_document_number(NEW.company_id, NEW.branch_id, 'journal'), NEW.invoice_date, 'Sale to ' || NEW.customer_name || ' - Invoice ' || NEW.invoice_no, 'sale', NEW.id, NEW.total, NEW.total, true, NOW(), false, NEW.created_by)
    RETURNING id INTO v_journal_id;

    IF NEW.paid_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (v_journal_id, v_cash_account_id, NEW.paid_amount, 0, 'Cash received on sale');
    END IF;
    IF NEW.due_amount > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (v_journal_id, v_ar_account_id, NEW.due_amount, 0, 'Credit sale to ' || NEW.customer_name);
    END IF;
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
    VALUES (v_journal_id, v_sales_account_id, 0, NEW.total, 'Sale revenue');

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'journal_entry_id') THEN
      UPDATE sales SET journal_entry_id = v_journal_id WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
