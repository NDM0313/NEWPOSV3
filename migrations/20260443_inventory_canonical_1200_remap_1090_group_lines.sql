-- Canonical inventory asset = **1200** (leaf). Chart **1090** is the inventory **group** header only.
-- Some flows matched "Inventory" by name and posted to the **1090** row. Remap those lines to **1200**
-- and relabel 1090 for operators. Does not delete accounts or void JEs.

BEGIN;

-- 1) Relabel group 1090 (keep row active for hierarchy; clarify it is not a posting target)
UPDATE public.accounts a
SET
  name = 'Inventory (group — post to 1200)',
  description = CASE
    WHEN a.description IS NULL OR trim(a.description::text) = '' THEN
      'COA section header only. All inventory asset postings use account 1200.'
    ELSE left(a.description::text, 2000)
  END
WHERE trim(coalesce(a.code, '')) = '1090'
  AND coalesce(a.is_group, false) = true;

-- 2) Remap journal lines posted to the **1090 group** id → **1200** leaf (same company)
UPDATE public.journal_entry_lines jel
SET account_id = leaf.id
FROM public.accounts bad
JOIN public.accounts leaf
  ON leaf.company_id = bad.company_id
  AND trim(coalesce(leaf.code, '')) = '1200'
  AND coalesce(leaf.is_group, false) = false
WHERE jel.account_id = bad.id
  AND trim(coalesce(bad.code, '')) = '1090'
  AND coalesce(bad.is_group, false) = true
  AND bad.id <> leaf.id;

-- 3) Rare: duplicate leaf wrongly coded 1090 (non-group) → 1200 if both exist
UPDATE public.journal_entry_lines jel
SET account_id = leaf.id
FROM public.accounts bad
JOIN public.accounts leaf
  ON leaf.company_id = bad.company_id
  AND trim(coalesce(leaf.code, '')) = '1200'
  AND coalesce(leaf.is_group, false) = false
WHERE jel.account_id = bad.id
  AND trim(coalesce(bad.code, '')) = '1090'
  AND coalesce(bad.is_group, false) = false
  AND bad.id <> leaf.id;

COMMIT;
