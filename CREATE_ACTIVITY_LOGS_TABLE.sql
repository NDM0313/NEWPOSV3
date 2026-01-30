-- ============================================================================
-- ACTIVITY LOGS TABLE - Detailed Audit Trail for Admin
-- ============================================================================
-- This table tracks all user actions with detailed information:
-- - Who performed the action (user name + ID)
-- - What changed (field, old value, new value)
-- - When it happened
-- - Module and entity reference
-- ============================================================================

-- Drop existing table if exists (for migration)
DROP TABLE IF EXISTS activity_logs CASCADE;

-- Create activity_logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Module and Entity Reference
  module VARCHAR(50) NOT NULL, -- 'sale', 'purchase', 'inventory', 'payment', 'expense', 'accounting'
  entity_id UUID NOT NULL, -- sale_id, purchase_id, payment_id, etc.
  entity_reference VARCHAR(100), -- 'SL-0017', 'PO-0021', 'PAY-2026-0001' (for easy lookup)
  
  -- Action Details
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'payment', 'status_change', 'payment_added', 'payment_deleted'
  field VARCHAR(100), -- 'unit_price', 'status', 'quantity', 'payment_method' (optional, for field-level changes)
  old_value JSONB, -- Old value (can be string, number, object)
  new_value JSONB, -- New value (can be string, number, object)
  
  -- Payment-specific fields
  amount DECIMAL(15, 2), -- For payment actions
  payment_method VARCHAR(50), -- 'cash', 'bank', 'card', 'other'
  payment_account_id UUID REFERENCES accounts(id), -- Account used for payment
  
  -- User Information
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- user_id
  performed_by_name VARCHAR(255), -- User's full name (denormalized for quick access)
  performed_by_email VARCHAR(255), -- User's email (denormalized)
  
  -- Additional Context
  description TEXT, -- Human-readable description of the action
  notes TEXT, -- Additional notes or context
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT activity_logs_module_check CHECK (module IN ('sale', 'purchase', 'inventory', 'payment', 'expense', 'accounting', 'contact', 'product'))
);

-- Create indexes for fast queries
CREATE INDEX idx_activity_logs_company ON activity_logs(company_id);
CREATE INDEX idx_activity_logs_module ON activity_logs(module);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_id);
CREATE INDEX idx_activity_logs_entity_reference ON activity_logs(entity_reference);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_performed_by ON activity_logs(performed_by);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_module_entity ON activity_logs(module, entity_id);

-- Composite index for common queries (module + entity + date range)
CREATE INDEX idx_activity_logs_module_entity_date ON activity_logs(module, entity_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin/Owner can view all logs for their company
CREATE POLICY "Admin can view all activity logs"
  ON activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.company_id = activity_logs.company_id
        AND users.role IN ('admin', 'owner')
    )
  );

-- Authenticated users can insert logs (for system tracking)
CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.company_id = activity_logs.company_id
    )
  );

-- Only admins can delete logs (for cleanup)
CREATE POLICY "Admin can delete activity logs"
  ON activity_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.company_id = activity_logs.company_id
        AND users.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- HELPER FUNCTION: Log Activity
