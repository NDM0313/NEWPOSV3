# ⚡ DIN COLLECTION ERP - QUICK REFERENCE

## 🎯 KEYBOARD SHORTCUTS (CHEAT SHEET)

### Navigation (Press `Ctrl+/` to see full list)
```
Ctrl+1  →  Dashboard
Ctrl+2  →  Products
Ctrl+3  →  Inventory
Ctrl+4  →  Sales
Ctrl+5  →  Purchases
Ctrl+6  →  Rentals
Ctrl+7  →  Expenses
Ctrl+8  →  Accounting
Ctrl+9  →  Reports
Ctrl+0  →  Settings
Ctrl+P  →  POS
Ctrl+H  →  Dashboard (Home)
```

### Actions
```
Ctrl+N  →  New Entry
Ctrl+S  →  Save
Ctrl+F  →  Search
F2      →  Edit
F4      →  Delete
Esc     →  Close Dialog
Ctrl+/  →  Show Shortcuts Help
```

---

## 🚀 COMMON WORKFLOWS

### Create New Sale/Invoice
1. **Press** `Ctrl+4` (Go to Sales)
2. **Click** "+ New Sale" or press `Ctrl+N`
3. **Select** Customer
4. **Add** Products
5. **Choose** Payment Method → Account auto-selects
6. **Press** `Ctrl+S` to save
7. ✅ Auto-posts to Accounting

### Make Payment (Receive/Pay)
1. **Open** Sale/Purchase/Expense
2. **Click** "Make Payment" or "Receive Payment"
3. **Enter** Amount
4. **Select** Payment Method → Account auto-selects ✨
5. **Attach** receipt (optional)
6. **Add** Notes (optional)
7. **Click** Confirm
8. ✅ Auto-posts to Accounting

### Check Account Balance
1. **Press** `Ctrl+8` (Go to Accounting)
2. **Click** "Accounts" tab
3. **View** real-time balances
4. **Click** account to see ledger

### View Reports
1. **Press** `Ctrl+9` (Go to Reports)
2. **Select** report type
3. **Choose** date range
4. **View** analytics
5. **Export** (if needed)

### Configure Settings
1. **Press** `Ctrl+0` (Go to Settings)
2. **Select** category tab
3. **Modify** settings
4. **Click** "Save Settings"
5. ✅ Changes apply system-wide

---

## 💡 PRO TIPS

### Faster Data Entry
- ✅ **Numeric fields**: Click once to auto-select
- ✅ **0 values**: Show as empty (cleaner UI)
- ✅ **Default accounts**: Auto-select based on payment method
- ✅ **Document numbers**: Auto-generate (INV-0001, INV-0002...)

### Power User Features
- ✅ Use number keys (`Ctrl+1-9`) to jump between modules
- ✅ Press `Ctrl+F` to search in any page
- ✅ Press `Esc` to close dialogs quickly
- ✅ Press `Ctrl+/` anytime to view shortcuts

### Settings Configuration
1. **Set Default Accounts** once → Use everywhere
2. **Configure Numbering Rules** → Auto-increment forever
3. **Enable/Disable Modules** → Show only what you need
4. **Add Branches** → Multi-location management

---

## 🎨 STATUS COLOR GUIDE

### Document Status
```
Grey   🔘  Draft
Yellow 🟡  Quotation
Blue   🔵  Order
Green  🟢  Final/Complete
Red    🔴  Cancelled
```

### Payment Status
```
Green  🟢  Paid
Orange 🟠  Partial
Red    🔴  Unpaid
```

### Stock Status
```
Green  🟢  In Stock
Orange 🟠  Low Stock
Red    🔴  Out of Stock
```

---

## 📋 QUICK CHECKLIST

### Daily Operations
- [ ] Check low stock alerts (Inventory)
- [ ] Process pending orders (Sales)
- [ ] Review outstanding payments (Accounting)
- [ ] Approve expenses (Expenses)
- [ ] Update rental bookings (Rentals)
- [ ] Monitor studio jobs (Studio)

### Weekly Tasks
- [ ] Review sales reports
- [ ] Check supplier payments
- [ ] Reconcile bank accounts
- [ ] Update inventory levels
- [ ] Review profit margins

### Monthly Tasks
- [ ] Generate financial reports
- [ ] Close accounting period
- [ ] Review budget vs actual
- [ ] Update pricing (if needed)
- [ ] Backup data

---

## 🔧 TROUBLESHOOTING

### Payment not posting to accounting?
✅ Check if Accounting module is enabled (Settings → Modules)
✅ Verify default accounts are configured
✅ Ensure payment method selected

### Document number not incrementing?
✅ Go to Settings → Numbering Rules
✅ Check "Next Number" value
✅ Verify prefix is correct

### Keyboard shortcuts not working?
✅ Make sure you're not in an input field
✅ Try `Ctrl+/` to verify shortcuts are active
✅ Refresh page if needed

### Chart not displaying?
✅ Resize window
✅ Refresh page
✅ Check browser console for errors

---

## 📱 MODULE QUICK ACCESS

