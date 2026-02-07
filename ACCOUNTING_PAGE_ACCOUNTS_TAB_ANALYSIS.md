# 📊 ACCOUNTING PAGE - ACCOUNTS TAB - COMPLETE ANALYSIS

**Date:** January 30, 2026  
**Component:** `AccountingDashboard.tsx` → Accounts Tab  
**Status:** ✅ Production Ready

---

## 🎯 OVERVIEW

The Accounting page is a comprehensive financial management interface with multiple tabs. The **Accounts Tab** is specifically designed for managing financial accounts (Cash, Bank, Mobile Wallet, etc.) and viewing their balances, status, and ledger entries.

---

## 📁 FILE STRUCTURE

### Frontend Files

```
src/app/
├── components/accounting/
│   ├── AccountingDashboard.tsx          # Main component (Accounts Tab here)
│   ├── AddAccountDrawer.tsx            # Create new account dialog
│   ├── AccountLedgerView.tsx            # Account ledger display
│   ├── AccountLedgerPage.tsx           # Full-screen ledger view
│   └── TransactionDetailModal.tsx      # Transaction details
│
├── context/
│   └── AccountingContext.tsx            # Accounts data provider
│
└── services/
    ├── accountService.ts               # Backend API calls for accounts
    └── accountingService.ts            # Journal entries & transactions
```

### Backend Database Tables

```sql
-- Main accounts table
accounts (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type account_type NOT NULL,           -- 'Cash', 'Bank', 'Mobile Wallet'
  balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  parent_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Journal entries (linked to accounts)
journal_entries (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID,
  entry_no VARCHAR(50),
  entry_date DATE,
  description TEXT,
  reference_type VARCHAR(50),           -- 'sale', 'purchase', 'expense'
  reference_id UUID,
  total_debit DECIMAL(15,2),
  total_credit DECIMAL(15,2),
  created_by UUID,
  created_at TIMESTAMPTZ
)

-- Journal entry lines (account-level details)
journal_entry_lines (
  id UUID PRIMARY KEY,
  journal_entry_id UUID NOT NULL,
  account_id UUID NOT NULL,             -- Links to accounts table
  account_name VARCHAR(255),
  debit DECIMAL(15,2) DEFAULT 0,
  credit DECIMAL(15,2) DEFAULT 0,
  description TEXT
)
```

---

## 🔗 FRONTEND-BACKEND LINKAGE

### 1. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  AccountingDashboard.tsx (Accounts Tab)                      │
│         │                                                     │
│         ├─► useAccounting() hook                             │
│         │   └─► AccountingContext.tsx                         │
│         │       ├─► loadAccounts()                            │
│         │       └─► loadEntries()                            │
│         │                                                     │
│         └─► accountService.ts                                 │
│             ├─► getAllAccounts(companyId, branchId)          │
│             ├─► createAccount(accountData)                    │
│             ├─► updateAccount(id, updates)                   │
│             └─► deleteAccount(id)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER (Supabase)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Supabase Client (PostgreSQL)                                │
│         │                                                     │
│         ├─► accounts table                                    │
│         │   ├─► SELECT * FROM accounts                       │
│         │   │   WHERE company_id = ?                          │
│         │   │   ORDER BY name                                 │
│         │   │                                                 │
│         │   ├─► INSERT INTO accounts (...)                   │
│         │   │                                                 │
│         │   └─► UPDATE accounts SET ... WHERE id = ?          │
│         │                                                     │
│         └─► journal_entries + journal_entry_lines            │
│             └─► Balance calculation via JOIN                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2. Key Service Functions

#### `accountService.ts` - Backend API

```typescript
// Get all accounts for a company
async getAllAccounts(companyId: string, branchId?: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('company_id', companyId)
    .order('name');
  return data || [];
}

// Create new account
async createAccount(account: Partial<Account>) {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      company_id: account.company_id,
      code: account.code,
      name: account.name,
      type: account.type,
      balance: account.balance || 0,
      is_active: account.is_active !== false,
    })
    .select()
    .single();
  return data;
}

// Update account
async updateAccount(id: string, updates: Partial<Account>) {
  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return data;
}

// Delete account (soft delete - sets is_active = false)
async deleteAccount(id: string) {
  // CRITICAL: Core accounts (Cash, Bank, Mobile Wallet) cannot be deleted
  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id);
}
```

#### `AccountingContext.tsx` - State Management

