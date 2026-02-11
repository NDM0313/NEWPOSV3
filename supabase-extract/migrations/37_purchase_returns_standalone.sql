-- Purchase Return without invoice (standalone): same as sale_returns.
-- original_purchase_id NULL = return without invoice; non-null = return against a purchase
ALTER TABLE purchase_returns
  ALTER COLUMN original_purchase_id DROP NOT NULL;

COMMENT ON COLUMN purchase_returns.original_purchase_id IS 'Optional. When set, return is against this purchase; when NULL, standalone return (no invoice).';
