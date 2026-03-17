-- PF-04: One-time backfill – ensure Owner Capital (3000) and Retained Earnings (3002) exist for NEW and OLD business.
-- Run in Supabase SQL Editor. Idempotent (INSERT ... ON CONFLICT DO NOTHING or IF NOT EXISTS).
-- NEW BUSINESS: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee
-- OLD BUSINESS: eb71d817-b87e-4195-964b-7b5321b480f5

INSERT INTO accounts (company_id, code, name, type, balance, is_active)
VALUES ('c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee', '3000', 'Owner Capital', 'equity', 0, true)
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, balance, is_active)
VALUES ('c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee', '3002', 'Retained Earnings', 'equity', 0, true)
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, balance, is_active)
VALUES ('eb71d817-b87e-4195-964b-7b5321b480f5', '3000', 'Owner Capital', 'equity', 0, true)
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO accounts (company_id, code, name, type, balance, is_active)
VALUES ('eb71d817-b87e-4195-964b-7b5321b480f5', '3002', 'Retained Earnings', 'equity', 0, true)
ON CONFLICT (company_id, code) DO NOTHING;
