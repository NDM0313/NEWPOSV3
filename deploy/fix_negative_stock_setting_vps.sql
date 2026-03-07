-- Ensure get_user_company_id works for salesman (id OR auth_user_id)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.users
  WHERE id = auth.uid() OR auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Ensure settings table has inventory_settings for the company with negativeStockAllowed = true
-- Company from logs: eb71d817-b87e-4195-964b-7b5321b480f5
INSERT INTO public.settings (company_id, key, value, category, description, updated_at)
VALUES (
  'eb71d817-b87e-4195-964b-7b5321b480f5'::uuid,
  'inventory_settings',
  COALESCE(
    (SELECT value FROM public.settings WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'::uuid AND key = 'inventory_settings' LIMIT 1),
    '{}'::jsonb
  ) || '{"negativeStockAllowed": true}'::jsonb,
  'inventory',
  'Inventory module settings',
  NOW()
)
ON CONFLICT (company_id, key) DO UPDATE SET
  value = COALESCE(settings.value, '{}'::jsonb) || '{"negativeStockAllowed": true}'::jsonb,
  updated_at = NOW();
