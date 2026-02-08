-- ============================================================================
-- ADD SYSTEM FLAGS TO CONTACTS TABLE
-- ============================================================================
-- Purpose: Support system-generated contacts (e.g., "Walking Customer")
-- ============================================================================

-- Add system flags columns
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS system_type TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contacts.is_system_generated IS 'Indicates if this contact was auto-created by the system';
COMMENT ON COLUMN contacts.system_type IS 'Type of system contact (e.g., "walking_customer")';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_contacts_system_type 
ON contacts (company_id, branch_id, system_type) 
WHERE system_type IS NOT NULL;

-- Add constraint to ensure system_type is set when is_system_generated is true
ALTER TABLE contacts
ADD CONSTRAINT check_system_type_when_generated 
CHECK (
  (is_system_generated = FALSE) OR 
  (is_system_generated = TRUE AND system_type IS NOT NULL)
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