-- ============================================================================
-- This function makes it easy to log activities from triggers or application code
CREATE OR REPLACE FUNCTION log_activity(
  p_company_id UUID,
  p_module VARCHAR(50),
  p_entity_id UUID,
  p_entity_reference VARCHAR(100),
  p_action VARCHAR(50),
  p_field VARCHAR(100) DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_amount DECIMAL(15, 2) DEFAULT NULL,
  p_payment_method VARCHAR(50) DEFAULT NULL,
  p_payment_account_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_name VARCHAR(255);
  v_user_email VARCHAR(255);
  v_log_id UUID;
BEGIN
  -- Get user name and email if user_id provided
  IF p_performed_by IS NOT NULL THEN
    SELECT full_name, email INTO v_user_name, v_user_email
    FROM users
    WHERE id = p_performed_by;
  ELSE
    -- Try to get from auth.uid()
    SELECT full_name, email INTO v_user_name, v_user_email
    FROM users
    WHERE id = auth.uid();
  END IF;
  
  -- Insert activity log
  INSERT INTO activity_logs (
    company_id,
    module,
    entity_id,
    entity_reference,
    action,
    field,
    old_value,
    new_value,
    amount,
    payment_method,
    payment_account_id,
    performed_by,
    performed_by_name,
    performed_by_email,
    description,
    notes
  ) VALUES (
    p_company_id,
    p_module,
    p_entity_id,
    p_entity_reference,
    p_action,
    p_field,
    p_old_value,
    p_new_value,
    p_amount,
    p_payment_method,
    p_payment_account_id,
    COALESCE(p_performed_by, auth.uid()),
    v_user_name,
    v_user_email,
    p_description,
    p_notes
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Auto-log Purchase Updates
-- ============================================================================
CREATE OR REPLACE FUNCTION log_purchase_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_po_no VARCHAR(100);
  v_description TEXT;
BEGIN
  -- Get PO number for reference
  v_po_no := COALESCE(NEW.po_no, OLD.po_no, 'N/A');
  
  IF TG_OP = 'INSERT' THEN
    -- Log purchase creation
    PERFORM log_activity(
      NEW.company_id,
      'purchase',
      NEW.id,
      v_po_no,
      'create',
      NULL,
      NULL,
      row_to_json(NEW)::JSONB,
      NULL,
      NULL,
      NULL,
      NEW.created_by,
      'Purchase Order Created',
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log field-level changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_activity(
        NEW.company_id,
        'purchase',
        NEW.id,
        v_po_no,
        'status_change',
        'status',
        to_jsonb(OLD.status),
        to_jsonb(NEW.status),
        NULL,
        NULL,
        NULL,
        auth.uid(),
        format('Status changed from %s to %s', OLD.status, NEW.status),
        NULL
      );
    END IF;
    
    IF OLD.total IS DISTINCT FROM NEW.total THEN
      PERFORM log_activity(
        NEW.company_id,
        'purchase',
        NEW.id,
        v_po_no,
        'update',
        'total',
        to_jsonb(OLD.total),
        to_jsonb(NEW.total),
        NULL,
        NULL,
        NULL,
        auth.uid(),
        format('Total changed from Rs %s to Rs %s', OLD.total, NEW.total),
        NULL
      );
    END IF;
    
    IF OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      PERFORM log_activity(
        NEW.company_id,
        'purchase',
        NEW.id,
        v_po_no,
        'update',
        'paid_amount',
        to_jsonb(OLD.paid_amount),
        to_jsonb(NEW.paid_amount),
        NULL,
        NULL,
        NULL,
        auth.uid(),
        format('Paid amount changed from Rs %s to Rs %s', OLD.paid_amount, NEW.paid_amount),
        NULL
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Log purchase deletion
    PERFORM log_activity(
      OLD.company_id,
      'purchase',
      OLD.id,
      v_po_no,
      'delete',
      NULL,
      row_to_json(OLD)::JSONB,
      NULL,
      NULL,
      NULL,
      NULL,
      auth.uid(),
      'Purchase Order Deleted',
      NULL
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for purchases
DROP TRIGGER IF EXISTS trigger_log_purchase_activity ON purchases;
CREATE TRIGGER trigger_log_purchase_activity
  AFTER INSERT OR UPDATE OR DELETE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION log_purchase_activity();

-- ============================================================================
-- TRIGGER: Auto-log Payment Activities
-- ============================================================================
CREATE OR REPLACE FUNCTION log_payment_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_reference VARCHAR(100);
  v_description TEXT;
BEGIN
  -- Get reference number
  v_reference := COALESCE(NEW.reference_number, OLD.reference_number, 'N/A');
  
  IF TG_OP = 'INSERT' THEN
    -- Log payment addition
    PERFORM log_activity(
      NEW.company_id,
      'payment',
      NEW.id,
      v_reference,
      'payment_added',
      NULL,
      NULL,
      row_to_json(NEW)::JSONB,
      NEW.amount,
      NEW.payment_method::VARCHAR(50),
      NEW.payment_account_id,
      NEW.created_by,
      format('Payment of Rs %s added via %s', NEW.amount, NEW.payment_method),
      NEW.notes
    );
    
    -- Also log in the related module (sale/purchase)
    IF NEW.reference_type = 'purchase' THEN
      PERFORM log_activity(
        NEW.company_id,
        'purchase',
        NEW.reference_id,
        NULL, -- Will be resolved from purchase
        'payment_added',
        NULL,
        NULL,
        jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount, 'method', NEW.payment_method),
        NEW.amount,
        NEW.payment_method::VARCHAR(50),
        NEW.payment_account_id,
        NEW.created_by,
        format('Payment of Rs %s received for purchase', NEW.amount),
        NEW.notes
      );
    ELSIF NEW.reference_type = 'sale' THEN
      PERFORM log_activity(
        NEW.company_id,
        'sale',
        NEW.reference_id,
        NULL, -- Will be resolved from sale
        'payment_added',
        NULL,
        NULL,
        jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount, 'method', NEW.payment_method),
        NEW.amount,
        NEW.payment_method::VARCHAR(50),
        NEW.payment_account_id,
        NEW.created_by,
        format('Payment of Rs %s received for sale', NEW.amount),
        NEW.notes
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Log payment deletion
    PERFORM log_activity(
      OLD.company_id,
      'payment',
      OLD.id,
      v_reference,
      'payment_deleted',
      NULL,
      row_to_json(OLD)::JSONB,
      NULL,
      OLD.amount,
      OLD.payment_method::VARCHAR(50),
      OLD.payment_account_id,
      auth.uid(),
      format('Payment of Rs %s deleted (reverse entry created)', OLD.amount),
      NULL
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payments
DROP TRIGGER IF EXISTS trigger_log_payment_activity ON payments;
CREATE TRIGGER trigger_log_payment_activity
  AFTER INSERT OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_activity();

-- ============================================================================
-- TRIGGER: Auto-log Sale Updates
-- ============================================================================
CREATE OR REPLACE FUNCTION log_sale_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_no VARCHAR(100);
BEGIN
  v_invoice_no := COALESCE(NEW.invoice_no, OLD.invoice_no, 'N/A');
  
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.company_id,
      'sale',
      NEW.id,
      v_invoice_no,
      'create',
      NULL,
      NULL,
      row_to_json(NEW)::JSONB,
      NULL,
      NULL,
      NULL,
      NEW.created_by,
      'Sale Invoice Created',
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_activity(
        NEW.company_id,
        'sale',
        NEW.id,
        v_invoice_no,
        'status_change',
        'status',
        to_jsonb(OLD.status),
        to_jsonb(NEW.status),
        NULL,
        NULL,
        NULL,
        auth.uid(),
        format('Status changed from %s to %s', OLD.status, NEW.status),
        NULL
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity(
      OLD.company_id,
      'sale',
      OLD.id,
      v_invoice_no,
      'delete',
      NULL,
      row_to_json(OLD)::JSONB,
      NULL,
      NULL,
      NULL,
      NULL,
      auth.uid(),
      'Sale Invoice Deleted',
      NULL
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for sales
DROP TRIGGER IF EXISTS trigger_log_sale_activity ON sales;
CREATE TRIGGER trigger_log_sale_activity
  AFTER INSERT OR UPDATE OR DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION log_sale_activity();

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Check if table was created successfully
SELECT 
  'activity_logs table created' as status,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'activity_logs';
