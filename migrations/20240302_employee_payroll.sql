-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    basic_salary NUMERIC NOT NULL DEFAULT 0,
    commission_rate NUMERIC DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(user_id)
);

-- 2. Employee Ledger Table
CREATE TABLE IF NOT EXISTS employee_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('salary','bonus','commission','payment','adjustment')),
    amount NUMERIC NOT NULL,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_employee_id ON employee_ledger(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_type ON employee_ledger(type);
CREATE INDEX IF NOT EXISTS idx_employee_ledger_created_at ON employee_ledger(created_at);
