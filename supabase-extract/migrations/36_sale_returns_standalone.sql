-- Allow sale return without linked invoice (standalone return)
-- original_sale_id NULL = return without invoice; non-null = return against a sale
ALTER TABLE sale_returns
  ALTER COLUMN original_sale_id DROP NOT NULL;

-- Keep FK: when original_sale_id is set it must reference sales(id); when NULL no check
COMMENT ON COLUMN sale_returns.original_sale_id IS 'Optional. When set, return is against this sale; when NULL, standalone return (no invoice).';
