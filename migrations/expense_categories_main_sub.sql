-- ============================================================================
-- EXPENSE CATEGORIES: Main + Sub (parent_id), color, icon
-- ============================================================================
-- parent_id = null → main category (e.g. Utilities, Office)
-- parent_id = id → sub category (e.g. Electricity Bill under Utilities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES expense_categories(id) ON DELETE CASCADE,
  color VARCHAR(50) DEFAULT 'gray',
  icon VARCHAR(50) DEFAULT 'Other',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Slug: lowercase, spaces to underscore (for expenses.category compatibility)
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_company_slug ON expense_categories(company_id, slug);

-- If table already existed without slug, add and backfill (run once)
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
UPDATE expense_categories SET slug = lower(regexp_replace(name, '\s+', '_', 'g')) WHERE slug IS NULL OR slug = '';

CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON expense_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON expense_categories(parent_id);

COMMENT ON TABLE expense_categories IS 'Main and sub categories for expenses; parent_id null = main category';
COMMENT ON COLUMN expense_categories.parent_id IS 'Null = main category; set = sub category under this parent';

-- Optional: link expenses to category by id (run only if your expenses table exists and you want FK)
-- ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_category_id UUID REFERENCES expense_categories(id);
