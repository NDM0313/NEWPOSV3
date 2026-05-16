-- Backfill modules_config rows used by erp-mobile-app (same keys as web Module Toggles).
-- Safe to run multiple times. New companies get POS/Rental/Studio/Accounting enabled by default.

WITH mobile_modules AS (
  SELECT unnest(ARRAY['pos', 'rentals', 'studio', 'accounting']) AS module_name
)
INSERT INTO public.modules_config (company_id, module_name, is_enabled, created_at, updated_at)
SELECT c.id, m.module_name, true, NOW(), NOW()
FROM public.companies c
CROSS JOIN mobile_modules m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.modules_config mc
  WHERE mc.company_id = c.id
    AND mc.module_name = m.module_name
);
