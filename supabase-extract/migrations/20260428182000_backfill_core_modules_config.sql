-- Backfill core modules_config rows for legacy companies.
-- Purpose: prevent missing sidebar modules when rows were never seeded.

WITH core_modules AS (
  SELECT unnest(ARRAY['sales', 'purchases', 'expenses', 'reports']) AS module_name
)
INSERT INTO public.modules_config (company_id, module_name, is_enabled, created_at, updated_at)
SELECT c.id, m.module_name, true, NOW(), NOW()
FROM public.companies c
CROSS JOIN core_modules m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.modules_config mc
  WHERE mc.company_id = c.id
    AND mc.module_name = m.module_name
);
