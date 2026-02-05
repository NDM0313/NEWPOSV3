-- ============================================================================
-- FRESH REAL DATA SEED – NO DUMMY, FULLY LINKED
-- ============================================================================
-- Run in Supabase SQL Editor (test/dev only). Deletes all existing data for
-- the first company, then inserts clean linked data: users, workers, customers,
-- suppliers, products, sales (SL + STD), studio productions, worker jobs,
-- purchases, expenses, and all ledgers.
-- ============================================================================

DO $$
DECLARE
  cid UUID;
  bid UUID;
  uid_admin UUID := gen_random_uuid();
  uid_sales UUID := gen_random_uuid();
  acc_cash UUID := gen_random_uuid();
  acc_bank UUID := gen_random_uuid();
  acc_ar UUID := gen_random_uuid();
  acc_ap UUID := gen_random_uuid();
  acc_sales UUID := gen_random_uuid();
  cat_default UUID := gen_random_uuid();
  p1 UUID := gen_random_uuid();
  p2 UUID := gen_random_uuid();
  p3 UUID := gen_random_uuid();
  p4 UUID := gen_random_uuid();
  c1 UUID := gen_random_uuid();
  c2 UUID := gen_random_uuid();
  c3 UUID := gen_random_uuid();
  c4 UUID := gen_random_uuid();
  c5 UUID := gen_random_uuid();
  c6 UUID := gen_random_uuid();
  s1 UUID := gen_random_uuid();
  s2 UUID := gen_random_uuid();
  w1 UUID := gen_random_uuid();
  w2 UUID := gen_random_uuid();
  w3 UUID := gen_random_uuid();
  w4 UUID := gen_random_uuid();
  w5 UUID := gen_random_uuid();
  w6 UUID := gen_random_uuid();
  sale1 UUID := gen_random_uuid();
  sale2 UUID := gen_random_uuid();
  sale3 UUID := gen_random_uuid();
  sale4 UUID := gen_random_uuid();
  pur1 UUID := gen_random_uuid();
  pur2 UUID := gen_random_uuid();
  prod1 UUID := gen_random_uuid();
  prod2 UUID := gen_random_uuid();
  stage1 UUID := gen_random_uuid();
  stage2 UUID := gen_random_uuid();
  stage3 UUID := gen_random_uuid();
  stage4 UUID := gen_random_uuid();
  stage5 UUID := gen_random_uuid();
  stage6 UUID := gen_random_uuid();
  exp1 UUID := gen_random_uuid();
  exp2 UUID := gen_random_uuid();
  lm_supp1 UUID;
  lm_supp2 UUID;
  lm_user1 UUID;
  lm_user2 UUID;
