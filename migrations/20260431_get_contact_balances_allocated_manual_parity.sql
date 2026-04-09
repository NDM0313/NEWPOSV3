-- NO-OP (keep filename for migration history): this file used to define an intermediate
-- get_contact_balances_summary variant (NOT EXISTS on payment_allocations for sale/purchase links).
--
-- Canonical operational RPC is defined only in:
--   20260430_get_contact_balances_operational_recv_pay_parity.sql
--   20260431_get_contact_balances_unallocated_payment_subtract.sql  (final body: amount − SUM(allocated_amount))
--
-- Re-applying a second CREATE OR REPLACE in the same version bucket risked confusion; fresh deploys must
-- end on unallocated_payment_subtract only.

DO $$ BEGIN NULL; END $$;
