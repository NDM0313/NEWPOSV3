# Expenses Management Module - Complete Specification

## 📋 Overview

**Module Name:** Expenses Management System  
**Purpose:** Track, categorize, and manage all business expenses with proper accounting standards  
**ERP System:** Din Collection - Bridal Rental Management  
**Design Standard:** Strict Dark Mode (#111827)  
**Architecture:** Professional drawer-based system with full audit trail

---

## 🎯 Core Objectives

1. **Expense Tracking**: Record all business expenses with proper categorization
2. **Vendor Management**: Link expenses to vendors/suppliers
3. **Payment Tracking**: Track payment methods and status
4. **Receipt Management**: Attach and manage expense receipts/documents
5. **Reporting**: Generate expense reports by category, vendor, date range
6. **Budget Control**: Monitor expenses against budgets (optional)
7. **Audit Compliance**: Maintain complete audit trail of all expense records

---

## 🏗️ Database Schema

### Table: `expenses`

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_number VARCHAR(50) UNIQUE NOT NULL, -- EXP-2026-0001
  date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  vendor_id UUID REFERENCES vendors(id),
  vendor_name VARCHAR(255), -- Cached for quick access
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL, -- amount + tax_amount
  payment_method VARCHAR(50) NOT NULL, -- cash, bank, card, online
  payment_status VARCHAR(50) NOT NULL, -- paid, pending, partial
  paid_amount DECIMAL(12, 2) DEFAULT 0,
  payment_reference VARCHAR(100), -- Cheque#, Transaction ID, etc.
  payment_date DATE,
  receipt_url TEXT, -- URL to uploaded receipt image/PDF
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(50), -- monthly, quarterly, yearly
  tags TEXT[], -- Array of tags for filtering
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_vendor ON expenses(vendor_id);
CREATE INDEX idx_expenses_status ON expenses(payment_status);
CREATE INDEX idx_expenses_number ON expenses(expense_number);
```

### Table: `expense_categories`

```sql
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  parent_category VARCHAR(100), -- For subcategories
  description TEXT,
  icon VARCHAR(50), -- Icon name for UI
  color VARCHAR(20), -- Color code for badges
  is_active BOOLEAN DEFAULT TRUE,
  budget_limit DECIMAL(12, 2), -- Optional monthly budget
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default Categories
INSERT INTO expense_categories (name, icon, color) VALUES
('Rent & Utilities', 'Home', 'blue'),
('Salaries & Wages', 'Users', 'green'),
('Inventory Purchase', 'Package', 'purple'),
('Marketing & Advertising', 'Megaphone', 'orange'),
('Transportation', 'Truck', 'red'),
('Office Supplies', 'FileText', 'cyan'),
('Maintenance & Repairs', 'Wrench', 'yellow'),
('Professional Fees', 'Briefcase', 'indigo'),
('Taxes & Licenses', 'Receipt', 'pink'),
('Miscellaneous', 'MoreHorizontal', 'gray');
```

### Table: `expense_payments`

```sql
CREATE TABLE expense_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_reference VARCHAR(100),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 UI/UX Specifications

### Design System

**Color Palette (Dark Mode):**
```css
--bg-primary: #111827;      /* Main background */
--bg-secondary: #1F2937;    /* Cards, panels */
--bg-tertiary: #374151;     /* Hover states */
--border-primary: #374151;  /* Main borders */
--border-secondary: #4B5563;/* Subtle borders */
--text-primary: #FFFFFF;    /* Primary text */
--text-secondary: #9CA3AF;  /* Secondary text */
--text-tertiary: #6B7280;   /* Tertiary text */
--accent-blue: #3B82F6;     /* Primary actions */
--accent-green: #10B981;    /* Success states */
--accent-red: #EF4444;      /* Danger states */
--accent-orange: #F59E0B;   /* Warning states */
```

**Typography:**
- Headers: `font-weight: 700` (Bold)
- Body: `font-weight: 400` (Regular)
- Labels: `font-weight: 500` (Medium)
- Small text: `font-size: 0.75rem` (12px)
- Body text: `font-size: 0.875rem` (14px)
- Headers: `font-size: 1.5rem` (24px)

**Spacing:**
- Card padding: `1.5rem` (24px)
- Section gap: `1.5rem` (24px)
- Input gap: `0.75rem` (12px)
- Border radius: `0.75rem` (12px)

---

## 📊 Main Dashboard Layout

### Header Section
```
┌─────────────────────────────────────────────────────────────────────┐
│ Expense Management                      [Filter] [Export] [+ Add]   │
│ Track and manage all business expenses                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Statistics Cards (5 Cards)
```
┌────────────────┬────────────────┬────────────────┬────────────────┬────────────────┐
│ 💰 TOTAL       │ ✅ PAID        │ ⏳ PENDING     │ 📊 THIS MONTH  │ 📈 THIS YEAR   │
│   EXPENSES     │   EXPENSES     │   EXPENSES     │   EXPENSES     │   EXPENSES     │
│                │                │                │                │                │
│   $125,450     │   $98,200      │   $27,250      │   $45,600      │   $892,340     │
│   850 Records  │   680 Paid     │   170 Pending  │   125 Records  │   850 Records  │
└────────────────┴────────────────┴────────────────┴────────────────┴────────────────┘
```

### Filters Section
```
┌─────────────────────────────────────────────────────────────────────┐
│ [🔍 Search...]  [Category ▼]  [Vendor ▼]  [Status ▼]  [Date Range] │
└─────────────────────────────────────────────────────────────────────┘
```

### Expense Table
```
┌────┬──────────────┬──────┬──────────┬─────────┬──────────┬────────┬────────┬─────────┐
│ #  │ Expense #    │ Date │ Category │ Vendor  │ Desc     │ Amount │ Status │ Actions │
├────┼──────────────┼──────┼──────────┼─────────┼──────────┼────────┼────────┼─────────┤
│ 🧾 │ EXP-2026-001 │ Jan 4│ 🏠 Rent  │ Landlord│ Monthly  │$5,000  │✅ Paid │ [👁️][✏️]│
│ 🧾 │ EXP-2026-002 │ Jan 3│ 👥 Salary│ Staff   │ Salaries │$12,500 │⏳ Pend │ [👁️][✏️]│
│ 🧾 │ EXP-2026-003 │ Jan 2│ 📦 Inven │ Supplier│ Fabric   │$3,200  │✅ Paid │ [👁️][✏️]│
└────┴──────────────┴──────┴──────────┴─────────┴──────────┴────────┴────────┴─────────┘
```

---

## 🎯 Features Breakdown

### 1. Add/Edit Expense Drawer

**Drawer Structure:**

```
┌────────────────────────────────────────────────────┐
│ ✕  Add New Expense                                 │
│    Record a new business expense                   │
├────────────────────────────────────────────────────┤
│                                                     │
│ ┌─ EXPENSE DETAILS ─────────────────────────────┐ │
│ │                                                 │ │
│ │ Expense Number: EXP-2026-0123 (auto-generated) │ │
│ │                                                 │ │
│ │ Date: [____________]                            │ │
│ │                                                 │ │
│ │ Category: [Select Category ▼]                  │ │
│ │                                                 │ │
│ │ Subcategory: [Select Subcategory ▼] (optional) │ │
│ │                                                 │ │
│ │ Vendor: [Select or Add Vendor ▼]              │ │
│ │                                                 │ │
│ │ Description: [________________________]         │ │
│ │              [________________________]         │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ AMOUNT DETAILS ───────────────────────────────┐ │
│ │                                                 │ │
│ │ Amount:        $_____________                   │ │
│ │ Tax/GST:       $_____________  (optional)       │ │
│ │ ────────────────────────────────                │ │
│ │ Total Amount:  $12,500.00                       │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ PAYMENT DETAILS ──────────────────────────────┐ │
│ │                                                 │ │
│ │ Payment Status:                                 │ │
│ │   ◉ Paid    ○ Pending    ○ Partial             │ │
│ │                                                 │ │
│ │ Payment Method:                                 │ │
│ │   [Cash ▼] [Bank ▼] [Card ▼] [Online ▼]      │ │
│ │                                                 │ │
│ │ Payment Date: [____________]                    │ │
│ │                                                 │ │
│ │ Payment Reference: [____________] (Cheque/TID)  │ │
│ │                                                 │ │
│ │ Paid Amount: $_____________                     │ │
│ │              (for partial payments)             │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ RECEIPT & NOTES ──────────────────────────────┐ │
│ │                                                 │ │
│ │ Receipt/Invoice:                                │ │
│ │   [📎 Upload Receipt] (Image/PDF)              │ │
│ │                                                 │ │
│ │ Notes: [_________________________________]       │ │
│ │        [_________________________________]       │ │
│ │        [_________________________________]       │ │
│ │                                                 │ │
│ │ Tags: [#office] [#urgent] [+ Add Tag]         │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ RECURRING EXPENSE (Optional) ────────────────┐ │
│ │                                                 │ │
│ │ ☐ This is a recurring expense                  │ │
│ │                                                 │ │
│ │ Frequency: [Monthly ▼] [Quarterly] [Yearly]   │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │                   [Cancel] [Save Expense]       │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 2. View Expense Details Drawer

**Read-Only Drawer for viewing expense details:**

```
┌────────────────────────────────────────────────────┐
│ ✕  Expense Details                                 │
│    EXP-2026-0123                                   │
├────────────────────────────────────────────────────┤
│                                                     │
│ ┌─ EXPENSE INFORMATION ──────────────────────────┐ │
│ │                                                 │ │
│ │ Expense Number:  EXP-2026-0123                 │ │
│ │ Date:            Jan 04, 2026                   │ │
│ │ Category:        🏠 Rent & Utilities           │ │
│ │ Subcategory:     Office Rent                    │ │
│ │ Vendor:          ABC Properties Ltd.            │ │
│ │ Description:     Monthly office rent payment    │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ AMOUNT BREAKDOWN ─────────────────────────────┐ │
│ │                                                 │ │
│ │ Base Amount:     $4,500.00                      │ │
│ │ Tax (GST):       $  500.00                      │ │
│ │ ───────────────────────────                     │ │
│ │ Total Amount:    $5,000.00                      │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ PAYMENT INFORMATION ──────────────────────────┐ │
│ │                                                 │ │
│ │ Status:          ✅ Paid                        │ │
│ │ Method:          🏦 Bank Transfer               │ │
│ │ Date:            Jan 04, 2026                   │ │
│ │ Reference:       TXN-98765432                   │ │
│ │ Amount Paid:     $5,000.00                      │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ RECEIPT ──────────────────────────────────────┐ │
│ │                                                 │ │
│ │ [📄 Invoice_Jan2026.pdf]  [View] [Download]    │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ ADDITIONAL DETAILS ───────────────────────────┐ │
│ │                                                 │ │
│ │ Notes:           Monthly rent paid on time      │ │
│ │ Tags:            #rent #office #monthly         │ │
│ │ Created By:      Admin User                     │ │
│ │ Created On:      Jan 04, 2026 10:30 AM         │ │
│ │                                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │          [✏️ Edit] [🗑️ Delete] [Close]         │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 3. Payment Status Badges

```tsx
// Badge Colors
const statusConfig = {
  paid: {
    color: 'bg-green-500/10 text-green-400 border-green-500/20',
    icon: CheckCircle,
    label: 'Paid'
  },
  pending: {
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    icon: Clock,
    label: 'Pending'
  },
  partial: {
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: AlertCircle,
    label: 'Partial'
  },
  overdue: {
    color: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: AlertTriangle,
    label: 'Overdue'
  }
};
```

### 4. Category Icons & Colors

```tsx
const categoryConfig = {
  'Rent & Utilities': { icon: Home, color: 'blue' },
  'Salaries & Wages': { icon: Users, color: 'green' },
  'Inventory Purchase': { icon: Package, color: 'purple' },
  'Marketing & Advertising': { icon: Megaphone, color: 'orange' },
  'Transportation': { icon: Truck, color: 'red' },
  'Office Supplies': { icon: FileText, color: 'cyan' },
  'Maintenance & Repairs': { icon: Wrench, color: 'yellow' },
  'Professional Fees': { icon: Briefcase, color: 'indigo' },
  'Taxes & Licenses': { icon: Receipt, color: 'pink' },
  'Miscellaneous': { icon: MoreHorizontal, color: 'gray' }
};
```

---

## 📁 Component Structure

```
/src/app/components/expenses/
├── ExpensesDashboard.tsx          # Main dashboard with table
├── AddExpenseDrawer.tsx           # Add/Edit expense form
├── ViewExpenseDrawer.tsx          # View expense details
├── ExpenseFilters.tsx             # Filter component
├── ExpenseStatsCards.tsx          # Statistics cards
├── ExpenseTable.tsx               # Data table component
├── CategoryManager.tsx            # Manage categories (optional)
└── ExpenseReports.tsx             # Reporting component (optional)
```

---

## 🔧 Technical Implementation

### State Management

```tsx
interface Expense {
  id: string;
  expenseNumber: string;
  date: string;
  category: string;
  subcategory?: string;
  vendorId?: string;
  vendorName?: string;
  description: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'bank' | 'card' | 'online';
  paymentStatus: 'paid' | 'pending' | 'partial' | 'overdue';
  paidAmount: number;
  paymentReference?: string;
  paymentDate?: string;
  receiptUrl?: string;
  notes?: string;
  isRecurring: boolean;
  recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
  tags?: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseFilters {
  searchTerm: string;
  category: string | 'all';
  vendor: string | 'all';
  status: 'paid' | 'pending' | 'partial' | 'all';
  dateRange: { start: string; end: string } | null;
}
```

### Key Functions

```tsx
// Generate unique expense number
const generateExpenseNumber = (lastNumber: string): string => {
  const year = new Date().getFullYear();
  const lastNum = parseInt(lastNumber.split('-')[2] || '0');
  const newNum = String(lastNum + 1).padStart(4, '0');
  return `EXP-${year}-${newNum}`;
};

// Calculate total amount
const calculateTotal = (amount: number, taxAmount: number): number => {
  return amount + taxAmount;
};

// Filter expenses
const filterExpenses = (
  expenses: Expense[],
  filters: ExpenseFilters
): Expense[] => {
  return expenses.filter(expense => {
    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      if (
        !expense.expenseNumber.toLowerCase().includes(term) &&
        !expense.description.toLowerCase().includes(term) &&
        !expense.vendorName?.toLowerCase().includes(term)
      ) {
        return false;
      }
    }

    // Category filter
    if (filters.category !== 'all' && expense.category !== filters.category) {
      return false;
    }

    // Status filter
    if (filters.status !== 'all' && expense.paymentStatus !== filters.status) {
      return false;
    }

    // Date range filter
    if (filters.dateRange) {
      const expenseDate = new Date(expense.date);
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      if (expenseDate < start || expenseDate > end) {
        return false;
      }
    }

    return true;
  });
};

// Calculate statistics
const calculateStats = (expenses: Expense[]) => {
  const total = expenses.reduce((sum, exp) => sum + exp.totalAmount, 0);
  const paid = expenses
    .filter(exp => exp.paymentStatus === 'paid')
    .reduce((sum, exp) => sum + exp.totalAmount, 0);
  const pending = expenses
    .filter(exp => exp.paymentStatus === 'pending')
    .reduce((sum, exp) => sum + exp.totalAmount, 0);
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const thisMonth = expenses
    .filter(exp => {
      const date = new Date(exp.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    })
    .reduce((sum, exp) => sum + exp.totalAmount, 0);
  
  const thisYear = expenses
    .filter(exp => new Date(exp.date).getFullYear() === currentYear)
    .reduce((sum, exp) => sum + exp.totalAmount, 0);

  return { total, paid, pending, thisMonth, thisYear };
};
```

---

## ✅ Validation Rules

### Required Fields
- ✅ Date
- ✅ Category
- ✅ Description
- ✅ Amount (must be > 0)
- ✅ Payment Status
- ✅ Payment Method (if status is 'paid')

### Conditional Fields
- Payment Date (required if status is 'paid')
- Payment Reference (optional but recommended for bank/online)
- Paid Amount (required if status is 'partial')

### Business Rules
1. Total Amount = Amount + Tax Amount
2. If Payment Status = 'Partial', Paid Amount < Total Amount
3. If Payment Status = 'Paid', Paid Amount = Total Amount
4. Expense Number must be unique (auto-generated)
5. Date cannot be in the future
6. If recurring, frequency is required

---

## 🔐 User Permissions

```tsx
const permissions = {
  viewExpenses: ['admin', 'manager', 'accountant', 'viewer'],
  addExpense: ['admin', 'manager', 'accountant'],
  editExpense: ['admin', 'manager', 'accountant'],
  deleteExpense: ['admin', 'manager'],
  approveExpense: ['admin', 'manager'],
  exportReports: ['admin', 'manager', 'accountant']
};
```

---

## 📊 Reports & Analytics (Optional)

### Report Types
1. **Expense by Category** - Pie chart showing distribution
2. **Monthly Trend** - Line chart showing monthly expenses
3. **Vendor-wise Expenses** - Bar chart of top vendors
4. **Payment Status Overview** - Donut chart of payment statuses
5. **Tax Summary** - Total tax paid by period

---

## 🚀 Implementation Checklist

### Phase 1: Core Features
- [ ] Create database schema and migrations
- [ ] Build ExpensesDashboard component
- [ ] Implement statistics cards
- [ ] Create AddExpenseDrawer with full form
- [ ] Implement ViewExpenseDrawer
- [ ] Add filtering and search functionality
- [ ] Build expense table with sorting

### Phase 2: Enhanced Features
- [ ] Receipt upload functionality
- [ ] Payment tracking for partial payments
- [ ] Recurring expenses automation
- [ ] Vendor quick-add from expense form
- [ ] Bulk actions (delete, export)
- [ ] Category management interface

### Phase 3: Advanced Features
- [ ] Expense approval workflow
- [ ] Budget alerts and notifications
- [ ] Advanced reporting dashboard
- [ ] Email receipt forwarding
- [ ] Mobile app integration
- [ ] OCR for receipt scanning

---

## 📝 Sample Data

```tsx
const sampleExpenses: Expense[] = [
  {
    id: '1',
    expenseNumber: 'EXP-2026-0001',
    date: '2026-01-04',
    category: 'Rent & Utilities',
    subcategory: 'Office Rent',
    vendorName: 'ABC Properties Ltd.',
    description: 'Monthly office rent for January 2026',
    amount: 4500,
    taxAmount: 500,
    totalAmount: 5000,
    paymentMethod: 'bank',
    paymentStatus: 'paid',
    paidAmount: 5000,
    paymentReference: 'TXN-98765432',
    paymentDate: '2026-01-04',
    notes: 'Paid on time',
    isRecurring: true,
    recurringFrequency: 'monthly',
    tags: ['rent', 'office', 'monthly'],
    createdAt: '2026-01-04T10:30:00Z',
    updatedAt: '2026-01-04T10:30:00Z'
  },
  {
    id: '2',
    expenseNumber: 'EXP-2026-0002',
    date: '2026-01-03',
    category: 'Salaries & Wages',
    description: 'Staff salaries for December 2025',
    amount: 12000,
    taxAmount: 500,
    totalAmount: 12500,
    paymentMethod: 'bank',
    paymentStatus: 'pending',
    paidAmount: 0,
    isRecurring: true,
    recurringFrequency: 'monthly',
    tags: ['salary', 'staff'],
    createdAt: '2026-01-03T15:20:00Z',
    updatedAt: '2026-01-03T15:20:00Z'
  },
  {
    id: '3',
    expenseNumber: 'EXP-2026-0003',
    date: '2026-01-02',
    category: 'Inventory Purchase',
    vendorName: 'Silk Traders Co.',
    description: 'Bulk fabric purchase - Red Velvet',
    amount: 3000,
    taxAmount: 200,
    totalAmount: 3200,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    paidAmount: 3200,
    paymentDate: '2026-01-02',
    isRecurring: false,
    tags: ['fabric', 'inventory'],
    createdAt: '2026-01-02T11:45:00Z',
    updatedAt: '2026-01-02T11:45:00Z'
  }
];
```

---

## 🎯 Success Metrics

1. **Usability**: User can add an expense in < 2 minutes
2. **Accuracy**: 100% accurate total calculations
3. **Performance**: Table loads < 1 second with 1000+ records
4. **Data Integrity**: All expenses have proper audit trail
5. **Compliance**: Meets accounting standards for expense tracking

---

## 📞 Support & Maintenance

### Common Issues
1. **Receipt upload fails**: Check file size limit (max 5MB)
2. **Duplicate expense numbers**: Reset sequence in database
3. **Filter not working**: Clear cache and reload
4. **Total calculation error**: Check tax amount field

### Backup & Recovery
- Daily automatic backups of expenses table
- Export functionality for manual backups
- Restore from backup within 1 hour if needed

---

## 🔗 Integration Points

1. **Vendors Module**: Link expenses to vendor records
2. **Accounting Module**: Sync with general ledger
3. **Reports Module**: Include in financial reports
4. **Budget Module**: Compare against budgets
5. **Approval Workflow**: Route for manager approval

---

## 📚 Additional Resources

- **Accounting Standards**: Follow standard expense categorization
- **Tax Compliance**: Ensure proper tax calculation and reporting
- **Audit Requirements**: Maintain complete audit trail
- **Best Practices**: Regular reconciliation and review

---

## 🎨 Design Mockups Reference

All UI components must follow the design system specified in:
- `/docs/modules/POS_System_Design.md` - For color tokens and spacing
- Strict Dark Mode (#111827) - No light theme
- Professional drawer-based interface - No modals or popups
- Compact table layout - Enterprise ERP standard

---

## ✅ Final Checklist

- [ ] All required fields validated
- [ ] Proper error handling
- [ ] Loading states implemented
- [ ] Success/failure notifications
- [ ] Audit logging enabled
- [ ] Responsive design (desktop-first)
- [ ] Keyboard shortcuts (optional)
- [ ] Export to CSV/PDF
- [ ] Print-friendly views
- [ ] Help tooltips on complex fields

---

**Document Version:** 1.0  
**Last Updated:** January 4, 2026  
**Author:** Din Collection ERP Team  
**Status:** Ready for Implementation

---

## 🚀 Quick Start Command for Cursor AI

```
Create a complete Expenses Management module for Din Collection ERP based on the specifications in this document. Use strict dark mode (#111827), professional drawer-based UI, and follow all technical requirements. Implement ExpensesDashboard, AddExpenseDrawer, and ViewExpenseDrawer with full functionality including statistics cards, filtering, search, and expense table with proper validation and audit logging.
```

---

**End of Document**
