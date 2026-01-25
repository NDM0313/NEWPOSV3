-- Backfill journal entries for existing payments that don't have journal entries

DO $$
DECLARE
  payment_record RECORD;
  v_journal_entry_id UUID;
  v_receivable_account_id UUID;
  v_customer_name VARCHAR;
  v_invoice_no VARCHAR;
BEGIN
  -- Get Accounts Receivable account for each company
  FOR payment_record IN 
    SELECT p.id, p.company_id, p.branch_id, p.reference_id, p.amount, 
           p.payment_account_id, s.customer_name, s.invoice_no
    FROM payments p
    JOIN sales s ON s.id = p.reference_id
    WHERE p.reference_type = 'sale'
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries je 
        WHERE je.payment_id = p.id
      )
    ORDER BY p.created_at
  LOOP
    -- Get Accounts Receivable account for this company
    SELECT id INTO v_receivable_account_id
    FROM accounts
    WHERE company_id = payment_record.company_id
      AND code = '2000'
    LIMIT 1;
    
    IF v_receivable_account_id IS NOT NULL THEN
      -- Create journal entry
      INSERT INTO journal_entries (
        company_id,
        branch_id,
        entry_date,
        description,
        reference_type,
        reference_id,
        payment_id
      ) VALUES (
        payment_record.company_id,
        payment_record.branch_id,
        NOW()::DATE,
        'Payment received from ' || COALESCE(payment_record.customer_name, 'Customer'),
        'sale',
        payment_record.reference_id,
        payment_record.id
      )
      RETURNING id INTO v_journal_entry_id;
      
      -- Debit: Cash/Bank Account
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_entry_id,
        payment_record.payment_account_id,
        payment_record.amount,
        0,
        'Payment received - ' || COALESCE(payment_record.invoice_no, '')
      );
      
      -- Credit: Accounts Receivable
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        account_id,
        debit,
        credit,
        description
      ) VALUES (
        v_journal_entry_id,
        v_receivable_account_id,
        0,
        payment_record.amount,
        'Payment received - ' || COALESCE(payment_record.invoice_no, '')
      );
    END IF;
  END LOOP;
END $$;

-- Verify
SELECT 
  'Backfilled Journal Entries' as check_name,
  COUNT(*) as journal_entry_count
FROM journal_entries
WHERE payment_id IS NOT NULL;
