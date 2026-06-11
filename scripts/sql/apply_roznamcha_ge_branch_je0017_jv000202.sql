-- Targeted branch backfill for JE-0017 (general) and JV-000202 (journal) — null branch_id on JE + payment.
-- HQ Main Branch for company 597a5292-14c8-4cd8-96bd-c61b5a0d8c92 (inferred from recent payments).
-- Run after diag_roznamcha_general_entry_je0017_jv000202.sql confirms null branch_id.

-- 1) Set branch on the two general/journal entries (company Din Collection)
UPDATE journal_entries je
SET branch_id = 'cc920703-97a0-43a4-95d4-9262996c2af7'
WHERE je.id IN (
  'e0749ae0-ca21-44e1-88f1-2852eb3534e5',  -- JE-0017 general 2026-06-09
  '50f52a37-9e1b-4302-acb4-204eebcb0718'   -- JV-000202 journal 2026-06-11
)
AND je.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
AND je.branch_id IS NULL;

-- 2) Set branch on linked payments
UPDATE payments p
SET branch_id = 'cc920703-97a0-43a4-95d4-9262996c2af7'
WHERE p.id IN (
  '7c38be43-d24f-4f91-86ed-f1901006fa1c',  -- JE-0017 payment
  '3f9a9c11-969f-4829-98fa-db53eb711c3e'   -- JV-000202 payment
)
AND p.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92'
AND p.branch_id IS NULL;

-- 3) Broader pass: manual liquidity payments with null branch, copy from JE when JE now has branch
UPDATE payments p
SET branch_id = je.branch_id
FROM journal_entries je
WHERE p.branch_id IS NULL
  AND p.voided_at IS NULL
  AND p.reference_type IN ('manual_receipt', 'manual_payment')
  AND je.id::text = p.reference_id::text
  AND je.branch_id IS NOT NULL
  AND p.company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92';
