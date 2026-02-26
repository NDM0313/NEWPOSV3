-- Add default for users.id so inserts without id succeed (e.g. staff/salesman records).
-- Fixes: null value in column "id" of relation "users" violates not-null constraint

ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