### POS (Point of Sale)
- **Shortcut:** `Ctrl+P`
- **Use For:** Quick cash sales
- **Features:** Fast product selection, instant checkout

### Sales
- **Shortcut:** `Ctrl+4`
- **Use For:** Invoices, quotations, customer management
- **Features:** Payment tracking, shipping status

### Purchases
- **Shortcut:** `Ctrl+5`
- **Use For:** Purchase orders, supplier payments
- **Features:** Stock receiving, payment scheduling

### Rentals
- **Shortcut:** `Ctrl+6`
- **Use For:** Booking management, rental tracking
- **Features:** Calendar view, deposit management

### Studio
- **Shortcut:** Not assigned (navigate via sidebar)
- **Use For:** Production orders, worker management
- **Features:** Job cards, cost allocation

### Expenses
- **Shortcut:** `Ctrl+7`
- **Use For:** Operating expenses, budget tracking
- **Features:** Categories, approval workflow

### Inventory
- **Shortcut:** `Ctrl+3`
- **Use For:** Stock management, alerts
- **Features:** Multi-location, barcode support

### Accounting
- **Shortcut:** `Ctrl+8`
- **Use For:** Financial tracking, ledgers
- **Features:** Double-entry, real-time balances

### Reports
- **Shortcut:** `Ctrl+9`
- **Use For:** Analytics, insights
- **Features:** Custom dates, export options

### Settings
- **Shortcut:** `Ctrl+0`
- **Use For:** System configuration
- **Features:** 13 categories, full control

---

## 🎯 DEFAULT ACCOUNTS SETUP

### Why Set Default Accounts?
When you configure default accounts, the system automatically selects the right account when making payments. This saves time and reduces errors.

### How to Configure
1. Press `Ctrl+0` (Settings)
2. Click "Default Accounts" tab
3. Select default for:
   - **Cash** (e.g., "Cash Drawer")
   - **Bank** (e.g., "Meezan Bank")
   - **Mobile Wallet** (e.g., "JazzCash")
4. Click "Save Settings"

### Benefits
- ✅ Auto-selects account in payment dialogs
- ✅ Reduces clicks
- ✅ Prevents wrong account selection
- ✅ Works across ALL modules

---

## 📊 ACCOUNTING INTEGRATION

### How It Works
```
User Action → Module → AccountingContext → Journal Entry → Ledger
```

### What Auto-Posts?
- ✅ Sales (Revenue + Receivables)
- ✅ Purchases (Expense + Payables)
- ✅ Payments (Cash/Bank movements)
- ✅ Rentals (Rental Income + Deposits)
- ✅ Studio Costs (Labor + Materials)
- ✅ Expenses (Operating Expenses)

### Key Rules
- **Double-Entry:** Every transaction has Debit & Credit
- **Immutable:** Cannot edit posted entries
- **Real-Time:** Balances update instantly
- **Automatic:** No manual journal entries needed

---

## 💾 DATA SAFETY

### Current Status
- ✅ Form validation prevents bad data
- ✅ Confirmation dialogs for deletions
- ✅ Immutable accounting entries
- ✅ Local storage backup (browser)

### Recommended Practices
- 🔵 Backup data regularly (future feature)
- 🔵 Train users on system
- 🔵 Review reports weekly
- 🔵 Test before production deployment

---

## 🌟 SYSTEM HIGHLIGHTS

### What Makes This ERP Special?
1. **Unified Payment System** - One dialog for all payments
2. **Auto-Integration** - Modules talk to accounting automatically
3. **Smart Defaults** - Less typing, more productivity
4. **Keyboard Shortcuts** - Power user paradise
5. **Dark Theme** - Easy on eyes, professional look
6. **Comprehensive** - 10 modules, fully integrated

### Built For
- ✅ Bridal rental businesses
- ✅ Fashion retail & wholesale
- ✅ Production studios
- ✅ Multi-branch operations
- ✅ Growing businesses

---

## 📞 NEED HELP?

### In-App Help
- **Press** `Ctrl+/` for keyboard shortcuts
- **Check** tooltips on hover
- **Read** validation messages
- **Watch** toast notifications

### Documentation
- `/IMPLEMENTATION_COMPLETE.md` - Full system overview
- `/PRODUCTION_READY_SUMMARY.md` - Technical details
- `/QUICK_REFERENCE.md` - This guide

---

## 🚀 GETTING STARTED

### First Time Setup (5 minutes)
1. **Settings** (`Ctrl+0`)
2. **Company Profile** - Add business details
3. **Branches** - Add locations
4. **Default Accounts** - Configure payment accounts
5. **Numbering Rules** - Set document prefixes
6. **Module Settings** - Enable what you need

### Start Using
1. **Add Products** (`Ctrl+2`)
2. **Create First Sale** (`Ctrl+4`)
3. **Receive Payment** (Built into sales flow)
4. **Check Accounting** (`Ctrl+8`) - See auto-posted entries
5. **View Reports** (`Ctrl+9`)

### You're Done! 🎉
The system is now configured and ready for daily use.

---

**Remember:** Press `Ctrl+/` anytime to view full keyboard shortcuts!

**Built for Din Collection** | Version 1.0.0 | January 2026
