# 📊 Chart of Accounts - Complete Cloning Guide for Cursor AI

## 🎯 Overview
This document provides a complete guide to clone and implement the Chart of Accounts (TEST) system with full frontend + backend integration using Supabase.

---

## 📁 PART 1: FRONTEND STRUCTURE

### File Location
- Main Component: `/src/app/components/accounting/ChartOfAccounts.tsx`
- Add Account Drawer: `/src/app/components/accounting/AddChartAccountDrawer.tsx`
- Journal Entry Dialog: `/src/app/components/accounting/EnhancedJournalEntryDialog.tsx`
- Export Utilities: `/src/app/utils/professionalExportUtils.ts`

### Dependencies Required
```json
{
  "dependencies": {
    "lucide-react": "latest",
    "motion/react": "latest",
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-alert-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "sonner": "latest",
    "@supabase/supabase-js": "latest"
  }
}
```

---

## 🗄️ PART 2: SUPABASE DATABASE SCHEMA

### Table 1: `chart_accounts`
```sql
CREATE TABLE chart_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Assets', 'Liabilities', 'Equity', 'Income', 'Cost of Sales', 'Expenses')),
  sub_category VARCHAR(100) NOT NULL,
  parent_account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
  modules TEXT[] NOT NULL DEFAULT '{}',
  opening_balance DECIMAL(15, 2) DEFAULT 0,
  current_balance DECIMAL(15, 2) DEFAULT 0,
  nature VARCHAR(10) NOT NULL CHECK (nature IN ('Debit', 'Credit')),
  tax_applicable BOOLEAN DEFAULT FALSE,
  tax_type VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  show_in_reports BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Indexes
  INDEX idx_chart_accounts_category (category),
  INDEX idx_chart_accounts_code (code),
  INDEX idx_chart_accounts_active (active)
);

-- Row Level Security
ALTER TABLE chart_accounts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read access" ON chart_accounts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert access" ON chart_accounts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update access" ON chart_accounts
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete access" ON chart_accounts
  FOR DELETE USING (auth.role() = 'authenticated');
```

### Table 2: `account_transactions`
```sql
CREATE TABLE account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_date DATE NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_accounts(id) ON DELETE CASCADE,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  running_balance DECIMAL(15, 2) NOT NULL,
  description TEXT,
  module VARCHAR(50) CHECK (module IN ('POS', 'Rental', 'Studio', 'General Accounting', 'All')),
  reference_no VARCHAR(100),
  linked_transaction_id UUID REFERENCES account_transactions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Indexes
  INDEX idx_account_transactions_account (account_id),
  INDEX idx_account_transactions_date (transaction_date),
  INDEX idx_account_transactions_module (module)
);

-- Row Level Security
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read access" ON account_transactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert access" ON account_transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### Table 3: `journal_entries`
```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('General', 'Cash Receipt', 'Cash Payment', 'Bank Receipt', 'Bank Payment', 'Transfer')),
  reference_no VARCHAR(100),
  description TEXT,
  total_debit DECIMAL(15, 2) NOT NULL,
  total_credit DECIMAL(15, 2) NOT NULL,
  module VARCHAR(50) CHECK (module IN ('POS', 'Rental', 'Studio', 'General Accounting')),
  status VARCHAR(20) DEFAULT 'Posted' CHECK (status IN ('Draft', 'Posted', 'Void')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_journal_entries_date (entry_date),
  INDEX idx_journal_entries_type (entry_type),
  INDEX idx_journal_entries_status (status),
  
  -- Constraint: Debit must equal Credit
  CONSTRAINT journal_entry_balanced CHECK (total_debit = total_credit)
);

-- Row Level Security
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access" ON journal_entries
  FOR ALL USING (auth.role() = 'authenticated');
```

### Table 4: `journal_entry_lines`
```sql
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_accounts(id),
  description TEXT,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  
  -- Indexes
  INDEX idx_journal_lines_entry (journal_entry_id),
  INDEX idx_journal_lines_account (account_id),
  
  -- Constraint: Either debit or credit must be > 0, but not both
  CONSTRAINT journal_line_single_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

-- Row Level Security
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access" ON journal_entry_lines
  FOR ALL USING (auth.role() = 'authenticated');
