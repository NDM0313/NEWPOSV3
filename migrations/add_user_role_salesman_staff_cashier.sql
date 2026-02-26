-- Add app-used user_role enum values (DB has salesperson, app uses salesman; staff, cashier, inventory, operator)
-- Fixes: invalid input value for enum user_role: "salesman"

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'salesman';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inventory';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operator';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
