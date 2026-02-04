-- ============================================================================
-- 1) expense_categories: add type (salary / utility / general)
-- 2) expenses: add paid_to_user_id, paid_to_worker_id (and optional expense_category_id)
-- Rule: When category is salary → only paid_to_user_id; paid_to_worker_id must be NULL.
-- ============================================================================

-- 1) Category type
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'general';
COMMENT ON COLUMN expense_categories.type IS 'salary = for user salary only; utility / general = normal expense';

-- 2) Expenses: link to user (salary) or worker (other flows – e.g. production; salary never uses worker)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_to_worker_id UUID REFERENCES workers(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN expenses.paid_to_user_id IS 'For salary expense: user (Staff/Salesman/Operator) who received salary';
COMMENT ON COLUMN expenses.paid_to_worker_id IS 'For non-salary; workers paid via Production/Worker Ledger only, not Salary';