```

### Table 5: `accounting_audit_logs`
```sql
CREATE TABLE accounting_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE')),
  account_id UUID REFERENCES chart_accounts(id) ON DELETE SET NULL,
  account_name VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  
  -- Index
  INDEX idx_audit_logs_timestamp (timestamp),
  INDEX idx_audit_logs_account (account_id),
  INDEX idx_audit_logs_action (action)
);

-- Row Level Security
ALTER TABLE accounting_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON accounting_audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert access" ON accounting_audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

### Table 6: `automation_rules`
```sql
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  module VARCHAR(50) CHECK (module IN ('POS', 'Rental', 'Studio', 'General Accounting')),
  enabled BOOLEAN DEFAULT TRUE,
  description TEXT,
  debit_account_id UUID NOT NULL REFERENCES chart_accounts(id),
  credit_account_id UUID NOT NULL REFERENCES chart_accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index
  INDEX idx_automation_rules_module (module),
  INDEX idx_automation_rules_enabled (enabled)
);

-- Row Level Security
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access" ON automation_rules
  FOR ALL USING (auth.role() = 'authenticated');
```

### Table 7: `accounting_settings`
```sql
CREATE TABLE accounting_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auto_generate_codes BOOLEAN DEFAULT TRUE,
  show_inactive_accounts BOOLEAN DEFAULT FALSE,
  default_tax_rate DECIMAL(5, 2) DEFAULT 18.00,
  tax_type VARCHAR(50) DEFAULT 'GST',
  fiscal_year_start DATE,
  fiscal_year_end DATE,
  account_lock_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Only one settings row allowed
  CONSTRAINT single_settings_row CHECK (id = uuid_generate_v4())
);

-- Row Level Security
ALTER TABLE accounting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access" ON accounting_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- Insert default settings
INSERT INTO accounting_settings (
  auto_generate_codes,
  show_inactive_accounts,
  default_tax_rate,
  tax_type,
  fiscal_year_start,
  fiscal_year_end
) VALUES (
  TRUE,
  FALSE,
  18.00,
  'GST',
  '2025-01-01',
  '2025-12-31'
);
```

---

## 🔗 PART 3: BACKEND INTEGRATION (Supabase Functions)

### Database Functions

#### 1. Auto-update Account Balance on Transaction
```sql
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update current balance based on account nature
  UPDATE chart_accounts
  SET current_balance = (
    SELECT 
      CASE 
        WHEN nature = 'Debit' 
        THEN opening_balance + COALESCE(SUM(debit - credit), 0)
        ELSE opening_balance + COALESCE(SUM(credit - debit), 0)
      END
    FROM account_transactions
    WHERE account_id = NEW.account_id
  ),
  updated_at = NOW()
  WHERE id = NEW.account_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_balance
AFTER INSERT ON account_transactions
FOR EACH ROW
EXECUTE FUNCTION update_account_balance();
```

#### 2. Auto-update Timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chart_accounts_updated_at
BEFORE UPDATE ON chart_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
BEFORE UPDATE ON automation_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

#### 3. Validate Journal Entry Balance
```sql
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit DECIMAL(15, 2);
  total_credit DECIMAL(15, 2);
BEGIN
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.journal_entry_id;
  
  IF total_debit != total_credit THEN
    RAISE EXCEPTION 'Journal entry is not balanced: Debit (%) != Credit (%)', total_debit, total_credit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_journal_entry_balance
AFTER INSERT OR UPDATE ON journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION validate_journal_balance();
```

---

## 🔌 PART 4: SUPABASE CLIENT CONNECTION

### Setup Supabase Client (`/src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
export type ChartAccount = {
  id: string;
  code: string;
  name: string;
  category: 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Cost of Sales' | 'Expenses';
  sub_category: string;
  parent_account_id?: string;
  modules: string[];
  opening_balance: number;
  current_balance: number;
  nature: 'Debit' | 'Credit';
  tax_applicable: boolean;
  tax_type?: string;
  active: boolean;
  show_in_reports: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};

export type AccountTransaction = {
  id: string;
  transaction_date: string;
  account_id: string;
  debit: number;
  credit: number;
  running_balance: number;
  description: string;
  module: string;
  reference_no: string;
  linked_transaction_id?: string;
  created_at: string;
  created_by: string;
};

export type JournalEntry = {
  id: string;
  entry_date: string;
  entry_type: string;
  reference_no: string;
  description: string;
  total_debit: number;
  total_credit: number;
  module: string;
  status: 'Draft' | 'Posted' | 'Void';
  created_at: string;
  created_by: string;
  updated_at: string;
};

