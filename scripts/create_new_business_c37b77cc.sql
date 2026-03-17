-- Create NEW BUSINESS with exact ID for Issue 04 verification (PRIMARY TARGET).
-- Company + branch + default accounts only. Reversible: delete accounts, branches, then company.

DO $$
DECLARE
  v_company_id UUID := 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';
  v_branch_id UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM companies WHERE id = v_company_id) INTO v_exists;
  IF v_exists THEN
    RAISE NOTICE 'Company % already exists', v_company_id;
    RETURN;
  END IF;

  INSERT INTO companies (id, name, email, currency, is_active, created_at, updated_at)
  VALUES (v_company_id, 'New Business', 'newbusiness@example.com', 'PKR', true, NOW(), NOW());

  INSERT INTO branches (id, company_id, name, code, is_active, created_at, updated_at)
  VALUES (gen_random_uuid(), v_company_id, 'Main Branch', 'HQ', true, NOW(), NOW())
  RETURNING id INTO v_branch_id;

  INSERT INTO accounts (id, company_id, code, name, type, balance, is_active, created_at, updated_at)
  SELECT gen_random_uuid(), v_company_id, code, name, type, 0, true, NOW(), NOW()
  FROM (VALUES
    ('1000', 'Cash', 'cash'),
    ('1010', 'Bank', 'bank'),
    ('1020', 'Mobile Wallet', 'mobile_wallet'),
    ('1100', 'Accounts Receivable', 'asset'),
    ('1200', 'Inventory', 'asset'),
    ('2000', 'Accounts Payable', 'liability'),
    ('2010', 'Worker Payable', 'liability'),
    ('4000', 'Sales Revenue', 'revenue'),
    ('5000', 'Cost of Production', 'expense')
  ) AS t(code, name, type)
  WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE company_id = v_company_id AND code = t.code);

  RAISE NOTICE 'Created company %, branch %, default accounts', v_company_id, v_branch_id;
END $$;
