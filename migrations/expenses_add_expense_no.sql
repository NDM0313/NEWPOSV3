-- ============================================================================
-- EXPENSES: expense_no column for sequential reference (EXP-0001, EXP-0002, ...)
-- ============================================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_no VARCHAR(50);

COMMENT ON COLUMN expenses.expense_no IS 'Sequential reference e.g. EXP-0001 from document numbering';
