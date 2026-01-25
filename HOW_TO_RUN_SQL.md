# 🚀 HOW TO CREATE JOURNAL_ENTRIES TABLES

## Step-by-Step Guide

### Step 1: Open Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **"SQL Editor"** in the left sidebar

### Step 2: Copy the SQL Script
Open the file `CREATE_JOURNAL_ENTRIES_TABLE.sql` and copy **ALL** the SQL code.

### Step 3: Paste and Run
1. In the SQL Editor, paste the copied SQL
2. Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
3. Wait for success message: ✅ "Success. No rows returned"

### Step 4: Verify Tables Were Created
Run this verification query in the SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('journal_entries', 'journal_entry_lines');
```

**Expected Result:** You should see 2 rows:
- `journal_entries`
- `journal_entry_lines`

### Step 5: Refresh Your App
1. Go back to your application
2. **Hard refresh** the browser (`Ctrl+Shift+R` or `Cmd+Shift+R`)
3. Try recording a payment again

---

## ✅ Success Indicators

After running the SQL, you should see:
- ✅ No errors in console about missing `journal_entries` table
- ✅ Payment recording works without errors
- ✅ Journal entries are created successfully
- ✅ Payment history shows recorded payments

---

## ❌ If You Get Errors

### Error: "relation already exists"
- **Solution:** Tables already exist, you can skip this step or drop them first:
  ```sql
  DROP TABLE IF EXISTS journal_entry_lines CASCADE;
  DROP TABLE IF EXISTS journal_entries CASCADE;
  ```
  Then run the CREATE script again.

### Error: "permission denied"
- **Solution:** Make sure you're logged in as the project owner/admin

### Error: "column does not exist"
- **Solution:** Check that `companies`, `branches`, `accounts`, and `users` tables exist first

---

## 📋 Quick Copy-Paste SQL

If you prefer, here's the complete SQL to copy:

```sql
-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    entry_no VARCHAR(100),
    entry_date DATE NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entry Lines Table
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Allow authenticated full access to journal_entries"
    ON journal_entries FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Allow authenticated full access to journal_entry_lines"
    ON journal_entry_lines FOR ALL
    USING (auth.role() = 'authenticated');
```

---

**After running this SQL, your payment recording will work! 🎉**
