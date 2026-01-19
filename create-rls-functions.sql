-- Create RLS helper functions

-- Get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user has permission for a module
CREATE OR REPLACE FUNCTION has_module_permission(
  module_name VARCHAR,
  permission_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  user_permission RECORD;
  user_role_val user_role;
BEGIN
  -- Admin has all permissions
  SELECT role INTO user_role_val FROM users WHERE id = auth.uid();
  IF user_role_val = 'admin' THEN
    RETURN true;
  END IF;

  -- Check specific permission
  SELECT * INTO user_permission
  FROM permissions
  WHERE user_id = auth.uid()
    AND module = module_name;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  CASE permission_type
    WHEN 'view' THEN RETURN user_permission.can_view;
    WHEN 'create' THEN RETURN user_permission.can_create;
    WHEN 'edit' THEN RETURN user_permission.can_edit;
    WHEN 'delete' THEN RETURN user_permission.can_delete;
    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has access to branch
CREATE OR REPLACE FUNCTION has_branch_access(branch_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_branches
    WHERE user_id = auth.uid()
      AND branch_id = branch_uuid
  );
$$ LANGUAGE sql SECURITY DEFINER;
