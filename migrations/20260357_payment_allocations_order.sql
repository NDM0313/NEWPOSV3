-- Stable FIFO ordering for manual receipt → invoice allocations (display + audit).

ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS allocation_order INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.payment_allocations.allocation_order IS '1-based sequence: oldest invoice first in FIFO auto-allocation.';
