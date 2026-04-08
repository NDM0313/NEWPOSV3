-- DEPRECATED — do not redefine get_contact_balances_summary here.
-- Dated migrations (e.g. 20260411_get_contact_balances_summary_branch_parity.sql) own this RPC.
-- This file previously ran *after* all numeric-prefix migrations and overwrote newer logic.
SELECT 1;
