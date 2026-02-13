-- ============================================
-- Companies Printer Config
-- ============================================
-- Adds printer_mode, default_printer_name, print_receipt_auto for centralized print config.
-- Used by usePrinterConfig hook - thermal/A4 mode, default printer, auto-print receipt.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS printer_mode VARCHAR(20) DEFAULT 'a4' CHECK (printer_mode IN ('thermal', 'a4')),
  ADD COLUMN IF NOT EXISTS default_printer_name TEXT,
  ADD COLUMN IF NOT EXISTS print_receipt_auto BOOLEAN DEFAULT false;

COMMENT ON COLUMN companies.printer_mode IS 'Print layout: thermal (80mm) or a4';
COMMENT ON COLUMN companies.default_printer_name IS 'Default printer device name for POS/receipts';
COMMENT ON COLUMN companies.print_receipt_auto IS 'Auto-print receipt after sale';
