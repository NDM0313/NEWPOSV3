-- ============================================================================
-- ERP DATA REPAIR SCRIPT
-- Purpose: Repair existing data after Priority-1 fixes implementation
-- Date: February 6, 2026
-- ⚠️ WARNING: Run this script ONLY ONCE after fixes are implemented
-- ============================================================================

DO $$
DECLARE
    v_company_id UUID := 'eb71d817-b87e-4195-964b-7b5321b480f5'; -- Replace with actual company_id
    v_customer_ledger_count INTEGER := 0;
    v_supplier_ledger_count INTEGER := 0;
    v_purchase_journal_count INTEGER := 0;
    v_sale_journal_count INTEGER := 0;
    v_payment_journal_count INTEGER := 0;
    v_payment_account_fix_count INTEGER := 0;
    -- Account IDs (used in multiple tasks)
    v_inventory_account_id UUID;
    v_ap_account_id UUID;
    v_ar_account_id UUID;
    v_sales_account_id UUID;
    v_payment_ap_account_id UUID;
    v_default_cash_account_id UUID;
    v_default_bank_account_id UUID;
    -- Record variables
    v_purchase_record RECORD;
    v_sale_record RECORD;
    v_payment_record RECORD;
    -- Journal entry IDs
    v_journal_entry_id UUID;
    v_sale_journal_entry_id UUID;
    v_payment_journal_entry_id UUID;
    v_payment_account_id UUID;
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'ERP DATA REPAIR SCRIPT - STARTING';
    RAISE NOTICE '============================================================================';
    
    -- ============================================================================
    -- REPAIR TASK 1: Create missing customer ledgers
    -- ============================================================================
    RAISE NOTICE 'TASK 1: Creating missing customer ledgers...';
    
    INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name, opening_balance, created_at, updated_at)
    SELECT 
        c.company_id,
        'customer'::VARCHAR,
        c.id,
        c.name,
        COALESCE(c.opening_balance, 0),
        NOW(),
        NOW()
    FROM contacts c
    WHERE c.company_id = v_company_id
      AND c.type IN ('customer', 'both')
      AND NOT EXISTS (
          SELECT 1 FROM ledger_master lm
          WHERE lm.company_id = c.company_id
            AND lm.ledger_type = 'customer'
            AND lm.entity_id = c.id
      );
    
    GET DIAGNOSTICS v_customer_ledger_count = ROW_COUNT;
    RAISE NOTICE '✅ Created % customer ledgers', v_customer_ledger_count;
    
    -- ============================================================================
    -- REPAIR TASK 2: Create missing supplier ledgers
    -- ============================================================================
    RAISE NOTICE 'TASK 2: Creating missing supplier ledgers...';
    
    INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name, opening_balance, created_at, updated_at)
    SELECT 
        c.company_id,
        'supplier'::VARCHAR,
        c.id,
        c.name,
        COALESCE(c.supplier_opening_balance, c.opening_balance, 0),
        NOW(),
        NOW()
    FROM contacts c
    WHERE c.company_id = v_company_id
      AND c.type IN ('supplier', 'both')
      AND NOT EXISTS (
          SELECT 1 FROM ledger_master lm
          WHERE lm.company_id = c.company_id
            AND lm.ledger_type = 'supplier'
            AND lm.entity_id = c.id
      );
    
    GET DIAGNOSTICS v_supplier_ledger_count = ROW_COUNT;
    RAISE NOTICE '✅ Created % supplier ledgers', v_supplier_ledger_count;
    
    -- ============================================================================
    -- REPAIR TASK 3: Create missing purchase journal entries (for unpaid purchases)
    -- ============================================================================
    RAISE NOTICE 'TASK 3: Creating missing purchase journal entries...';
    
    -- Get Inventory account
    SELECT id INTO v_inventory_account_id
    FROM accounts
    WHERE company_id = v_company_id
      AND (name ILIKE 'Inventory' OR name ILIKE 'Stock' OR code = '1500')
    LIMIT 1;
    
    -- Get Accounts Payable account
    SELECT id INTO v_ap_account_id
    FROM accounts
    WHERE company_id = v_company_id
      AND (name ILIKE 'Accounts Payable' OR code = '2000')
    LIMIT 1;
    
    IF v_inventory_account_id IS NULL OR v_ap_account_id IS NULL THEN
        RAISE WARNING 'Missing required accounts. Cannot create purchase journal entries.';
    ELSE
        -- Create journal entries for purchases without journal entries
        FOR v_purchase_record IN
            SELECT p.id, p.company_id, p.branch_id, p.po_no, p.po_date, p.supplier_name, p.subtotal, p.total, p.created_by
            FROM purchases p
            WHERE p.company_id = v_company_id
              AND p.status IN ('received', 'final')
              AND p.total > 0
              AND NOT EXISTS (
                  SELECT 1 FROM journal_entries je
                  WHERE je.reference_type = 'purchase'
                    AND je.reference_id = p.id
              )
        LOOP
            -- Create journal entry
            INSERT INTO journal_entries (
                company_id,
                branch_id,
                entry_date,
                description,
                reference_type,
                reference_id,
                created_by,
                created_at
            )
            VALUES (
                v_purchase_record.company_id,
                v_purchase_record.branch_id,
                v_purchase_record.po_date,
                'Purchase ' || v_purchase_record.po_no || ' from ' || v_purchase_record.supplier_name,
                'purchase',
                v_purchase_record.id,
                v_purchase_record.created_by,
                NOW()
            )
            RETURNING id INTO v_journal_entry_id;
            
            -- Debit: Inventory
            INSERT INTO journal_entry_lines (
                journal_entry_id,
                account_id,
                debit,
                credit,
                description
            )
            VALUES (
                v_journal_entry_id,
                v_inventory_account_id,
                COALESCE(v_purchase_record.subtotal, v_purchase_record.total),
                0,
                'Inventory purchase ' || v_purchase_record.po_no
            );
            
            -- Credit: Accounts Payable
            INSERT INTO journal_entry_lines (
                journal_entry_id,
                account_id,
                debit,
                credit,
                description
            )
            VALUES (
                v_journal_entry_id,
                v_ap_account_id,
                0,
                COALESCE(v_purchase_record.subtotal, v_purchase_record.total),
                'Payable to ' || v_purchase_record.supplier_name
            );
            
            v_purchase_journal_count := v_purchase_journal_count + 1;
        END LOOP;
    END IF;
    
    RAISE NOTICE '✅ Created % purchase journal entries', v_purchase_journal_count;
    
    -- ============================================================================
    -- REPAIR TASK 4: Create missing sale journal entries (for unpaid sales)
    -- ============================================================================
    RAISE NOTICE 'TASK 4: Creating missing sale journal entries...';
    
    -- Get Accounts Receivable account
    SELECT id INTO v_ar_account_id
    FROM accounts
    WHERE company_id = v_company_id
      AND (name ILIKE 'Accounts Receivable' OR code = '1100')
    LIMIT 1;
    
    -- Get Sales Revenue account
    SELECT id INTO v_sales_account_id
    FROM accounts
    WHERE company_id = v_company_id
      AND (name ILIKE 'Sales Revenue' OR code = '4000')
    LIMIT 1;
    
    IF v_ar_account_id IS NULL OR v_sales_account_id IS NULL THEN
        RAISE WARNING 'Missing required accounts. Cannot create sale journal entries.';
    ELSE
        -- Create journal entries for sales without journal entries
        FOR v_sale_record IN
            SELECT s.id, s.company_id, s.branch_id, s.invoice_no, s.invoice_date, s.customer_name, s.total, s.paid_amount, s.created_by
            FROM sales s
            WHERE s.company_id = v_company_id
              AND s.type = 'invoice'
              AND s.status = 'final'
              AND s.total > 0
              AND NOT EXISTS (
                  SELECT 1 FROM journal_entries je
                  WHERE je.reference_type = 'sale'
                    AND je.reference_id = s.id
              )
        LOOP
            -- Create journal entry
            INSERT INTO journal_entries (
                company_id,
                branch_id,
                entry_date,
                description,
                reference_type,
                reference_id,
                created_by,
                created_at
            )
            VALUES (
                v_sale_record.company_id,
                v_sale_record.branch_id,
                v_sale_record.invoice_date,
                'Sale ' || v_sale_record.invoice_no || ' to ' || v_sale_record.customer_name,
                'sale',
                v_sale_record.id,
                v_sale_record.created_by,
                NOW()
            )
            RETURNING id INTO v_sale_journal_entry_id;
            
            -- Debit: Accounts Receivable (for unpaid portion)
            IF (v_sale_record.total - COALESCE(v_sale_record.paid_amount, 0)) > 0 THEN
                INSERT INTO journal_entry_lines (
                    journal_entry_id,
                    account_id,
                    debit,
                    credit,
                    description
                )
                VALUES (
                    v_sale_journal_entry_id,
                    v_ar_account_id,
                    v_sale_record.total - COALESCE(v_sale_record.paid_amount, 0),
                    0,
                    'Accounts Receivable for ' || v_sale_record.invoice_no
                );
            END IF;
            
            -- Credit: Sales Revenue
            INSERT INTO journal_entry_lines (
                journal_entry_id,
                account_id,
                debit,
                credit,
                description
            )
            VALUES (
                v_sale_journal_entry_id,
                v_sales_account_id,
                0,
                v_sale_record.total,
                'Sales Revenue for ' || v_sale_record.invoice_no
            );
            
            v_sale_journal_count := v_sale_journal_count + 1;
        END LOOP;
    END IF;
    
    RAISE NOTICE '✅ Created % sale journal entries', v_sale_journal_count;
    
    -- ============================================================================
    -- REPAIR TASK 5: Create missing payment journal entries (for purchase payments)
    -- ============================================================================
    RAISE NOTICE 'TASK 5: Creating missing payment journal entries...';
    
    -- Get Accounts Payable account (reuse v_ap_account_id if already set, otherwise get fresh)
    IF v_ap_account_id IS NULL THEN
        SELECT id INTO v_payment_ap_account_id
        FROM accounts
        WHERE company_id = v_company_id
          AND (name ILIKE 'Accounts Payable' OR code = '2000')
        LIMIT 1;
    ELSE
        v_payment_ap_account_id := v_ap_account_id;
    END IF;
    
    IF v_payment_ap_account_id IS NULL THEN
        RAISE WARNING 'Missing Accounts Payable account. Cannot create payment journal entries.';
    ELSE
        -- Create journal entries for purchase payments without journal entries
        FOR v_payment_record IN
            SELECT p.id, p.company_id, p.branch_id, p.amount, p.payment_account_id, p.payment_date, p.reference_id, p.created_by
            FROM payments p
            WHERE p.company_id = v_company_id
              AND p.reference_type = 'purchase'
              AND p.payment_account_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM journal_entries je
                  WHERE je.payment_id = p.id
                     OR (je.reference_type = 'payment' AND je.reference_id = p.id)
              )
        LOOP
            -- Get payment account
            SELECT id INTO v_payment_account_id
            FROM accounts
            WHERE id = v_payment_record.payment_account_id;
            
            IF v_payment_account_id IS NOT NULL THEN
                -- Create journal entry
                INSERT INTO journal_entries (
                    company_id,
                    branch_id,
                    entry_date,
                    description,
                    reference_type,
                    reference_id,
                    payment_id,
                    created_by,
                    created_at
                )
                VALUES (
                    v_payment_record.company_id,
                    v_payment_record.branch_id,
                    v_payment_record.payment_date,
                    'Payment for purchase ' || v_payment_record.reference_id::TEXT,
                    'payment',
                    v_payment_record.id,
                    v_payment_record.id,
                    v_payment_record.created_by,
                    NOW()
                )
                RETURNING id INTO v_payment_journal_entry_id;
                
                -- Debit: Accounts Payable
                INSERT INTO journal_entry_lines (
                    journal_entry_id,
                    account_id,
                    debit,
                    credit,
                    description
                )
                VALUES (
                    v_payment_journal_entry_id,
                    v_payment_ap_account_id,
                    v_payment_record.amount,
                    0,
                    'Payment to supplier'
                );
                
                -- Credit: Cash/Bank
                INSERT INTO journal_entry_lines (
                    journal_entry_id,
                    account_id,
                    debit,
                    credit,
                    description
                )
                VALUES (
                    v_payment_journal_entry_id,
                    v_payment_account_id,
                    0,
                    v_payment_record.amount,
                    'Payment from account'
                );
                
                v_payment_journal_count := v_payment_journal_count + 1;
            END IF;
        END LOOP;
    END IF;
    
    RAISE NOTICE '✅ Created % payment journal entries', v_payment_journal_count;
    
    -- ============================================================================
    -- REPAIR TASK 6: Fix payments without account_id (assign default account)
    -- ============================================================================
    RAISE NOTICE 'TASK 6: Fixing payments without account_id...';
    
    -- Get default Cash account
    SELECT id INTO v_default_cash_account_id
    FROM accounts
    WHERE company_id = v_company_id
      AND (code = '1000' OR name ILIKE 'Cash')
    LIMIT 1;
    
    -- Get default Bank account
    SELECT id INTO v_default_bank_account_id
    FROM accounts
    WHERE company_id = v_company_id
      AND (code = '1010' OR name ILIKE 'Bank')
    LIMIT 1;
    
    -- Update payments without account_id based on payment method
    UPDATE payments
    SET payment_account_id = CASE
        WHEN payment_method = 'cash' AND v_default_cash_account_id IS NOT NULL THEN v_default_cash_account_id
        WHEN payment_method IN ('bank', 'card') AND v_default_bank_account_id IS NOT NULL THEN v_default_bank_account_id
        WHEN v_default_cash_account_id IS NOT NULL THEN v_default_cash_account_id
        ELSE payment_account_id
    END
    WHERE company_id = v_company_id
      AND payment_account_id IS NULL
      AND (payment_method IS NOT NULL OR payment_method != '');
    
    GET DIAGNOSTICS v_payment_account_fix_count = ROW_COUNT;
    
    RAISE NOTICE '✅ Fixed % payments without account_id', v_payment_account_fix_count;
    
    -- ============================================================================
    -- SUMMARY
    -- ============================================================================
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'ERP DATA REPAIR SCRIPT - COMPLETED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Customer ledgers created: %', v_customer_ledger_count;
    RAISE NOTICE '  - Supplier ledgers created: %', v_supplier_ledger_count;
    RAISE NOTICE '  - Purchase journal entries created: %', v_purchase_journal_count;
    RAISE NOTICE '  - Sale journal entries created: %', v_sale_journal_count;
    RAISE NOTICE '  - Payment journal entries created: %', v_payment_journal_count;
    RAISE NOTICE '  - Payments fixed (account_id): %', v_payment_account_fix_count;
    RAISE NOTICE '============================================================================';
    
END $$;
