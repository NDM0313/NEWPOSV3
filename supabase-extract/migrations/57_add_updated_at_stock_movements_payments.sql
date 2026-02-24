-- ============================================================================
-- Migration 57: Add updated_at to stock_movements and payments
-- GO-LIVE Minor Improvement #1
-- ============================================================================

-- stock_movements: add updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE stock_movements ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- payments: add updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Triggers for auto-update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON stock_movements;
CREATE TRIGGER update_stock_movements_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
