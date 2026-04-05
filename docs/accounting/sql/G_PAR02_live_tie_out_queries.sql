-- G-PAR-02 live tie-out — run in Supabase SQL Editor (replace :company_id and optional :branch_id).
-- After applying migrations:
--   20260405_gl_party_correction_reversal_and_unmapped_buckets.sql
--   20260406_gl_party_resolve_payment_via_sale_purchase.sql

-- 1) Confirm resolver function revision (presence of _gl_party_id_from_payment_row)
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    '_gl_party_id_from_payment_row',
    '_gl_resolve_party_id_for_journal_entry',
    'get_contact_party_gl_balances',
    'get_control_unmapped_party_gl_buckets'
  )
ORDER BY 1;

-- 2) Control totals vs party sum vs unmapped buckets (AR example; branch filter NULL = all)
-- SELECT * FROM get_contact_party_gl_balances('00000000-0000-0000-0000-000000000001'::uuid, NULL);
-- SELECT * FROM get_control_unmapped_party_gl_buckets('00000000-0000-0000-0000-000000000001'::uuid, NULL, '1100');

-- 3) Sample: AR lines on code 1100 where resolver returns NULL party (should shrink after 20260406)
-- WITH ar AS (
--   SELECT a.id
--   FROM accounts a
--   WHERE a.company_id = '...'::uuid AND trim(coalesce(a.code,'')) = '1100' AND coalesce(a.is_active, true)
--   LIMIT 1
-- )
-- SELECT je.reference_type, je.payment_id, je.reference_id,
--        COUNT(*) AS line_count,
--        SUM(jel.debit - jel.credit) AS net_dr_minus_cr
-- FROM journal_entry_lines jel
-- JOIN journal_entries je ON je.id = jel.journal_entry_id
-- CROSS JOIN ar
-- WHERE jel.account_id = ar.id
--   AND je.company_id = '...'::uuid
--   AND coalesce(je.is_void, false) = false
--   AND _gl_resolve_party_id_for_journal_entry('...'::uuid, je.id) IS NULL
-- GROUP BY 1, 2, 3
-- ORDER BY ABS(SUM(jel.debit - jel.credit)) DESC
-- LIMIT 30;

-- 4) Resolve contact UUIDs by name for reconciliation rows
-- SELECT id, name, type FROM contacts WHERE company_id = '...'::uuid AND name ILIKE '%Ali%' LIMIT 20;

-- 5) AP / worker control codes — same bucket RPC, different net convention in function (1100/1180 Dr−Cr; 2000/2010 Cr−Dr)
-- SELECT * FROM get_control_unmapped_party_gl_buckets('<company_id>'::uuid, NULL, '2000');
-- SELECT * FROM get_control_unmapped_party_gl_buckets('<company_id>'::uuid, NULL, '2010');
-- SELECT * FROM get_control_unmapped_party_gl_buckets('<company_id>'::uuid, NULL, '1180');
-- Party balances: gl_ap_payable / gl_worker_payable columns from get_contact_party_gl_balances (worker column is WP−WA net, not 2010-only).
