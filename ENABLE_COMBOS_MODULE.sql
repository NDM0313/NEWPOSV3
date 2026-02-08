-- ============================================================================
-- ENABLE COMBOS MODULE
-- ============================================================================
-- This script enables the combos module for all companies
-- Run this after applying the create_product_combos_tables migration
-- ============================================================================

-- Enable combos module for all companies
INSERT INTO modules_config (company_id, module_name, is_enabled)
SELECT id, 'combos', true
FROM companies
ON CONFLICT (company_id, module_name) 
DO UPDATE SET is_enabled = true, updated_at = NOW();

-- Verify it was enabled
SELECT 
  mc.company_id,
  c.name as company_name,
  mc.module_name,
  mc.is_enabled,
  mc.created_at
FROM modules_config mc
JOIN companies c ON c.id = mc.company_id
WHERE mc.module_name = 'combos'
ORDER BY mc.created_at DESC;

-- ============================================================================
-- ALTERNATIVE: Enable for specific company only
-- ============================================================================
-- Replace 'YOUR-COMPANY-ID-HERE' with actual UUID from companies table
-- 
-- INSERT INTO modules_config (company_id, module_name, is_enabled)
-- VALUES ('YOUR-COMPANY-ID-HERE', 'combos', true)
-- ON CONFLICT (company_id, module_name) 
-- DO UPDATE SET is_enabled = true, updated_at = NOW();
-- ============================================================================
