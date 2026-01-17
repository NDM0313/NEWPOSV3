# Expenses Module - Quick Implementation Guide

## 🎯 For Cursor AI Agent

### Single Command Implementation

```
Based on /docs/modules/Expenses_Management_Module.md, create a complete Expenses Management System with:

1. ExpensesDashboard.tsx - Main dashboard with 5 statistics cards, search, filters (category, vendor, status, date range), and expense table
2. AddExpenseDrawer.tsx - Right-side drawer (600px) with expense form including all fields from spec
3. ViewExpenseDrawer.tsx - Read-only drawer showing expense details

Use strict dark mode (#111827), professional drawer overlays, validate all inputs, and include audit logging. Follow the exact UI layout and field structure from the documentation.
```

---

## 📋 Key Components to Create

### 1. ExpensesDashboard.tsx
**Location:** `/src/app/components/expenses/ExpensesDashboard.tsx`

**Includes:**
- Header with title and action buttons
- 5 statistics cards (Total, Paid, Pending, This Month, This Year)
- Filter bar (Search, Category, Vendor, Status, Date Range)
- Expense table with columns: #, Expense#, Date, Category, Vendor, Description, Amount, Status, Actions
- Empty state when no expenses found

### 2. AddExpenseDrawer.tsx
**Location:** `/src/app/components/expenses/AddExpenseDrawer.tsx`

**Sections:**
- Expense Details (Date, Category, Subcategory, Vendor, Description)
- Amount Details (Amount, Tax, Total)
- Payment Details (Status, Method, Date, Reference, Paid Amount)
- Receipt & Notes (Upload, Notes, Tags)
- Recurring Expense (Checkbox, Frequency)

**Validation:**
- Required: Date, Category, Description, Amount, Payment Status
- Conditional: Payment Date (if paid), Paid Amount (if partial)
- Business Logic: Total = Amount + Tax

### 3. ViewExpenseDrawer.tsx
**Location:** `/src/app/components/expenses/ViewExpenseDrawer.tsx`

**Sections:**
- Expense Information (read-only)
- Amount Breakdown (read-only)
- Payment Information (read-only)
- Receipt (view/download buttons)
- Additional Details (Notes, Tags, Created By, Created On)
- Action buttons (Edit, Delete, Close)

---

## 🎨 Design Tokens

```tsx
// Colors
const colors = {
  background: '#111827',
  card: '#1F2937',
  border: '#374151',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  accent: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444'
};

// Status Badges
const statusBadges = {
  paid: 'bg-green-500/10 text-green-400 border-green-500/20',
  pending: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  partial: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20'
};

// Category Icons (from lucide-react)
import { Home, Users, Package, Megaphone, Truck, FileText, Wrench, Briefcase, Receipt, MoreHorizontal } from 'lucide-react';
```

---

## 📊 Sample Data Structure

```tsx
const sampleExpense = {
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
  receiptUrl: null,
  notes: 'Paid on time',
  isRecurring: true,
  recurringFrequency: 'monthly',
  tags: ['rent', 'office', 'monthly'],
  createdAt: '2026-01-04T10:30:00Z'
};
```

---

## ✅ Implementation Checklist

- [ ] Create `/src/app/components/expenses/` directory
- [ ] Build `ExpensesDashboard.tsx` with statistics and table
- [ ] Build `AddExpenseDrawer.tsx` with complete form
- [ ] Build `ViewExpenseDrawer.tsx` with read-only view
- [ ] Add expense route in `App.tsx`: `{currentView === 'expenses' && <ExpensesDashboard />}`
- [ ] Update Sidebar with Expenses navigation (if not exists)
- [ ] Implement filtering and search logic
- [ ] Add form validation
- [ ] Implement expense number auto-generation
- [ ] Add success/error toast notifications
- [ ] Test all CRUD operations

---

## 🔧 Key Functions

