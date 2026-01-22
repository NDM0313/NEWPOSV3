-- ============================================================================
-- CONTACT GROUPS / CATEGORIES MIGRATION
-- ============================================================================
-- This migration adds contact grouping/categorization feature
-- All changes are ADDITIVE and BACKWARD COMPATIBLE
-- Existing contacts remain unaffected (group_id is NULL by default)
-- ============================================================================

-- Create contact_groups table
CREATE TABLE IF NOT EXISTS contact_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'supplier', 'worker')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name, type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_groups_company_type ON contact_groups(company_id, type);
CREATE INDEX IF NOT EXISTS idx_contact_groups_active ON contact_groups(is_active) WHERE is_active = true;

-- Add optional group_id foreign key to contacts table
-- This is a safe, additive change - existing records will have NULL group_id
DO $$ 
BEGIN
    -- Check if column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'group_id'
    ) THEN
        ALTER TABLE contacts 
        ADD COLUMN group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL;
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts(group_id);
    END IF;
END $$;

-- Add contact_person field for suppliers (optional)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'contact_person'
    ) THEN
        ALTER TABLE contacts 
        ADD COLUMN contact_person VARCHAR(255);
    END IF;
END $$;

-- Insert default groups for existing companies (optional, can be done via UI)
-- This is commented out to avoid auto-creating groups
-- Uncomment if you want default groups for all companies
/*
DO $$
DECLARE
    company_record RECORD;
BEGIN
    FOR company_record IN SELECT id FROM companies LOOP
        -- Customer Groups
        INSERT INTO contact_groups (company_id, name, type, description) VALUES
        (company_record.id, 'Retail', 'customer', 'Retail customers'),
        (company_record.id, 'Wholesale', 'customer', 'Wholesale customers')
        ON CONFLICT (company_id, name, type) DO NOTHING;
        
        -- Supplier Groups
        INSERT INTO contact_groups (company_id, name, type, description) VALUES
        (company_record.id, 'Local', 'supplier', 'Local suppliers'),
        (company_record.id, 'Import', 'supplier', 'Import suppliers'),
        (company_record.id, 'Services', 'supplier', 'Service providers')
        ON CONFLICT (company_id, name, type) DO NOTHING;
        
        -- Worker Groups
        INSERT INTO contact_groups (company_id, name, type, description) VALUES
        (company_record.id, 'Dyeing', 'worker', 'Dyeing workers'),
        (company_record.id, 'Stitching', 'worker', 'Stitching workers'),
        (company_record.id, 'Finishing', 'worker', 'Finishing workers')
        ON CONFLICT (company_id, name, type) DO NOTHING;
    END LOOP;
END $$;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✅ Created contact_groups table (additive)
-- ✅ Added group_id FK to contacts (nullable, safe)
-- ✅ Added contact_person field for suppliers (nullable, safe)
-- ✅ All existing contacts remain unaffected (group_id = NULL)
-- ✅ No breaking changes to existing schema
-- ============================================================================
