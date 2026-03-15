-- supplier_ledger_backfill_historical.sql
-- One-off: Create ledger_master + ledger_entries for existing purchases and purchase-linked payments
-- so Supplier Ledger shows historical data. Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Run in Supabase SQL Editor. Idempotent: only inserts where ledger_master doesn't exist for supplier.

DO $$
DECLARE
  v_company_id UUID := 'eb71d817-b87e-4195-964b-7b5321b480f5';
  v_ledger_id UUID;
  v_supplier_id UUID;
  v_supplier_name TEXT;
  v_prev_balance NUMERIC := 0;
  v_pur RECORD;
  v_pay RECORD;
BEGIN
  FOR v_supplier_id, v_supplier_name IN
    SELECT DISTINCT pur.supplier_id, MAX(pur.supplier_name)
    FROM purchases pur
    WHERE pur.company_id = v_company_id AND pur.supplier_id IS NOT NULL
    GROUP BY pur.supplier_id
  LOOP
    INSERT INTO ledger_master (company_id, ledger_type, entity_id, entity_name, opening_balance, updated_at)
    VALUES (v_company_id, 'supplier', v_supplier_id, v_supplier_name, 0, NOW())
    ON CONFLICT (company_id, ledger_type, entity_id) DO NOTHING;
  END LOOP;

  FOR v_ledger_id, v_supplier_id IN
    SELECT lm.id, lm.entity_id
    FROM ledger_master lm
    WHERE lm.company_id = v_company_id AND lm.ledger_type = 'supplier'
  LOOP
    v_prev_balance := 0;

    FOR v_pur IN
      SELECT pur.id, pur.po_date, pur.po_no, pur.total, pur.status
      FROM purchases pur
      WHERE pur.company_id = v_company_id AND pur.supplier_id = v_supplier_id
      ORDER BY pur.po_date, pur.created_at
    LOOP
      INSERT INTO ledger_entries (company_id, ledger_id, entry_date, debit, credit, balance_after, source, reference_no, reference_id, remarks)
      SELECT v_company_id, v_ledger_id, v_pur.po_date, 0, COALESCE(v_pur.total, 0),
        v_prev_balance + (0 - COALESCE(v_pur.total, 0)),
        'purchase', v_pur.po_no, v_pur.id,
        'Purchase ' || COALESCE(v_pur.po_no, '')
      WHERE NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.ledger_id = v_ledger_id AND le.source = 'purchase' AND le.reference_id = v_pur.id);
      v_prev_balance := v_prev_balance + (0 - COALESCE(v_pur.total, 0));
    END LOOP;

    FOR v_pay IN
      SELECT p.id, p.payment_date, p.amount, p.reference_number, p.reference_id AS purchase_id
      FROM payments p
      WHERE p.company_id = v_company_id AND p.reference_type = 'purchase' AND p.payment_type = 'paid'
        AND p.reference_id IN (SELECT id FROM purchases WHERE company_id = v_company_id AND supplier_id = v_supplier_id)
      ORDER BY p.payment_date, p.created_at
    LOOP
      INSERT INTO ledger_entries (company_id, ledger_id, entry_date, debit, credit, balance_after, source, reference_no, reference_id, remarks)
      SELECT v_company_id, v_ledger_id, v_pay.payment_date, COALESCE(v_pay.amount::NUMERIC, 0), 0,
        v_prev_balance + (COALESCE(v_pay.amount::NUMERIC, 0) - 0),
        'payment', COALESCE(v_pay.reference_number, ''), v_pay.purchase_id,
        'Payment ' || COALESCE(v_pay.reference_number, '')
      WHERE NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.ledger_id = v_ledger_id AND le.source = 'payment' AND le.reference_id = v_pay.purchase_id);
      v_prev_balance := v_prev_balance + (COALESCE(v_pay.amount::NUMERIC, 0) - 0);
    END LOOP;
  END LOOP;
END $$;
