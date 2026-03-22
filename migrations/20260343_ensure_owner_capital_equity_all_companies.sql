-- Opening-balance GL offset: ensure code 3000 (Owner Capital) exists for every company.
-- Idempotent. Fixes companies that never ran full COA seed / missing equity row.
-- Safe if accounts has no unique on (company_id, code): uses NOT EXISTS only.

INSERT INTO public.accounts (company_id, code, name, type, balance, is_active)
SELECT x.company_id, '3000', 'Owner Capital', 'equity', 0, true
FROM (
  SELECT c.id AS company_id FROM public.companies c
  UNION
  SELECT DISTINCT a.company_id FROM public.accounts a WHERE a.company_id IS NOT NULL
) x
WHERE NOT EXISTS (
  SELECT 1
  FROM public.accounts a
  WHERE a.company_id = x.company_id
    AND trim(coalesce(a.code, '')) = '3000'
);