export type JournalEntryLine = {
  id: string;
  journal_entry_id: string;
  line_number: number;
  account_id: string;
  description: string;
  debit: number;
  credit: number;
};
```

---

## 🔄 PART 5: API HOOKS (React Query / Custom Hooks)

### Chart Accounts Hooks (`/src/hooks/useChartAccounts.ts`)
```typescript
import { useState, useEffect } from 'react';
import { supabase, ChartAccount } from '@/lib/supabase';
import { toast } from 'sonner';

export const useChartAccounts = () => {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all accounts
  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chart_accounts')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      toast.error('Failed to load accounts', { description: error.message });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  // Create account
  const createAccount = async (account: Partial<ChartAccount>) => {
    const { data, error } = await supabase
      .from('chart_accounts')
      .insert([account])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create account', { description: error.message });
      return null;
    } else {
      toast.success('Account created successfully');
      await fetchAccounts();
      return data;
    }
  };

  // Update account
  const updateAccount = async (id: string, updates: Partial<ChartAccount>) => {
    const { data, error } = await supabase
      .from('chart_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update account', { description: error.message });
      return null;
    } else {
      toast.success('Account updated successfully');
      await fetchAccounts();
      return data;
    }
  };

  // Delete account
  const deleteAccount = async (id: string) => {
    const { error } = await supabase
      .from('chart_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete account', { description: error.message });
      return false;
    } else {
      toast.success('Account deleted successfully');
      await fetchAccounts();
      return true;
    }
  };

  // Toggle active status
  const toggleActive = async (id: string, active: boolean) => {
    return await updateAccount(id, { active });
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    toggleActive,
  };
};
```

### Transactions Hooks (`/src/hooks/useAccountTransactions.ts`)
```typescript
import { useState, useEffect } from 'react';
import { supabase, AccountTransaction } from '@/lib/supabase';
import { toast } from 'sonner';

export const useAccountTransactions = (accountId?: string) => {
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase
      .from('account_transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load transactions', { description: error.message });
    } else {
      setTransactions(data || []);
    }
    setLoading(false);
  };

  const createTransaction = async (transaction: Partial<AccountTransaction>) => {
    const { data, error } = await supabase
      .from('account_transactions')
      .insert([transaction])
      .select()
      .single();

    if (error) {
      toast.error('Failed to create transaction', { description: error.message });
      return null;
    } else {
      await fetchTransactions();
      return data;
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [accountId]);

  return {
    transactions,
    loading,
    fetchTransactions,
    createTransaction,
  };
};
```

### Journal Entries Hooks (`/src/hooks/useJournalEntries.ts`)
```typescript
import { useState, useEffect } from 'react';
import { supabase, JournalEntry, JournalEntryLine } from '@/lib/supabase';
import { toast } from 'sonner';