```tsx
// Auto-generate expense number
const generateExpenseNumber = () => {
  const year = new Date().getFullYear();
  const lastNum = 1; // Get from database
  return `EXP-${year}-${String(lastNum).padStart(4, '0')}`;
};

// Calculate total
const calculateTotal = (amount: number, tax: number) => amount + tax;

// Filter expenses
const filterExpenses = (expenses, filters) => {
  return expenses.filter(exp => {
    // Search
    if (filters.search && !exp.expenseNumber.includes(filters.search)) return false;
    // Category
    if (filters.category !== 'all' && exp.category !== filters.category) return false;
    // Status
    if (filters.status !== 'all' && exp.paymentStatus !== filters.status) return false;
    return true;
  });
};

// Calculate stats
const calculateStats = (expenses) => ({
  total: expenses.reduce((sum, exp) => sum + exp.totalAmount, 0),
  paid: expenses.filter(e => e.paymentStatus === 'paid').reduce((sum, exp) => sum + exp.totalAmount, 0),
  pending: expenses.filter(e => e.paymentStatus === 'pending').reduce((sum, exp) => sum + exp.totalAmount, 0),
  thisMonth: expenses.filter(e => isThisMonth(e.date)).reduce((sum, exp) => sum + exp.totalAmount, 0),
  thisYear: expenses.filter(e => isThisYear(e.date)).reduce((sum, exp) => sum + exp.totalAmount, 0)
});
```

---

## 🎯 Categories List

```tsx
const categories = [
  { name: 'Rent & Utilities', icon: Home, color: 'blue' },
  { name: 'Salaries & Wages', icon: Users, color: 'green' },
  { name: 'Inventory Purchase', icon: Package, color: 'purple' },
  { name: 'Marketing & Advertising', icon: Megaphone, color: 'orange' },
  { name: 'Transportation', icon: Truck, color: 'red' },
  { name: 'Office Supplies', icon: FileText, color: 'cyan' },
  { name: 'Maintenance & Repairs', icon: Wrench, color: 'yellow' },
  { name: 'Professional Fees', icon: Briefcase, color: 'indigo' },
  { name: 'Taxes & Licenses', icon: Receipt, color: 'pink' },
  { name: 'Miscellaneous', icon: MoreHorizontal, color: 'gray' }
];
```

---

## 🚀 Integration Points

1. **App.tsx** - Add route:
```tsx
{currentView === 'expenses' && <ExpensesDashboard />}
```

2. **Sidebar.tsx** - Add navigation:
```tsx
{ id: 'expenses', label: 'Expenses', icon: Receipt }
```

3. **Import in App.tsx**:
```tsx
import { ExpensesDashboard } from './components/expenses/ExpensesDashboard';
```

---

## 📝 Notes for AI Agent

1. **Drawer Width**: 600px, right-side overlay
2. **Table**: Compact rows, hover effects, clickable rows
3. **Form Validation**: Show errors inline, red border + message
4. **Success Messages**: Use toast notifications (sonner)
5. **Loading States**: Show spinner during operations
6. **Empty States**: Friendly message + icon when no data
7. **Responsive**: Desktop-first, mobile adjustments if needed
8. **Icons**: Use lucide-react package
9. **Date Format**: Use `Jan 04, 2026` format for display
10. **Currency Format**: Use `$1,250.00` format with commas

---

## 🎨 UI Components Needed

From existing UI library:
- `Button` from `../ui/button`
- `Input` from `../ui/input`
- `Label` from `../ui/label`
- `Select` from `../ui/select`
- `Textarea` from `../ui/textarea`
- `Badge` from `../ui/badge`

---

## ⚡ Quick Testing

After implementation, test:
1. Open Expenses from sidebar
2. Click "Add Expense" button
3. Fill form with valid data
4. Submit and verify table updates
5. Click View icon on expense row
6. Verify details display correctly
7. Test filters (search, category, status)
8. Verify statistics update correctly

---

**Ready to implement!** 🚀

Just give Cursor AI the command at the top of this file, and it will build the complete Expenses module based on the full specification.
