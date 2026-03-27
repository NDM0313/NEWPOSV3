-- Optional backfill: link liquidity leaf accounts under canonical group headers (1000/1010/1020).
-- Safe/idempotent: only sets parent_id when NULL and code is not the header itself.
-- Does not delete data; GL remains journal-derived.

UPDATE public.accounts c
SET parent_id = p.id
FROM public.accounts p
WHERE c.company_id = p.company_id
  AND TRIM(COALESCE(p.code, '')) = '1000'
  AND c.parent_id IS NULL
  AND TRIM(COALESCE(c.code, '')) <> '1000'
  AND LOWER(TRIM(COALESCE(c.type, ''))) = 'cash';

UPDATE public.accounts c
SET parent_id = p.id
FROM public.accounts p
WHERE c.company_id = p.company_id
  AND TRIM(COALESCE(p.code, '')) = '1010'
  AND c.parent_id IS NULL
  AND TRIM(COALESCE(c.code, '')) <> '1010'
  AND LOWER(TRIM(COALESCE(c.type, ''))) = 'bank';

UPDATE public.accounts c
SET parent_id = p.id
FROM public.accounts p
WHERE c.company_id = p.company_id
  AND TRIM(COALESCE(p.code, '')) = '1020'
  AND c.parent_id IS NULL
  AND TRIM(COALESCE(c.code, '')) <> '1020'
  AND LOWER(TRIM(COALESCE(c.type, ''))) IN ('mobile_wallet', 'mobile wallet');

UPDATE public.accounts c
SET parent_id = p.id
FROM public.accounts p
WHERE c.company_id = p.company_id
  AND TRIM(COALESCE(p.code, '')) = '1100'
  AND c.parent_id IS NULL
  AND TRIM(COALESCE(c.code, '')) <> '1100'
  AND LOWER(TRIM(COALESCE(c.type, ''))) = 'receivable';

UPDATE public.accounts c
SET parent_id = p.id
FROM public.accounts p
WHERE c.company_id = p.company_id
  AND TRIM(COALESCE(p.code, '')) = '2000'
  AND c.parent_id IS NULL
  AND TRIM(COALESCE(c.code, '')) <> '2000'
  AND LOWER(TRIM(COALESCE(c.type, ''))) = 'payable'
  AND LOWER(COALESCE(c.name, '')) NOT LIKE '%worker%';