export const useJournalEntries = () => {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJournalEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (error) {
      toast.error('Failed to load journal entries', { description: error.message });
    } else {
      setJournalEntries(data || []);
    }
    setLoading(false);
  };

  const createJournalEntry = async (
    entry: Partial<JournalEntry>,
    lines: Partial<JournalEntryLine>[]
  ) => {
    try {
      // Insert journal entry
      const { data: entryData, error: entryError } = await supabase
        .from('journal_entries')
        .insert([entry])
        .select()
        .single();

      if (entryError) throw entryError;

      // Insert journal entry lines
      const linesWithEntryId = lines.map((line, index) => ({
        ...line,
        journal_entry_id: entryData.id,
        line_number: index + 1,
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesWithEntryId);

      if (linesError) throw linesError;

      // Create corresponding transactions
      for (const line of linesWithEntryId) {
        await supabase.from('account_transactions').insert({
          transaction_date: entry.entry_date,
          account_id: line.account_id,
          debit: line.debit || 0,
          credit: line.credit || 0,
          description: line.description || entry.description,
          module: entry.module,
          reference_no: entry.reference_no,
        });
      }

      toast.success('Journal entry created successfully');
      await fetchJournalEntries();
      return entryData;
    } catch (error: any) {
      toast.error('Failed to create journal entry', { description: error.message });
      return null;
    }
  };

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  return {
    journalEntries,
    loading,
    fetchJournalEntries,
    createJournalEntry,
  };
};
```

---

## 🎨 PART 6: INTEGRATE HOOKS INTO COMPONENT

### Update ChartOfAccounts.tsx to use Supabase
Replace the state management section with:

```typescript
import { useChartAccounts } from '@/hooks/useChartAccounts';
import { useAccountTransactions } from '@/hooks/useAccountTransactions';
import { useJournalEntries } from '@/hooks/useJournalEntries';

export const ChartOfAccounts = () => {
  // Use Supabase hooks instead of local state
  const { 
    accounts, 
    loading, 
    createAccount, 
    updateAccount, 
    deleteAccount, 
    toggleActive 
  } = useChartAccounts();
  
  const { 
    transactions, 
    createTransaction 
  } = useAccountTransactions();
  
  const { 
    createJournalEntry 
  } = useJournalEntries();

  // Rest of the component code remains the same
  // Just replace the mock functions with real Supabase calls
};
```

---

## ✅ PART 7: TESTING CHECKLIST

### Frontend Tests
- [ ] All 6 tabs render correctly
- [ ] Category filters work (Assets, Liabilities, Equity, Income, COGS, Expenses)
- [ ] Search functionality works
- [ ] Three-dots menu opens and closes
- [ ] Dialogs open/close properly
- [ ] Forms validate input
- [ ] Export PDF/Excel works

### Backend Tests
- [ ] Create account in Supabase
- [ ] Update account balance automatically
- [ ] Create transaction
- [ ] Running balance calculates correctly
- [ ] Journal entries balance (debit = credit)
- [ ] Audit logs record changes
- [ ] Automation rules trigger
- [ ] RLS policies work correctly

### Integration Tests
- [ ] Frontend fetches data from Supabase
- [ ] Create operation saves to database
- [ ] Update operation reflects in UI
- [ ] Delete operation removes from database
- [ ] Real-time updates work (if subscribed)
- [ ] Error handling shows proper toasts
- [ ] Loading states display correctly

---

## 🚀 DEPLOYMENT STEPS

### 1. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Database Setup
1. Run all SQL schema scripts in Supabase SQL Editor
2. Verify all tables created
3. Check RLS policies enabled
4. Test database functions

### 3. Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 4. Create Hooks Files
- Create `/src/lib/supabase.ts`
- Create `/src/hooks/useChartAccounts.ts`
- Create `/src/hooks/useAccountTransactions.ts`
- Create `/src/hooks/useJournalEntries.ts`

### 5. Update Component
- Import hooks in ChartOfAccounts.tsx
- Replace local state with Supabase hooks
- Test all CRUD operations

---

## 📝 CURSOR AI PROMPT

Use this prompt in Cursor AI to clone the system:

```
Create a complete Chart of Accounts system for Din Collection ERP with:

1. FRONTEND:
   - Component file at /src/app/components/accounting/ChartOfAccounts.tsx
   - 6 main tabs: Overview, Chart of Accounts, Transactions, Automation, Reports, Settings
   - Category sub-tabs: Assets, Liabilities, Equity, Income, Cost of Sales, Expenses
   - Full CRUD operations with three-dots menu
   - Professional export to PDF/Excel
   - Journal entry system (Single Entry mode only)
   - Ledger view with date filters
   - Audit logging UI
   - Dark mode theme (#111827)
   - Use Radix UI for dialogs, dropdowns
   - Use Motion/React for animations
   - Use Sonner for toasts

2. BACKEND (Supabase):
   - Tables: chart_accounts, account_transactions, journal_entries, journal_entry_lines, accounting_audit_logs, automation_rules, accounting_settings
   - Auto-update balance trigger
   - Journal entry validation
   - RLS policies for authenticated users
   - Database functions for balance calculation

3. INTEGRATION:
   - Create Supabase client in /src/lib/supabase.ts
   - Create custom hooks: useChartAccounts, useAccountTransactions, useJournalEntries
   - Connect frontend to Supabase hooks
   - Real-time data fetching
   - Proper error handling with toasts
   - Loading states

Follow the complete schema and structure from CHART_OF_ACCOUNTS_CLONE_GUIDE.md
```

---

## 🎯 SUCCESS CRITERIA

✅ All features working end-to-end
✅ Data persists in Supabase
✅ No console errors
✅ All Dialog accessibility warnings fixed
✅ Professional UI/UX
✅ Fast performance (<2s page load)
✅ Mobile responsive
✅ Production-ready code

---

**Created for Din Collection ERP**
**Version: 1.0**
**Last Updated: 2025-01-24**