BEGIN
  -- ----- Get or create company and branch -----
  SELECT id INTO cid FROM companies LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO companies (id, name, email, phone, address, currency, is_active)
    VALUES (gen_random_uuid(), 'Seed Company', 'seed@example.com', '+92 300 1234567', 'Lahore', 'PKR', true)
    RETURNING id INTO cid;
  END IF;

  SELECT id INTO bid FROM branches WHERE company_id = cid LIMIT 1;
  IF bid IS NULL THEN
    INSERT INTO branches (id, company_id, name, code, is_active)
    VALUES (gen_random_uuid(), cid, 'Main Branch', 'BR1', true)
    RETURNING id INTO bid;
  END IF;

  -- ========== DELETE (children first) ==========
  DELETE FROM worker_ledger_entries WHERE company_id = cid;
  DELETE FROM ledger_entries WHERE company_id = cid;
  DELETE FROM ledger_master WHERE company_id = cid;
  DELETE FROM studio_production_stages WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = cid);
  DELETE FROM studio_production_logs WHERE production_id IN (SELECT id FROM studio_productions WHERE company_id = cid);
  DELETE FROM studio_productions WHERE company_id = cid;
  DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE company_id = cid);
  DELETE FROM sales WHERE company_id = cid;
  DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE company_id = cid);
  DELETE FROM payments WHERE company_id = cid;
  DELETE FROM purchases WHERE company_id = cid;
  DELETE FROM expenses WHERE company_id = cid;
  DELETE FROM document_sequences WHERE company_id = cid;
  DELETE FROM workers WHERE company_id = cid;
  DELETE FROM contacts WHERE company_id = cid;
  DELETE FROM products WHERE company_id = cid;
  DELETE FROM product_categories WHERE company_id = cid;
  -- activity_logs and journal_entries reference accounts; delete first
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    DELETE FROM activity_logs WHERE company_id = cid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entry_lines') THEN
    DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = cid);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
    DELETE FROM journal_entries WHERE company_id = cid;
  END IF;
  DELETE FROM accounts WHERE company_id = cid;
  DELETE FROM users WHERE company_id = cid;

  -- ========== MASTER: Users (2) ==========
  INSERT INTO users (id, company_id, email, full_name, role, is_active)
  VALUES
    (uid_admin, cid, 'admin@seed.com', 'Admin User', 'admin', true),
    (uid_sales, cid, 'salesman@seed.com', 'Salesman User', 'staff', true);

  -- ========== MASTER: Accounts (Cash, Bank, AR, AP, Sales) ==========
  INSERT INTO accounts (id, company_id, code, name, type, is_active)
  VALUES
    (acc_cash, cid, '1000', 'Cash', 'asset', true),
    (acc_bank, cid, '1100', 'Bank', 'asset', true),
    (acc_ar, cid, '1200', 'Accounts Receivable', 'asset', true),
    (acc_ap, cid, '2000', 'Accounts Payable', 'liability', true),
    (acc_sales, cid, '4000', 'Sales', 'revenue', true);

  -- ========== MASTER: Product category + Products (4) ==========
  INSERT INTO product_categories (id, company_id, name, is_active)
  VALUES (cat_default, cid, 'General', true);

  INSERT INTO products (id, company_id, category_id, name, sku, cost_price, retail_price, current_stock, is_sellable, track_stock, is_active)
  VALUES
    (p1, cid, cat_default, 'Regular Shirt', 'REG-001', 500, 1200, 50, true, true, true),
    (p2, cid, cat_default, 'Regular Trouser', 'REG-002', 600, 1500, 40, true, true, true),
    (p3, cid, cat_default, 'Studio Kurta', 'STD-001', 800, 2200, 10, true, true, true),
    (p4, cid, cat_default, 'Studio Dupatta', 'STD-002', 400, 1100, 15, true, true, true);

  -- ========== MASTER: Contacts – Customers (6) ==========
  INSERT INTO contacts (id, company_id, branch_id, type, name, phone, email, is_active)
  VALUES
    (c1, cid, bid, 'customer', 'Ali Ahmed', '+92 321 1111111', 'ali@example.com', true),
    (c2, cid, bid, 'customer', 'Sara Khan', '+92 322 2222222', 'sara@example.com', true),
    (c3, cid, bid, 'customer', 'Hassan Raza', '+92 333 3333333', 'hassan@example.com', true),
    (c4, cid, bid, 'customer', 'Fatima Noor', '+92 334 4444444', 'fatima@example.com', true),
    (c5, cid, bid, 'customer', 'Omar Sheikh', '+92 335 5555555', 'omar@example.com', true),
    (c6, cid, bid, 'customer', 'Zainab Malik', '+92 336 6666666', 'zainab@example.com', true);

  -- ========== MASTER: Contacts – Suppliers (2) ==========
  INSERT INTO contacts (id, company_id, branch_id, type, name, phone, is_active)
  VALUES
    (s1, cid, bid, 'supplier', 'Fabric House Ltd', '+92 41 1111111', true),
    (s2, cid, bid, 'supplier', 'Thread & Button Co', '+92 42 2222222', true);

  -- ========== MASTER: Contacts – Workers (6): 2 Dyeing, 2 Stitching, 2 Handwork ==========
  INSERT INTO contacts (id, company_id, branch_id, type, name, phone, worker_role, is_active)
  VALUES
    (w1, cid, bid, 'worker', 'Rashid Dyer', '+92 301 1111111', 'dyeing', true),
    (w2, cid, bid, 'worker', 'Nadeem Dyer', '+92 302 2222222', 'dyeing', true),
    (w3, cid, bid, 'worker', 'Aslam Stitching', '+92 303 3333333', 'stitching', true),
    (w4, cid, bid, 'worker', 'Karim Stitching', '+92 304 4444444', 'stitching', true),
    (w5, cid, bid, 'worker', 'Saima Handwork', '+92 305 5555555', 'handwork', true),
    (w6, cid, bid, 'worker', 'Farida Handwork', '+92 306 6666666', 'handwork', true);
  -- Trigger sync_worker_contact_to_workers will populate workers table with same ids

  -- ========== SALES: 2 Regular (SL-0001, SL-0002) ==========
  INSERT INTO sales (id, company_id, branch_id, invoice_no, invoice_date, customer_id, customer_name, contact_number, type, status, payment_status, subtotal, discount_amount, tax_amount, total, paid_amount, due_amount, is_studio, created_by)
  VALUES
    (sale1, cid, bid, 'SL-0001', CURRENT_DATE - 5, c1, 'Ali Ahmed', '+92 321 1111111', 'invoice', 'final', 'paid', 1200, 0, 0, 1200, 1200, 0, false, uid_sales),
    (sale2, cid, bid, 'SL-0002', CURRENT_DATE - 3, c2, 'Sara Khan', '+92 322 2222222', 'invoice', 'final', 'partial', 2700, 0, 0, 2700, 1500, 1200, false, uid_sales);

  INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, total)
  VALUES
    (sale1, p1, 'Regular Shirt', 'REG-001', 1, 1200, 1200),
    (sale2, p1, 'Regular Shirt', 'REG-001', 1, 1200, 1200),
    (sale2, p2, 'Regular Trouser', 'REG-002', 1, 1500, 1500);

  -- ========== SALES: 2 Studio (STD-0001, STD-0002) ==========
  INSERT INTO sales (id, company_id, branch_id, invoice_no, invoice_date, customer_id, customer_name, contact_number, type, status, payment_status, subtotal, discount_amount, tax_amount, total, paid_amount, due_amount, is_studio, created_by)
  VALUES
    (sale3, cid, bid, 'STD-0001', CURRENT_DATE - 4, c3, 'Hassan Raza', '+92 333 3333333', 'invoice', 'final', 'unpaid', 2200, 0, 0, 2200, 0, 2200, true, uid_sales),
    (sale4, cid, bid, 'STD-0002', CURRENT_DATE - 2, c4, 'Fatima Noor', '+92 334 4444444', 'invoice', 'final', 'unpaid', 3300, 0, 0, 3300, 0, 3300, true, uid_sales);

  INSERT INTO sale_items (sale_id, product_id, product_name, sku, quantity, unit_price, total)
  VALUES
    (sale3, p3, 'Studio Kurta', 'STD-001', 1, 2200, 2200),
    (sale4, p3, 'Studio Kurta', 'STD-001', 1, 2200, 2200),
    (sale4, p4, 'Studio Dupatta', 'STD-002', 1, 1100, 1100);

  -- ========== PAYMENTS for Customer Ledger (SL-0001 full, SL-0002 partial) ==========
  INSERT INTO payments (company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
  VALUES
    (cid, bid, 'received', 'sale', sale1, 1200, 'cash', CURRENT_DATE - 5, acc_cash, 'PAY-0001', uid_sales),
    (cid, bid, 'received', 'sale', sale2, 1500, 'cash', CURRENT_DATE - 3, acc_cash, 'PAY-0002', uid_sales);

  -- ========== STUDIO PRODUCTIONS (linked to STD-0001 and STD-0002) ==========
  INSERT INTO studio_productions (id, company_id, branch_id, sale_id, production_no, production_date, product_id, quantity, unit, estimated_cost, actual_cost, status, created_by)
  VALUES
    (prod1, cid, bid, sale3, 'PRD-0001', CURRENT_DATE - 4, p3, 1, 'piece', 500, 500, 'completed', uid_admin),
    (prod2, cid, bid, sale4, 'PRD-0002', CURRENT_DATE - 2, p3, 1, 'piece', 600, 600, 'completed', uid_admin);

  -- Stages: Dyeing, Stitching, Handwork per production (worker assigned, cost set, completed)
  INSERT INTO studio_production_stages (id, production_id, stage_type, assigned_worker_id, cost, status, completed_at)
  VALUES
    (stage1, prod1, 'dyer', w1, 150, 'completed', NOW() - INTERVAL '3 days'),
    (stage2, prod1, 'stitching', w3, 200, 'completed', NOW() - INTERVAL '2 days'),
    (stage3, prod1, 'handwork', w5, 150, 'completed', NOW() - INTERVAL '1 day'),
    (stage4, prod2, 'dyer', w2, 180, 'completed', NOW() - INTERVAL '2 days'),
    (stage5, prod2, 'stitching', w4, 220, 'completed', NOW() - INTERVAL '1 day'),
    (stage6, prod2, 'handwork', w6, 200, 'completed', NOW());

  -- ========== WORKER LEDGER ENTRIES (JOB-0001 … JOB-0006), some paid ==========
  INSERT INTO worker_ledger_entries (company_id, worker_id, amount, reference_type, reference_id, document_no, notes, status, paid_at, payment_reference)
  VALUES
    (cid, w1, 150, 'studio_production_stage', stage1, 'JOB-0001', 'Studio production PRD-0001 – stage received', 'paid', NOW() - INTERVAL '2 days', 'PAY-0003'),
    (cid, w3, 200, 'studio_production_stage', stage2, 'JOB-0002', 'Studio production PRD-0001 – stage received', 'paid', NOW() - INTERVAL '1 day', 'PAY-0004'),
    (cid, w5, 150, 'studio_production_stage', stage3, 'JOB-0003', 'Studio production PRD-0001 – stage received', 'unpaid', NULL, NULL),
    (cid, w2, 180, 'studio_production_stage', stage4, 'JOB-0004', 'Studio production PRD-0002 – stage received', 'paid', NOW(), 'PAY-0005'),
    (cid, w4, 220, 'studio_production_stage', stage5, 'JOB-0005', 'Studio production PRD-0002 – stage received', 'unpaid', NULL, NULL),
    (cid, w6, 200, 'studio_production_stage', stage6, 'JOB-0006', 'Studio production PRD-0002 – stage received', 'unpaid', NULL, NULL);

  -- Worker payable balance update (optional; app may recalc from ledger)
  UPDATE workers SET current_balance = 350 WHERE id = w5;
  UPDATE workers SET current_balance = 420 WHERE id = w4;
  UPDATE workers SET current_balance = 200 WHERE id = w6;

  -- ========== PURCHASES (PUR-0001, PUR-0002) ==========
  INSERT INTO purchases (id, company_id, branch_id, po_no, po_date, supplier_id, supplier_name, status, payment_status, subtotal, total, paid_amount, due_amount, created_by)
  VALUES
    (pur1, cid, bid, 'PUR-0001', CURRENT_DATE - 6, s1, 'Fabric House Ltd', 'final', 'partial', 10000, 10000, 6000, 4000, uid_admin),
    (pur2, cid, bid, 'PUR-0002', CURRENT_DATE - 4, s2, 'Thread & Button Co', 'final', 'paid', 5000, 5000, 5000, 0, uid_admin);

  INSERT INTO purchase_items (purchase_id, product_id, product_name, sku, quantity, unit_price, total)
  VALUES
    (pur1, p1, 'Regular Shirt', 'REG-001', 20, 500, 10000),
    (pur2, p2, 'Regular Trouser', 'REG-002', 8, 625, 5000);

  -- Payments for purchases
  INSERT INTO payments (company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
  VALUES
    (cid, bid, 'paid', 'purchase', pur1, 6000, 'bank', CURRENT_DATE - 5, acc_bank, 'PAY-0006', uid_admin),
    (cid, bid, 'paid', 'purchase', pur2, 5000, 'cash', CURRENT_DATE - 4, acc_cash, 'PAY-0007', uid_admin);

  -- ========== SUPPLIER LEDGER (ledger_master + ledger_entries) ==========
  INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name) VALUES (cid, 'supplier', s1, 'Fabric House Ltd') RETURNING id INTO lm_supp1;
  INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name) VALUES (cid, 'supplier', s2, 'Thread & Button Co') RETURNING id INTO lm_supp2;

  INSERT INTO ledger_entries (company_id, ledger_id, entry_date, debit, credit, balance_after, source, reference_no, reference_id, remarks)
  VALUES
    (cid, lm_supp1, CURRENT_DATE - 6, 0, 10000, 10000, 'purchase', 'PUR-0001', pur1, 'Purchase'),
    (cid, lm_supp1, CURRENT_DATE - 5, 6000, 0, 4000, 'payment', 'PAY-0006', pur1, 'Payment'),
    (cid, lm_supp2, CURRENT_DATE - 4, 0, 5000, 5000, 'purchase', 'PUR-0002', pur2, 'Purchase'),
    (cid, lm_supp2, CURRENT_DATE - 4, 5000, 0, 0, 'payment', 'PAY-0007', pur2, 'Payment');

  -- ========== EXPENSES (EXP-0001 Salary, EXP-0002 Commission) + User Ledger ==========
  INSERT INTO expenses (id, company_id, branch_id, expense_no, category, amount, expense_date, description, payment_method, account_id, status, paid_to_user_id, created_by)
  VALUES
    (exp1, cid, bid, 'EXP-0001', 'Salary', 25000, CURRENT_DATE - 7, 'Admin salary Jan', 'bank', acc_bank, 'approved', uid_admin, uid_admin),
    (exp2, cid, bid, 'EXP-0002', 'Commission', 2000, CURRENT_DATE - 6, 'Salesman commission', 'cash', acc_cash, 'approved', uid_sales, uid_admin);

  -- User ledger: ledger_master + entries (Salary Debit, Commission Debit, Payment Credit)
  INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name) VALUES (cid, 'user', uid_admin, 'Admin User') RETURNING id INTO lm_user1;
  INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name) VALUES (cid, 'user', uid_sales, 'Salesman User') RETURNING id INTO lm_user2;

  INSERT INTO ledger_entries (company_id, ledger_id, entry_date, debit, credit, balance_after, source, reference_no, reference_id, remarks)
  VALUES
    (cid, lm_user1, CURRENT_DATE - 7, 25000, 0, 25000, 'expense', 'EXP-0001', exp1, 'Salary'),
    (cid, lm_user1, CURRENT_DATE - 6, 0, 25000, 0, 'payment', 'PAY-0008', exp1, 'Salary payment'),
    (cid, lm_user2, CURRENT_DATE - 6, 2000, 0, 2000, 'expense', 'EXP-0002', exp2, 'Commission'),
    (cid, lm_user2, CURRENT_DATE - 5, 0, 2000, 0, 'payment', 'PAY-0009', exp2, 'Commission payment');

  -- Payment records for salary and commission (User Ledger credits)
  INSERT INTO payments (company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, created_by)
  VALUES
    (cid, bid, 'paid', 'expense', exp1, 25000, 'bank', CURRENT_DATE - 6, acc_bank, 'PAY-0008', uid_admin),
    (cid, bid, 'paid', 'expense', exp2, 2000, 'cash', CURRENT_DATE - 5, acc_cash, 'PAY-0009', uid_admin);

  -- ========== DOCUMENT SEQUENCES (next numbers after seed) ==========
  INSERT INTO document_sequences (company_id, branch_id, document_type, prefix, current_number, padding, updated_at)
  VALUES
    (cid, NULL, 'sale', 'SL-', 2, 4, NOW()),
    (cid, NULL, 'studio', 'STD-', 2, 4, NOW()),
    (cid, NULL, 'purchase', 'PUR-', 2, 4, NOW()),
    (cid, NULL, 'expense', 'EXP-', 2, 4, NOW()),
    (cid, NULL, 'payment', 'PAY-', 9, 4, NOW()),
    (cid, NULL, 'job', 'JOB-', 6, 4, NOW()),
    (cid, NULL, 'journal', 'JV-', 1, 4, NOW())
  ON CONFLICT (company_id, branch_id, document_type)
  DO UPDATE SET current_number = EXCLUDED.current_number, updated_at = NOW();

  RAISE NOTICE 'Fresh seed completed. Company: %, Branch: %', cid, bid;
END $$;
