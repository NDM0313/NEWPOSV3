-- ============================================
-- Add paper_size for thermal receipts (58mm / 80mm)
-- ============================================
-- Extends printer config: thermal mode can use 58mm or 80mm paper.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS paper_size VARCHAR(10) DEFAULT '80mm' CHECK (paper_size IN ('58mm', '80mm'));

COMMENT ON COLUMN companies.paper_size IS 'Thermal receipt paper width: 58mm or 80mm (used when printer_mode=thermal)';
