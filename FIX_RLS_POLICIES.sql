-- Fix RLS Policies (PostgreSQL doesn't support CREATE POLICY IF NOT EXISTS)
-- Drop existing policies if they exist, then create new ones

DROP POLICY IF EXISTS "Allow authenticated full access to journal_entries" ON journal_entries;
CREATE POLICY "Allow authenticated full access to journal_entries"
    ON journal_entries FOR ALL
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated full access to journal_entry_lines" ON journal_entry_lines;
CREATE POLICY "Allow authenticated full access to journal_entry_lines"
    ON journal_entry_lines FOR ALL
    USING (auth.role() = 'authenticated');
