# 🏢 Din Collection ERP - Complete POS System

**Modern ERP & POS System with Supabase Backend**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue)](https://github.com/NDM0313/NEWPOSV3)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-green)](https://github.com/NDM0313/NEWPOSV3)
[![Version](https://img.shields.io/badge/Version-3.0.0-blue)](https://github.com/NDM0313/NEWPOSV3)

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Module Status](#module-status)
- [Accounting Module](#accounting-module)
- [Project Structure](#project-structure)
- [Recent Updates](#recent-updates)
- [Contributing](#contributing)

---

## ✨ Features

### ✅ Completed Modules (100%)

1. **Products Module**
   - Full CRUD operations
   - Product variations & packing
   - Stock management
   - Price adjustments
   - Barcode support
   - Category management

2. **Purchases Module**
   - Purchase order management
   - Supplier management
   - Payment tracking
   - Stock receiving
   - Ledger integration

3. **Sales Module**
   - Invoice generation
   - Customer management
   - Payment receiving (Cash/Bank/Wallet)
   - Shipping status tracking
   - Payment history
   - Ledger integration

4. **Accounting Module** ✅ **NEWLY ENHANCED**
   - Double-entry bookkeeping
   - Journal entries with automatic posting
   - Account ledger with bank statement-style view
   - Transaction detail modal
   - Short, readable reference numbers (EXP-0001, JE-0002, etc.)
   - Automatic account balance updates
   - Payment → Journal → Ledger flow
   - Default accounts (Cash, Bank, Accounts Receivable, Capital, etc.)
   - Expense tracking with proper journal entries
   - Commission and discount handling

### 🟡 In Progress Modules

- Contacts Module (80% - CRUD, Payments, Ledger)
- Inventory Module (60% - Dashboard, Stock Tracking)
- Rentals Module (50% - Booking, Management)
- Studio Production Module (50% - Production, Workers)
- Expenses Module (50% - Tracking, Categories)
- Reports Module (40% - Dashboards, Charts)
- Settings Module (60% - Company, Users, Permissions)

---

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Backend**: Supabase (PostgreSQL)
- **State Management**: React Context API
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Date Handling**: date-fns

---

## 📦 Prerequisites

### For Windows:
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- PowerShell 5.1+
- PostgreSQL client (optional, for direct DB access)

### For MacBook:
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- Terminal (Built-in)
- PostgreSQL client (optional)

### For Linux:
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- Bash
- PostgreSQL client (optional)

---

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Setup

Create a `.env.local` file in the root directory:

```bash
# For Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# For MacBook/Linux
touch .env.local
```

Add the following environment variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Connection (Optional - for direct SQL access)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
DATABASE_POOLER_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres
```

**Get your Supabase credentials:**
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy Project URL and anon/public key
5. Copy service_role key (keep it secret!)
6. Go to Settings → Database for connection strings

---

## 🗄 Database Setup

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to SQL Editor
4. Run the following scripts in order:

   **Core Schema:**
   - `supabase-extract/migrations/03_frontend_driven_schema.sql` - Main schema
   - `supabase-extract/functions.sql` - Functions & triggers

   **Accounting Module (Run these in order):**
   - `FIX_CORE_ACCOUNTING.sql` - Creates default accounts and core tables
   - `FIX_ACCOUNTING_SYSTEM_COMPLETE.sql` - Complete accounting system setup
   - `LEDGER_REDESIGN_AND_REFNO_FIX.sql` - Reference number generation and ledger fixes

   **Optional:**
   - `supabase-extract/migrations/16_chart_of_accounts.sql` - Chart of accounts (if needed)

### Option 2: Using psql (Command Line)

#### For Windows (PowerShell):

```powershell
# Set environment variables
$env:DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"

# Run SQL scripts
psql $env:DATABASE_URL -f FIX_CORE_ACCOUNTING.sql
psql $env:DATABASE_URL -f FIX_ACCOUNTING_SYSTEM_COMPLETE.sql
psql $env:DATABASE_URL -f LEDGER_REDESIGN_AND_REFNO_FIX.sql
```

#### For MacBook/Linux:

```bash
# Set environment variables
export DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"

# Run SQL scripts
psql $DATABASE_URL -f FIX_CORE_ACCOUNTING.sql
psql $DATABASE_URL -f FIX_ACCOUNTING_SYSTEM_COMPLETE.sql
psql $DATABASE_URL -f LEDGER_REDESIGN_AND_REFNO_FIX.sql
```

---

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

The application will start at: `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## 📊 Module Status

| Module | Status | Features |
|--------|--------|----------|
| Products | ✅ 100% | CRUD, Variations, Stock, Pricing |
| Purchases | ✅ 100% | PO Management, Payments, Ledger |
| Sales | ✅ 100% | Invoices, Payments, Shipping, History |
| Accounting | ✅ 95% | Journal Entries, Ledger, Transactions, Reference Numbers |
| Contacts | 🟡 80% | CRUD, Payments, Ledger |
| Inventory | 🟡 60% | Dashboard, Stock Tracking |
| Rentals | 🟡 50% | Booking, Management |
| Studio | 🟡 50% | Production, Workers |
| Expenses | 🟡 50% | Tracking, Categories |
| Reports | 🟡 40% | Dashboards, Charts |
| Settings | 🟡 60% | Company, Users, Permissions |

---

## 💰 Accounting Module

### Key Features

#### 1. **Double-Entry Bookkeeping**
- Every transaction creates balanced journal entries
- Automatic debit/credit validation
- Real-time account balance updates

#### 2. **Account Ledger (Bank Statement Style)**
- **Header**: Account Name, Type, Opening/Closing Balance, Date Range
- **Columns**: Date, Reference No (clickable), Description, Debit, Credit, Running Balance
- **Color Coding**: Green for positive, Red for negative
- **Sorting**: Date ASC, ID ASC

#### 3. **Reference Number System**
- **Sales Payment**: `PAY-0001`, `CASH-2026-0001`, `BANK-2026-0001`
- **Expense**: `EXP-0001`, `EXP-0002`
- **Manual Journal Entry**: `JE-0001`, `JE-0002`
- **Transfer**: `TRF-0001`, `TRF-0002`
- No UUIDs visible in UI - all references are short and readable

#### 4. **Default Accounts (Auto-Created)**
- Cash Account (Code: 1000)
- Bank Account (Code: 1010)
- Accounts Receivable (Code: 2000)
- Capital/Equity (Code: 3000)
- Sales Discount (Code: 4100)
- Commission Expense (Code: 5100)
- Extra Expense (Code: 5200)

#### 5. **Transaction Flow**
- Payment → Journal Entry → Account Balance Update
- Automatic journal entries for:
  - Sales payments
  - Expenses
  - Discounts
  - Commissions
  - Manual entries

#### 6. **Transaction Detail Modal**
- Click any reference number to view full transaction details
- Shows double-entry journal table
- Links to related sale/payment records
- Displays extra context (discounts, expenses, commissions)

### Database Tables

- `accounts` - Chart of accounts
- `journal_entries` - Journal entry headers
- `journal_entry_lines` - Double-entry lines
- `payments` - Payment records
- `sales` - Sales invoices

### SQL Functions

- `ensure_default_accounts()` - Auto-creates default accounts
- `generate_payment_reference()` - Payment reference numbers
- `generate_expense_reference()` - Expense reference numbers
- `generate_journal_entry_reference()` - Journal entry references
- `create_payment_journal_entry()` - Auto-creates journal for payments
- `create_extra_expense_journal_entry()` - Expense journal entries
- `create_discount_journal_entry()` - Discount journal entries
- `create_commission_journal_entry()` - Commission journal entries
- `update_account_balance_from_journal()` - Auto-updates account balances

---

## 📁 Project Structure

```
NEWPOSV3/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── accounting/      # Accounting module ✅
│   │   │   │   ├── AccountingDashboard.tsx
│   │   │   │   ├── AccountLedgerView.tsx
│   │   │   │   ├── TransactionDetailModal.tsx
│   │   │   │   └── ManualEntryDialog.tsx
│   │   │   ├── auth/           # Authentication
│   │   │   ├── contacts/       # Contacts module
│   │   │   ├── products/       # Products module ✅
│   │   │   ├── purchases/      # Purchases module ✅
│   │   │   ├── sales/          # Sales module ✅
│   │   │   ├── inventory/     # Inventory module
│   │   │   ├── rentals/        # Rentals module
│   │   │   ├── studio/         # Studio module
│   │   │   ├── expenses/       # Expenses module
│   │   │   ├── reports/        # Reports module
│   │   │   ├── settings/       # Settings module
│   │   │   ├── pos/            # POS system
│   │   │   ├── layout/         # Layout components
│   │   │   ├── shared/         # Shared components
│   │   │   └── ui/             # UI components
│   │   ├── context/            # React contexts
│   │   │   ├── AccountingContext.tsx
│   │   │   ├── SalesContext.tsx
│   │   │   ├── PurchaseContext.tsx
│   │   │   └── SupabaseContext.tsx
│   │   ├── hooks/              # Custom hooks
│   │   ├── services/           # API services
│   │   │   ├── accountingService.ts
│   │   │   ├── saleService.ts
│   │   │   ├── accountService.ts
│   │   │   └── defaultAccountsService.ts
│   │   └── utils/              # Utilities
│   └── lib/
│       └── supabase.ts         # Supabase client
├── supabase-extract/           # Database scripts
│   ├── migrations/             # Migration scripts
│   └── functions.sql           # Database functions
├── SQL Scripts/                # Accounting SQL fixes
│   ├── FIX_CORE_ACCOUNTING.sql
│   ├── FIX_ACCOUNTING_SYSTEM_COMPLETE.sql
│   └── LEDGER_REDESIGN_AND_REFNO_FIX.sql
├── .env.local                  # Environment variables (not in git)
├── package.json
└── README.md
```

---

## 🆕 Recent Updates

### January 2026 - Accounting Module Enhancement

#### ✅ Ledger Redesign (V2)
- Bank statement-style ledger view
- Opening/Closing balance display
- Fixed column order (Date, Reference, Description, Debit, Credit, Balance)
- Color-coded balances (Green positive, Red negative)
- Shows 0 instead of "-" for empty amounts

#### ✅ Reference Number System
- Short, readable reference numbers
- Formats: EXP-0001, JE-0002, TRF-0001, PAY-0001
- Auto-generation via database triggers
- No UUIDs in UI

#### ✅ Transaction Detail Modal
- Clickable reference numbers
- Full transaction details
- Double-entry journal table
- Linked records (sales, payments)

#### ✅ Account Balance Updates
- Real-time balance updates
- Automatic calculation from journal entries
- Proper opening/closing balance tracking

### Previous Updates

- ✅ Payment History Integration
- ✅ Default Accounts Auto-Creation
- ✅ Journal Entry Automation
- ✅ Expense Tracking
- ✅ Commission & Discount Handling

---

## 🔧 Development Workflow

### Git Workflow

```bash
# Check status
git status

# Add changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

### Working with Accounting Module

1. **Create a Sale** → Automatic journal entry created
2. **Receive Payment** → Payment record + journal entry
3. **View Ledger** → Account → Three Dots → View Ledger
4. **View Transaction** → Click Reference Number in ledger

---

## 🐛 Troubleshooting

### Common Issues

#### 1. **Port Already in Use**
```bash
# Kill process on port 5173 (MacBook/Linux)
lsof -ti:5173 | xargs kill -9

# Or change port in vite.config.ts
```

#### 2. **Supabase Connection Error**
- Check `.env.local` file exists
- Verify Supabase URL and keys are correct
- Check internet connection
- Verify Supabase project is active

#### 3. **Accounting Module Issues**
- Ensure SQL scripts are run in correct order
- Check default accounts exist (run `ensure_default_accounts()`)
- Verify journal_entries table exists
- Check account balances are updating

#### 4. **Reference Numbers Not Generating**
- Run `LEDGER_REDESIGN_AND_REFNO_FIX.sql`
- Check triggers are created
- Verify `entry_no` column exists in `journal_entries`

#### 5. **Module Not Found Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Environment Variables Reference

```env
# Required
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Connection (Optional)
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
DATABASE_POOLER_URL=postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:6543/postgres
```

---

## 📚 Documentation

- [Accounting System Fix Complete](./ACCOUNTING_SYSTEM_FIX_COMPLETE.md)
- [Ledger Redesign Complete](./LEDGER_REDESIGN_COMPLETE.md)
- [Database Setup Guide](./DATABASE_SETUP_COMPLETE.md)
- [How to Run SQL](./HOW_TO_RUN_SQL.md)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/NDM0313/NEWPOSV3/issues)
- Check documentation in root directory
- Review module-specific guides

---

## 🎯 Next Steps

1. ✅ Complete Accounting Module (95% done)
2. Complete remaining modules (Contacts, Inventory, etc.)
3. Add comprehensive testing
4. Optimize performance
5. Add more reports and analytics
6. Mobile app development

---

**Last Updated**: January 24, 2026  
**Version**: 3.0.0  
**Status**: Production Ready (Core Modules + Accounting)

---

## 🎉 Acknowledgments

- Built with [Supabase](https://supabase.com/)
- UI Components from [Shadcn UI](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
