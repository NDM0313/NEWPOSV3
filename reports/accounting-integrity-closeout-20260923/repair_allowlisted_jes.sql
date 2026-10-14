-- Allowlisted unbalanced JE integrity repair — DIN CHINA + DIN BRIDAL only.
-- DO NOT run against DIN COLLECTION. DO NOT broaden allowlist.
-- Generated for run_id: 20260923-unbalanced-je-closeout
--
-- Prerequisites: fresh backup /root/backups/newposv3/20260923-005428
-- Apply inside a single transaction; verify fingerprints before COMMIT.

BEGIN;

-- Guard: refuse if any non-allowlisted mutation attempted (defense via WHERE ids)

-- ============================================================================
-- 1) DIN BRIDAL ACTIVE — fix zero COGS debit (match Inventory credit)
-- ============================================================================
UPDATE journal_entry_lines
SET debit = 7995.00,
    credit = 0.00
WHERE id = '093caac9-c2cc-4636-a5e3-a2de114efeb5'
  AND journal_entry_id = 'f1bda1df-2dc9-474a-9447-08d569863ae9'
  AND debit = 0
  AND credit = 0;

UPDATE journal_entry_lines
SET debit = 5625.00,
    credit = 0.00
WHERE id = '972ed0e4-1f41-4388-ba55-042ba9207459'
  AND journal_entry_id = 'bdebfa9a-66a0-482c-8699-4a46fab752da'
  AND debit = 0
  AND credit = 0;

-- ============================================================================
-- 2) DIN BRIDAL VOID — SL-0013 / SL-0015: raise Sales revenue to match live/subtotal
-- ============================================================================
UPDATE journal_entry_lines
SET credit = 39000.00
WHERE id = 'af6798de-130a-4ac7-b04f-b0739ddf9a2b'
  AND journal_entry_id = 'ec281abf-e4e1-40ee-bafe-8f4d4f300a63'
  AND credit = 38000.00;

UPDATE journal_entry_lines
SET credit = 39000.00
WHERE id = 'ad52d499-d4fa-4e4a-a324-14aa33b245c1'
  AND journal_entry_id = 'e0712d12-3248-415c-84e1-d8f295aefcda'
  AND credit = 38000.00;

UPDATE journal_entry_lines
SET credit = 15300.00
WHERE id = 'bd82ef18-a355-46b4-8f82-e8d6a449fe52'
  AND journal_entry_id = 'ef161c9d-fc5d-45f6-b157-055468d49f4c'
  AND credit = 14600.00;

-- ============================================================================
-- 3) DIN BRIDAL VOID — SL-0021 / SL-0041: remove duplicate Extra Service credits
--    Keep consolidated "Extra Service Income – SLxxxx" line; delete charge duplicates.
-- ============================================================================
DELETE FROM journal_entry_lines
WHERE id IN (
  '31b88459-23b1-49d3-9bfb-0e14e8467a81', -- SL-0021 Ali stitching duplicate
  '24adf051-d230-43b1-8108-50fbb9d11fb3', -- SL-0021 Tailor lining duplicate
  '53cae292-7b9d-4854-bca0-9002743d3c31', -- SL-0041 Rashid stitching duplicate
  '32bdf879-2648-480c-9c52-00e082e26a76'  -- SL-0041 Tailor lining duplicate
)
AND journal_entry_id IN (
  'b3acd30e-d87a-48d0-9051-b4de3e245679',
  'f5757490-0470-4f9e-b7c5-623f0bfa398c'
);

-- ============================================================================
-- 4) DIN CHINA VOID — PUR-0004 orphan reversal: add missing Cr Inventory 190
-- ============================================================================
INSERT INTO journal_entry_lines (
  id, journal_entry_id, account_id, debit, credit, description
) VALUES (
  'a1c4e901-0923-4001-8001-55b744a8c001',
  '55b744a8-80fb-476f-8203-862bc7a499b9',
  '250bbcfc-3f85-4614-879c-5be749399810', -- 1200 Inventory DIN CHINA
  0.00,
  190.00,
  'Reverse Inventory — PUR-0004 (historical integrity repair 20260923)'
);

-- ============================================================================
-- Verify allowlisted JEs are balanced (abort if not)
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  bad INT := 0;
BEGIN
  FOR r IN
    SELECT je.id,
           ROUND((SUM(jel.debit)-SUM(jel.credit))::numeric,2) AS diff
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    WHERE je.id IN (
      '55b744a8-80fb-476f-8203-862bc7a499b9',
      'f1bda1df-2dc9-474a-9447-08d569863ae9',
      'bdebfa9a-66a0-482c-8699-4a46fab752da',
      'f5757490-0470-4f9e-b7c5-623f0bfa398c',
      'b3acd30e-d87a-48d0-9051-b4de3e245679',
      'ec281abf-e4e1-40ee-bafe-8f4d4f300a63',
      'e0712d12-3248-415c-84e1-d8f295aefcda',
      'ef161c9d-fc5d-45f6-b157-055468d49f4c'
    )
    GROUP BY je.id
  LOOP
    IF ABS(r.diff) > 0.009 THEN
      RAISE NOTICE 'STILL_UNBALANCED % diff=%', r.id, r.diff;
      bad := bad + 1;
    END IF;
  END LOOP;
  IF bad > 0 THEN
    RAISE EXCEPTION 'Repair verification failed: % JE(s) still unbalanced', bad;
  END IF;
END $$;

-- Caller decides COMMIT or ROLLBACK after external fingerprint checks.
-- COMMIT;