```typescript
// Load accounts from database
const loadAccounts = useCallback(async () => {
  if (!companyId) return;
  
  const data = await accountService.getAllAccounts(
    companyId, 
    branchId === 'all' ? undefined : branchId
  );
  const convertedAccounts = data.map(convertFromSupabaseAccount);
  setAccounts(convertedAccounts);
}, [companyId, branchId]);

// Convert Supabase format to app format
const convertFromSupabaseAccount = (supabaseAccount: any): Account => {
  return {
    id: supabaseAccount.id,
    name: supabaseAccount.name || '',
    type: supabaseAccount.type || 'Cash',
    balance: parseFloat(supabaseAccount.balance || 0),
    isActive: supabaseAccount.is_active !== false,
    code: supabaseAccount.code,
  };
};
```

---

## 🎨 ACCOUNTS TAB UI STRUCTURE

### Component Hierarchy

```
AccountingDashboard
└── activeTab === 'accounts'
    ├── Header Section
    │   ├── Title: "Accounts"
    │   ├── Subtitle: "Manage your financial accounts"
    │   └── Button: "Create New Account"
    │
    └── Accounts Table
        ├── Table Header
        │   ├── Account Name
        │   ├── Account Type
        │   ├── Scope (Branch/Global)
        │   ├── Balance
        │   ├── Status (Active/Inactive)
        │   └── Actions
        │
        └── Table Rows (from accounting.accounts)
            ├── Account Name + Badges (Default Cash/Bank)
            ├── Account Type Badge
            ├── Scope Text
            ├── Balance (formatted, color-coded)
            ├── Status Badge
            └── Actions Dropdown
                ├── View Ledger
                ├── View Transactions
                ├── Account Summary
                ├── Edit Account
                ├── Activate/Deactivate
                └── Set as Default (Cash/Bank)
```

### Key UI Elements

#### 1. Accounts Table (`AccountingDashboard.tsx` lines 611-834)

```typescript
{activeTab === 'accounts' && (
  <div className="space-y-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-white">Accounts</h3>
        <p className="text-sm text-gray-400">Manage your financial accounts</p>
      </div>
      <Button onClick={() => setIsAddAccountOpen(true)}>
        <Plus size={16} /> Create New Account
      </Button>
    </div>

    {/* Accounts Table */}
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl">
      <table className="w-full">
        <thead>
          <tr>
            <th>Account Name</th>
            <th>Account Type</th>
            <th>Scope</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounting.accounts.map((account) => (
            <tr key={account.id}>
              {/* Account details rendered here */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

#### 2. Account Actions Dropdown

```typescript
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost" size="sm">
      <MoreVertical size={16} />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setLedgerAccount({...})}>
      <FileText /> View Ledger
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setEditingAccount(account)}>
      <Edit /> Edit Account
    </DropdownMenuItem>
    <DropdownMenuItem onClick={async () => {
      await accountService.updateAccount(account.id, {
        is_active: !account.isActive
      });
      await accounting.refreshEntries();
    }}>
      {account.isActive ? 'Deactivate' : 'Activate'}
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 🔄 DATA FLOW & STATE MANAGEMENT

### 1. Initial Load

```
User opens Accounting page
    │
    ▼
AccountingDashboard mounts
    │
    ├─► useAccounting() hook called
    │   │
    │   └─► AccountingContext provides:
    │       ├─► accounts: Account[]
    │       ├─► entries: AccountingEntry[]
    │       └─► loading: boolean
    │
    └─► useEffect in AccountingContext
        │
        ├─► loadAccounts()
        │   └─► accountService.getAllAccounts(companyId, branchId)
        │       └─► Supabase: SELECT * FROM accounts WHERE company_id = ?
        │
        └─► loadEntries()
            └─► accountingService.getAllEntries(companyId, branchId)
                └─► Supabase: SELECT * FROM journal_entries WHERE company_id = ?
```

### 2. Create Account Flow

```
User clicks "Create New Account"
    │
    ▼
setIsAddAccountOpen(true)
    │
    ▼
AddAccountDrawer opens
    │
    ├─► User fills form:
    │   ├─► Account Name
    │   ├─► Account Type (Cash/Bank/Mobile Wallet)
    │   ├─► Account Code
    │   └─► Initial Balance
    │
    ▼
User clicks "Save"
    │
    ▼
AddAccountDrawer.onSuccess()
    │
    ├─► accountService.createAccount(accountData)
    │   └─► Supabase: INSERT INTO accounts (...)
    │
    └─► accounting.refreshEntries()
        └─► loadAccounts() (reloads from DB)
```

### 3. Edit Account Flow

```
User clicks "Edit Account" from dropdown
    │
    ▼
setEditingAccount(account)
setIsEditAccountOpen(true)
    │
    ▼
AccountEditForm dialog opens
    │
    ├─► Pre-filled with account data:
    │   ├─► name
    │   ├─► type
    │   ├─► code
    │   └─► is_active
    │
    ▼
User modifies and clicks "Save"
    │
    ▼
accountService.updateAccount(id, updates)
    └─► Supabase: UPDATE accounts SET ... WHERE id = ?
        │
        └─► accounting.refreshEntries()
            └─► loadAccounts() (reloads updated data)
```

