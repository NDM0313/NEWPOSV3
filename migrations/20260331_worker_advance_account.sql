-- ============================================================================
-- WORKER ADVANCE (1180) – Asset for prepayments before stage billing
-- ============================================================================
-- Posting: Dr 1180 Cr Cash when paying worker before bill; after Dr 5000 Cr 2010,
-- app posts Dr 2010 Cr 1180 (worker_advance_settlement) up to bill amount.
-- Safe to run multiple times (NOT EXISTS per company).
-- ============================================================================

INSERT INTO accounts (company_id, code, name, type, balance, is_active)
SELECT c.company_id, '1180', 'Worker Advance', 'asset', 0, true
FROM (SELECT DISTINCT company_id FROM accounts WHERE company_id IS NOT NULL) c
WHERE NOT EXISTS (
  SELECT 1 FROM accounts x WHERE x.company_id = c.company_id AND x.code = '1180'
);

-- Companies that have no rows in accounts yet
DO $$
BEGIN
  INSERT INTO accounts (company_id, code, name, type, balance, is_active)
  SELECT co.id, '1180', 'Worker Advance', 'asset', 0, true
  FROM companies co
  WHERE NOT EXISTS (SELECT 1 FROM accounts x WHERE x.company_id = co.id AND x.code = '1180');
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'companies table not found – skipped second Worker Advance insert';
END $$;
