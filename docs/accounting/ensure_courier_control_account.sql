-- PF-01: Ensure 2030 Courier Payable (Control) exists for every company.
-- Idempotent: only inserts when missing. Safe to run multiple times.
-- No new tables; uses frozen accounting model (accounts table only).

INSERT INTO accounts (company_id, code, name, type, balance, is_active)
SELECT c.id, '2030', 'Courier Payable (Control)', 'Liability', 0, true
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.company_id = c.id AND a.code = '2030');