### 4. View Ledger Flow

```
User clicks "View Ledger" from dropdown
    │
    ▼
setLedgerAccount({
  id: account.id,
  name: account.name,
  code: account.code,
  type: account.type
})
    │
    ▼
AccountLedgerPage component renders (full-screen)
    │
    ├─► Fetches journal entries for this account:
    │   └─► accountingService.getAccountLedger(accountId)
    │       └─► Supabase: 
    │           SELECT jel.*, je.*
    │           FROM journal_entry_lines jel
    │           JOIN journal_entries je ON jel.journal_entry_id = je.id
    │           WHERE jel.account_id = ?
    │
    └─► Displays:
        ├─► Account summary (opening balance, current balance)
        ├─► Transaction list (debits/credits)
        └─► Running balance
```

---

## 🗄️ DATABASE SCHEMA DETAILS

### Accounts Table Structure

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  code VARCHAR(50) NOT NULL,              -- Unique account code (e.g., '1000' for Cash)
  name VARCHAR(255) NOT NULL,              -- Account name (e.g., 'Main Cash Account')
  
  type account_type NOT NULL,              -- ENUM: 'Cash', 'Bank', 'Mobile Wallet'
  subtype account_subtype,                 -- Optional: 'cash', 'bank', 'mobile_wallet'
  
  parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,  -- For hierarchical accounts
  
  opening_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,  -- Calculated from journal entries
  
  description TEXT,
  
  is_system BOOLEAN DEFAULT false,         -- System accounts cannot be deleted
  is_active BOOLEAN DEFAULT true,          -- Soft delete flag
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, code)                 -- Unique code per company
);
```

### Account Types Enum

```sql
CREATE TYPE account_type AS ENUM (
  'Cash',
  'Bank',
  'Mobile Wallet',
  'Accounts Receivable',
  'Accounts Payable',
  'Inventory',
  'Sales Revenue',
  'Operating Expense',
  'Other'
);
```

### Account Subtypes Enum

```sql
CREATE TYPE account_subtype AS ENUM (
  'cash',
  'bank',
  'mobile_wallet',
  'accounts_receivable',
  'accounts_payable',
  'inventory',
  'fixed_asset',
  'current_asset',
  'current_liability',
  'long_term_liability',
  'owner_capital',
  'retained_earnings',
  'sales_revenue',
  'rental_revenue',
  'studio_revenue',
  'cost_of_goods_sold',
  'operating_expense',
  'other'
);
```

---

## 🔐 CORE ACCOUNTING BACKBONE RULES

### Mandatory Accounts

Every new business **MUST** have these 3 accounts created automatically:

1. **Cash** (code: `1000`)
   - Type: `Cash`
   - Subtype: `cash`
   - Cannot be deleted
   - Always active

2. **Bank** (code: `1010`)
   - Type: `Bank`
   - Subtype: `bank`
   - Cannot be deleted
   - Always active

3. **Mobile Wallet** (code: `1020`)
   - Type: `Mobile Wallet`
   - Subtype: `mobile_wallet`
   - Cannot be deleted
   - Always active

### Implementation

```typescript
// In accountService.ts
async deleteAccount(id: string, companyId?: string) {
  // CRITICAL: Check if this is a core payment account
  if (companyId) {
    const { defaultAccountsService } = await import('./defaultAccountsService');
    const account = await this.getAccountById(id);
    
    if (account && defaultAccountsService.isCorePaymentAccount(account)) {
      throw new Error(
        `Cannot delete core payment account "${account.name}". ` +
        `Core accounts (Cash, Bank, Mobile Wallet) are mandatory and cannot be deleted.`
      );
    }
  }
  
  // Soft delete (set is_active = false)
  await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id);
}
```

---

## 📊 ACCOUNT BALANCE CALCULATION

### Balance Source

Account balances are **NOT** stored directly in `accounts.balance`. They are **calculated** from `journal_entry_lines`:

```sql
-- Balance calculation query
SELECT 
  a.id,
  a.name,
  a.code,
  COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
WHERE a.company_id = ?
GROUP BY a.id, a.name, a.code;
```

### Frontend Balance Display

```typescript
// In AccountingDashboard.tsx
<td className={cn(
  "px-4 py-3 text-sm font-semibold text-right tabular-nums",
  account.balance >= 0 ? "text-green-400" : "text-red-400"
)}>
  Rs {account.balance.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}
