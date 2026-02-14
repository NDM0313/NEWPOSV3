-- ============================================
-- PART 2 – RENTAL STATUS ENUM ALIGNMENT
-- ============================================
-- Ensure rental_status includes: booked, picked_up, active, returned,
-- overdue, closed, cancelled. Add missing values (must be top-level;
-- ADD VALUE cannot run inside a function/DO block).

ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'closed';
