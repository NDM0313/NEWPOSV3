-- ============================================================================
-- Safe Delete: Add cancelled status and cancel audit columns
-- For Sales & Purchases: Draft = hard delete allowed; Final = Cancel only
-- ============================================================================

-- Add 'cancelled' to sale_status enum (PostgreSQL 9.1+; IF NOT EXISTS in PG 9.5+)
ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add 'cancelled' to purchase_status enum
ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Sales: cancel audit columns
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Purchases: cancel audit columns
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Expenses: cancel_reason for soft delete (status=rejected)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