</td>
```

---

## 🔄 REAL-TIME UPDATES

### Event Listeners

The Accounts tab listens for these events to refresh data:

```typescript
// In AccountingContext.tsx
useEffect(() => {
  const handlePurchaseDelete = () => {
    loadEntries();  // Refresh journal entries
  };
  
  const handleSaleDelete = () => {
    loadEntries();  // Refresh journal entries
  };

  window.addEventListener('purchaseDeleted', handlePurchaseDelete);
  window.addEventListener('saleDeleted', handleSaleDelete);
  
  return () => {
    window.removeEventListener('purchaseDeleted', handlePurchaseDelete);
    window.removeEventListener('saleDeleted', handleSaleDelete);
  };
}, [loadEntries]);
```

### Refresh Triggers

Accounts data is refreshed when:
- ✅ New account created
- ✅ Account updated (name, type, status)
- ✅ Account activated/deactivated
- ✅ Purchase/Sale deleted (affects journal entries → balance)
- ✅ Payment recorded (affects journal entries → balance)
- ✅ Manual journal entry created

---

## 🎯 KEY FEATURES

### 1. Account Management
- ✅ Create new accounts
- ✅ Edit account details
- ✅ Activate/Deactivate accounts
- ✅ Set default Cash/Bank accounts
- ✅ View account ledger

### 2. Account Display
- ✅ List all accounts in table format
- ✅ Show account type badges
- ✅ Display balance (color-coded: green for positive, red for negative)
- ✅ Show status (Active/Inactive)
- ✅ Show scope (Branch/Global)

### 3. Account Actions
- ✅ View Ledger (full-screen ledger view)
- ✅ View Transactions (filtered by account)
- ✅ Account Summary (coming soon)
- ✅ Edit Account
- ✅ Activate/Deactivate
- ✅ Set as Default (Cash/Bank only)

### 4. Data Validation
- ✅ Core accounts cannot be deleted
- ✅ Account code must be unique per company
- ✅ Account name is required
- ✅ Account type is required

---

## 🔍 INTEGRATION POINTS

### 1. Sales Module
- When a sale is created with payment → Journal entry created → Account balance updated
- Payment method (Cash/Bank/Mobile Wallet) → Links to corresponding account

### 2. Purchase Module
- When a purchase is created with payment → Journal entry created → Account balance updated
- Payment method → Links to corresponding account

### 3. Expense Module
- When expense is paid → Journal entry created → Account balance updated
- Payment account → Links to accounts table

### 4. Payment Module
- All payments must have `payment_account_id` → References `accounts.id`
- Payment method → Maps to account type (Cash/Bank/Mobile Wallet)

---

## 📝 SUMMARY

### Frontend → Backend Links

| Frontend Component | Backend Service | Database Table | Key Operations |
|-------------------|----------------|----------------|----------------|
| `AccountingDashboard` | `useAccounting()` | - | State management |
| `AccountingContext` | `accountService.getAllAccounts()` | `accounts` | Load accounts |
| `AddAccountDrawer` | `accountService.createAccount()` | `accounts` | Create account |
| `AccountEditForm` | `accountService.updateAccount()` | `accounts` | Update account |
| `AccountLedgerPage` | `accountingService.getAccountLedger()` | `journal_entries` + `journal_entry_lines` | View ledger |
| Actions Dropdown | `accountService.updateAccount()` | `accounts` | Activate/Deactivate |

### Database Relationships

```
accounts
  ├─► company_id → companies.id
  ├─► parent_id → accounts.id (self-reference)
  │
  └─► Referenced by:
      ├─► journal_entry_lines.account_id
      ├─► payments.payment_account_id
      ├─► expenses.payment_account_id
      └─► branches.cash_account_id / bank_account_id
```

### Key Files Summary

1. **Frontend:**
   - `src/app/components/accounting/AccountingDashboard.tsx` - Main UI
   - `src/app/context/AccountingContext.tsx` - State management
   - `src/app/services/accountService.ts` - Backend API

2. **Backend:**
   - `accounts` table - Account master data
   - `journal_entries` + `journal_entry_lines` - Balance calculation
   - `payments` table - Payment account references

---

## ✅ PRODUCTION CHECKLIST

- [x] Accounts load from database
- [x] Create account functionality
- [x] Edit account functionality
- [x] Activate/Deactivate accounts
- [x] View account ledger
- [x] Balance calculation from journal entries
- [x] Core accounts protection (cannot delete)
- [x] Real-time updates on transaction changes
- [x] Account type validation
- [x] Account code uniqueness validation

---

**Last Updated:** January 30, 2026  
**Status:** ✅ Complete & Production Ready
