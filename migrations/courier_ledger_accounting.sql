-- ============================================================================
-- COURIER LEDGER ACCOUNTING
-- ============================================================================
-- Real-world flow:
--   2030 = Courier Payable (Control)
--   2031, 2032, 2033... = per-courier sub-ledger (TCS Payable, Leopard Payable, etc.)
-- Shipment expense → Cr Courier Payable (specific courier account)
-- Courier payment → Dr Courier Payable (specific) / Cr Cash or Bank
--
-- Safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- PHASE 1 — accounts: contact_id + parent_id for courier sub-ledgers
-- ============================================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_contact_id
  ON accounts (contact_id) WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_parent_id
  ON accounts (parent_id) WHERE parent_id IS NOT NULL;

-- Rename 2030 to "Courier Payable (Control)" and set as control (no direct posting)
UPDATE accounts
SET name = 'Courier Payable (Control)'
WHERE code = '2030' AND (name IS NULL OR name = 'Courier Payable');

-- ============================================================================
-- Get or create courier payable account (2031, 2032, 2033... per contact)
-- Wrapped in DO so migration succeeds when current user is not function owner.
-- ============================================================================

DO $$
BEGIN
  EXECUTE $exec$
CREATE OR REPLACE FUNCTION get_or_create_courier_payable_account(
  p_company_id UUID,
  p_contact_id UUID,
  p_contact_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $body$
DECLARE
  v_control_id UUID;
  v_account_id UUID;
  v_next_code TEXT;
  v_max_suffix INT;
BEGIN
  IF p_company_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_control_id FROM accounts WHERE company_id = p_company_id AND code = '2030' AND is_active = true LIMIT 1;
  IF v_control_id IS NULL THEN
    INSERT INTO accounts (company_id, code, name, type, balance, is_active)
    VALUES (p_company_id, '2030', 'Courier Payable (Control)', 'Liability', 0, true)
    ON CONFLICT (company_id, code) DO NOTHING;
    SELECT id INTO v_control_id FROM accounts WHERE company_id = p_company_id AND code = '2030' LIMIT 1;
  END IF;
  IF p_contact_id IS NOT NULL THEN
    SELECT id INTO v_account_id FROM accounts WHERE company_id = p_company_id AND contact_id = p_contact_id AND is_active = true LIMIT 1;
    IF v_account_id IS NOT NULL THEN RETURN v_account_id; END IF;
  END IF;
  SELECT COALESCE(MAX(CASE WHEN code ~ '^203[0-9]+$' AND LENGTH(code) <= 4 THEN (SUBSTRING(code FROM 4))::INT WHEN code ~ '^203[0-9]+$' THEN (SUBSTRING(code FROM 4))::INT ELSE 0 END), 0) + 1 INTO v_max_suffix
  FROM accounts WHERE company_id = p_company_id AND code ~ '^203[0-9]+$';
  v_next_code := '203' || v_max_suffix::TEXT;
  INSERT INTO accounts (company_id, code, name, type, balance, is_active, parent_id, contact_id)
  VALUES (p_company_id, v_next_code, COALESCE(TRIM(p_contact_name), 'Courier') || ' Payable', 'Liability', 0, true, v_control_id, p_contact_id)
  RETURNING id INTO v_account_id;
  RETURN v_account_id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_account_id FROM accounts WHERE company_id = p_company_id AND contact_id = p_contact_id AND is_active = true LIMIT 1;
  RETURN v_account_id;
END;
$body$;
$exec$;
  EXECUTE 'COMMENT ON FUNCTION get_or_create_courier_payable_account(UUID,UUID,TEXT) IS ''Returns account id for courier payable sub-ledger (2031, 2032...). Creates one per contact if missing.''';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_ledger_accounting: Could not replace get_or_create_courier_payable_account: %', SQLERRM;
END $$;

-- ============================================================================
-- PHASE 5 — Shipment status: allow new lifecycle values
-- ============================================================================
-- Column is VARCHAR(50); no enum change needed. Allowed: Created, Packed,
-- Dispatched, In Transit, Delivered, Returned, Cancelled (plus legacy Pending, Booked).

-- Optional: payment_status on sale_shipments for "paid to courier" tracking
DO $$
BEGIN
  ALTER TABLE sale_shipments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_ledger_accounting: Could not add sale_shipments.payment_status: %', SQLERRM;
END $$;

-- ============================================================================
-- PHASE 6 — Courier Ledger View (date, courier, description, debit, credit, balance)
-- ============================================================================

DO $$
BEGIN
  DROP VIEW IF EXISTS courier_ledger;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $v$
CREATE VIEW courier_ledger AS
SELECT
  je.company_id,
  je.entry_date AS date,
  COALESCE(c.name, a.name) AS courier_name,
  a.id AS account_id,
  a.contact_id AS courier_id,
  je.reference_id AS shipment_id,
  je.reference_type,
  jel.description,
  jel.debit,
  jel.credit,
  SUM(jel.credit - jel.debit) OVER (
    PARTITION BY a.id ORDER BY je.entry_date, je.id, jel.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id AND a.company_id = je.company_id
LEFT JOIN contacts c ON c.id = a.contact_id
WHERE a.contact_id IS NOT NULL
  AND (a.code ~ '^203[0-9]+$' OR a.parent_id IN (SELECT id FROM accounts WHERE code = '2030'));
$v$;
  GRANT SELECT ON courier_ledger TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_ledger_accounting: Could not create courier_ledger view: %', SQLERRM;
END $$;

-- ============================================================================
-- PHASE 7 — Courier Summary Report (RPC or view)
-- ============================================================================

DO $$
BEGIN
  DROP VIEW IF EXISTS courier_summary;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE $v$
CREATE VIEW courier_summary AS
SELECT
  a.company_id,
  a.id AS courier_account_id,
  a.contact_id AS courier_id,
  COALESCE(c.name, a.name) AS courier_name,
  (SELECT COUNT(DISTINCT je.reference_id) FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
   WHERE jel.account_id = a.id AND je.reference_type = 'shipment') AS total_shipments,
  (SELECT COALESCE(SUM(jel.credit), 0) FROM journal_entry_lines jel
   JOIN journal_entries je ON je.id = jel.journal_entry_id
   WHERE jel.account_id = a.id) AS total_expense,
  (SELECT COALESCE(SUM(jel.debit), 0) FROM journal_entry_lines jel
   JOIN journal_entries je ON je.id = jel.journal_entry_id
   WHERE jel.account_id = a.id) AS total_paid,
  (SELECT COALESCE(SUM(jel.credit - jel.debit), 0) FROM journal_entry_lines jel
   JOIN journal_entries je ON je.id = jel.journal_entry_id
   WHERE jel.account_id = a.id) AS balance_due
FROM accounts a
LEFT JOIN contacts c ON c.id = a.contact_id
WHERE a.contact_id IS NOT NULL
  AND (a.code ~ '^203[0-9]+$' OR a.parent_id IN (SELECT id FROM accounts WHERE code = '2030'));
$v$;
  GRANT SELECT ON courier_summary TO authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_ledger_accounting: Could not create courier_summary view: %', SQLERRM;
END $$;

-- ============================================================================
-- PHASE 10 — Indexes
-- ============================================================================

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_sale_shipments_courier_id ON sale_shipments (courier_id) WHERE courier_id IS NOT NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'courier_ledger_accounting: Could not create idx_sale_shipments_courier_id: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference_type_id
  ON journal_entries (reference_type, reference_id);
