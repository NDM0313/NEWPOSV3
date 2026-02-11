-- Allow 'void' status on purchase_returns (same as sale_returns: void = cancelled/final return)
ALTER TABLE purchase_returns
  DROP CONSTRAINT IF EXISTS purchase_returns_status_check;

ALTER TABLE purchase_returns
  ADD CONSTRAINT purchase_returns_status_check CHECK (status IN ('draft', 'final', 'void'));

COMMENT ON COLUMN purchase_returns.status IS 'draft=editable; final=locked; void=cancelled (stock reversed, record kept for audit).';
