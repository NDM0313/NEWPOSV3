># 🚀 DIN COLLECTION ERP - SUPABASE DATABASE SCHEMA

**Complete Database Design for Production-Ready ERP System**

**Version:** 1.0.0  
**Date:** January 18, 2026  
**Database:** PostgreSQL (Supabase)  
**Schema Type:** Multi-tenant with Row Level Security (RLS)

---

## 📋 **TABLE OF CONTENTS**

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Database Structure](#database-structure)
4. [Tables Reference](#tables-reference)
5. [Security (RLS)](#security-rls)
6. [Functions & Triggers](#functions--triggers)
7. [Cursor AI Implementation](#cursor-ai-implementation)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 **OVERVIEW**

### **What's Included:**

```
/supabase
├── schema.sql          # Complete database schema (35 tables)
├── rls-policies.sql    # Row Level Security policies
├── functions.sql       # Business logic functions & triggers
├── seed.sql            # Demo data for testing
└── README.md           # This file
```

### **Database Features:**

✅ **35 Tables** covering all ERP modules  
✅ **Multi-tenant** architecture (company-based isolation)  
✅ **Row Level Security** (RLS) for data protection  
✅ **Auto-numbering** for documents (INV-0001, PO-0001, etc.)  
✅ **Auto-posting** to accounting (double-entry)  
✅ **Stock management** with automatic updates  
✅ **Audit logging** for compliance  
✅ **Contact balance** tracking  
✅ **Payment tracking** integrated  
✅ **Permission system** (role-based access)  

---

## 🚀 **QUICK START**

### **Step 1: Create Supabase Project**

1. Go to [https://supabase.com](https://supabase.com)
2. Create new project
3. Choose region closest to you
4. Save your database password

### **Step 2: Run SQL Scripts (IN ORDER)**

```sql
-- 1. Create schema and tables
-- Copy content from schema.sql and run in SQL Editor
-- ✅ This creates all 35 tables

-- 2. Apply RLS policies
-- Copy content from rls-policies.sql and run
-- ✅ This secures your data

-- 3. Create functions and triggers
-- Copy content from functions.sql and run
-- ✅ This adds business logic

-- 4. Insert seed data (optional - for testing)
-- Copy content from seed.sql and run
-- ✅ This adds demo data
```

### **Step 3: Configure Supabase in Your App**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### **Step 4: Test Connection**

```typescript
// Test query
const { data, error } = await supabase
  .from('companies')
  .select('*')
  .limit(1);

console.log(data); // Should show Din Collection
```

---

## 📊 **DATABASE STRUCTURE**

### **Table Groups:**

```
1. CORE (4 tables)
   ├─ companies
   ├─ branches
   ├─ users
   └─ user_branches

2. CONTACTS (1 table)
   └─ contacts

3. PRODUCTS & INVENTORY (4 tables)
   ├─ product_categories
   ├─ products
   ├─ product_variations
   └─ stock_movements

4. SALES (2 tables)
   ├─ sales
   └─ sale_items

5. PURCHASES (2 tables)
   ├─ purchases
   └─ purchase_items

6. RENTALS (2 tables)
   ├─ rentals
   └─ rental_items

7. STUDIO (4 tables)
   ├─ studio_orders
   ├─ studio_order_items
   ├─ workers
   └─ job_cards

8. EXPENSES (1 table)
   └─ expenses

9. ACCOUNTING (4 tables)
   ├─ accounts
   ├─ journal_entries
   ├─ journal_entry_lines
   └─ payments

10. SETTINGS (3 tables)
    ├─ settings
    ├─ modules_config
    └─ document_sequences

11. SECURITY (2 tables)
    ├─ permissions
    └─ audit_logs

TOTAL: 35 TABLES
```

---

## 📚 **TABLES REFERENCE**

### **1. Companies & Branches**

#### **`companies`**
Stores company/organization information.

```sql
id UUID PRIMARY KEY
name VARCHAR(255) -- Company name
email VARCHAR(255)
phone VARCHAR(50)
address TEXT
city, state, country
tax_number VARCHAR(100)
currency VARCHAR(10) DEFAULT 'PKR'
is_active BOOLEAN
created_at, updated_at TIMESTAMPTZ
```

#### **`branches`**
Multi-branch support for the company.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
name VARCHAR(255) -- Branch name
code VARCHAR(50) UNIQUE -- e.g., 'HQ', 'DHA'
manager_id UUID REFERENCES users
is_active BOOLEAN
```

---

### **2. Users & Permissions**

#### **`users`**
User accounts linked to Supabase Auth.

```sql
id UUID PRIMARY KEY REFERENCES auth.users
company_id UUID REFERENCES companies
email VARCHAR(255) UNIQUE
full_name VARCHAR(255)
phone VARCHAR(50)
role user_role -- 'admin', 'manager', 'accountant', etc.
is_active BOOLEAN
```

**Roles:**
- `admin` - Full access
- `manager` - Most features
- `accountant` - Financial only
- `salesperson` - POS & Sales
- `inventory_clerk` - Stock only
- `viewer` - Read-only

#### **`permissions`**
Granular permissions per module.

```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users
module VARCHAR(100) -- 'sales', 'purchases', 'products'
can_view BOOLEAN
can_create BOOLEAN
can_edit BOOLEAN
can_delete BOOLEAN
```

---

### **3. Contacts**

#### **`contacts`**
Customers and Suppliers.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
type contact_type -- 'customer', 'supplier', 'both'
name VARCHAR(255)
email, phone, mobile
cnic VARCHAR(50) -- National ID
address, city, state, country
opening_balance DECIMAL(15,2)
current_balance DECIMAL(15,2)
credit_limit DECIMAL(15,2)
is_active BOOLEAN
```

---

### **4. Products & Inventory**

#### **`products`**
Product master with variations support.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
category_id UUID REFERENCES product_categories
name VARCHAR(255)
sku VARCHAR(100) UNIQUE
barcode VARCHAR(100)
description TEXT

-- Pricing
cost_price DECIMAL(15,2)
retail_price DECIMAL(15,2)
wholesale_price DECIMAL(15,2)
rental_price_daily DECIMAL(15,2)

-- Stock
current_stock DECIMAL(15,2)
min_stock DECIMAL(15,2)
max_stock DECIMAL(15,2)

-- Features
has_variations BOOLEAN
is_rentable BOOLEAN
is_sellable BOOLEAN
track_stock BOOLEAN
is_active BOOLEAN
```

#### **`product_variations`**
Size, Color, etc. variations.

```sql
id UUID PRIMARY KEY
product_id UUID REFERENCES products
name VARCHAR(255) -- "Size: Large, Color: Red"
sku VARCHAR(100) UNIQUE
attributes JSONB -- {"size": "Large", "color": "Red"}
retail_price DECIMAL(15,2)
current_stock DECIMAL(15,2)
```

#### **`stock_movements`**
Stock ledger/history.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches
product_id UUID REFERENCES products
variation_id UUID REFERENCES product_variations

type stock_movement_type -- 'sale', 'purchase', 'adjustment'
quantity DECIMAL(15,2)
balance_qty DECIMAL(15,2)

reference_type VARCHAR(50) -- 'sale', 'purchase'
reference_id UUID
```

---

### **5. Sales Module**

#### **`sales`**
Sales invoices and orders.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

invoice_no VARCHAR(50) UNIQUE -- Auto: INV-0001
invoice_date DATE

customer_id UUID REFERENCES contacts
customer_name VARCHAR(255)

status transaction_status -- 'draft', 'quotation', 'order', 'final'
payment_status payment_status -- 'paid', 'partial', 'unpaid'

subtotal DECIMAL(15,2)
discount_amount DECIMAL(15,2)
tax_amount DECIMAL(15,2)
shipping_charges DECIMAL(15,2)
total DECIMAL(15,2)
paid_amount DECIMAL(15,2)
due_amount DECIMAL(15,2)

journal_entry_id UUID -- Accounting link
created_by UUID REFERENCES users
```

#### **`sale_items`**
Line items for each sale.

```sql
id UUID PRIMARY KEY
sale_id UUID REFERENCES sales

product_id UUID REFERENCES products
variation_id UUID REFERENCES product_variations
product_name VARCHAR(255)

quantity DECIMAL(15,2)
unit_price DECIMAL(15,2)
total DECIMAL(15,2)
```

---

### **6. Purchases Module**

#### **`purchases`**
Purchase orders.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

po_no VARCHAR(50) UNIQUE -- Auto: PO-0001
po_date DATE

supplier_id UUID REFERENCES contacts
supplier_name VARCHAR(255)

status transaction_status
payment_status payment_status

-- Same totals structure as sales
subtotal, discount_amount, tax_amount, total, paid_amount, due_amount

expected_delivery_date DATE
received_date DATE
```

#### **`purchase_items`**
Line items for each purchase.

```sql
id UUID PRIMARY KEY
purchase_id UUID REFERENCES purchases

product_id UUID REFERENCES products
product_name VARCHAR(255)

quantity DECIMAL(15,2)
received_quantity DECIMAL(15,2)
unit_price DECIMAL(15,2)
total DECIMAL(15,2)
```

---

### **7. Rentals Module**

#### **`rentals`**
Rental bookings.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

booking_no VARCHAR(50) UNIQUE -- Auto: RNT-0001
booking_date DATE

customer_id UUID REFERENCES contacts
customer_name VARCHAR(255)

status rental_status -- 'booked', 'active', 'returned'

pickup_date DATE
return_date DATE
actual_return_date DATE
duration_days INTEGER

rental_charges DECIMAL(15,2)
security_deposit DECIMAL(15,2)
late_fee DECIMAL(15,2)
damage_charges DECIMAL(15,2)
total_amount DECIMAL(15,2)
refund_amount DECIMAL(15,2)
```

#### **`rental_items`**
Items in each rental.

```sql
id UUID PRIMARY KEY
rental_id UUID REFERENCES rentals

product_id UUID REFERENCES products
product_name VARCHAR(255)

quantity DECIMAL(15,2)
rate_per_day DECIMAL(15,2)
duration_days INTEGER
total DECIMAL(15,2)

condition_on_return VARCHAR(50) -- 'good', 'damaged', 'lost'
damage_amount DECIMAL(15,2)
```

---

### **8. Studio Production**

#### **`studio_orders`**
Custom stitching orders.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

order_no VARCHAR(50) UNIQUE -- Auto: STU-0001
order_date DATE

customer_id UUID REFERENCES contacts
customer_name VARCHAR(255)

status studio_status -- 'pending', 'in_progress', 'ready', 'delivered'

order_type VARCHAR(50) -- 'stitching', 'alteration', 'design'

total_cost DECIMAL(15,2)
advance_paid DECIMAL(15,2)
balance_due DECIMAL(15,2)

delivery_date DATE
measurements JSONB
```

#### **`workers`**
Tailors, cutters, etc.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies

name VARCHAR(255)
phone VARCHAR(50)
cnic VARCHAR(50)

worker_type VARCHAR(50) -- 'tailor', 'cutter', 'finisher'
payment_type VARCHAR(50) -- 'per_piece', 'daily', 'monthly'
rate DECIMAL(15,2)

current_balance DECIMAL(15,2)
is_active BOOLEAN
```

#### **`job_cards`**
Task assignment to workers.

```sql
id UUID PRIMARY KEY
studio_order_id UUID REFERENCES studio_orders

task_type VARCHAR(50) -- 'cutting', 'stitching', 'finishing'
assigned_worker_id UUID REFERENCES workers

status VARCHAR(50) -- 'pending', 'in_progress', 'completed'
start_date, end_date DATE

payment_amount DECIMAL(15,2)
is_paid BOOLEAN
```

---

### **9. Expenses Module**

#### **`expenses`**
Business expenses.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

expense_no VARCHAR(50) UNIQUE -- Auto: EXP-0001
expense_date DATE

category expense_category -- 'rent', 'utilities', 'salaries', etc.
description TEXT

amount DECIMAL(15,2)
vendor VARCHAR(255)

payment_method payment_method
payment_account_id UUID REFERENCES accounts

receipt_url TEXT
status VARCHAR(50) -- 'pending', 'approved', 'paid'

approved_by UUID REFERENCES users
journal_entry_id UUID
```

**Expense Categories:**
- `rent`, `utilities`, `salaries`, `marketing`, `travel`, 
- `office_supplies`, `repairs`, `professional_fees`, 
- `insurance`, `taxes`, `miscellaneous`

---

### **10. Accounting Module**

#### **`accounts`**
Chart of Accounts (double-entry).

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies

code VARCHAR(50) UNIQUE -- e.g., '1001'
name VARCHAR(255) -- e.g., 'Main Cash Counter'

type account_type -- 'asset', 'liability', 'equity', 'revenue', 'expense'
subtype account_subtype -- 'cash', 'bank', 'sales_revenue', etc.

parent_id UUID REFERENCES accounts

opening_balance DECIMAL(15,2)
current_balance DECIMAL(15,2)

is_system BOOLEAN -- Can't delete system accounts
is_active BOOLEAN
```

**Account Types:**
- **Assets:** `cash`, `bank`, `mobile_wallet`, `accounts_receivable`, `inventory`, `fixed_asset`
- **Liabilities:** `accounts_payable`, `current_liability`, `long_term_liability`
- **Equity:** `owner_capital`, `retained_earnings`
- **Revenue:** `sales_revenue`, `rental_revenue`, `studio_revenue`
- **Expenses:** `cost_of_goods_sold`, `operating_expense`, `other`

#### **`journal_entries`**
Journal entries (double-entry).

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

entry_no VARCHAR(50) UNIQUE -- Auto: JE-0001
entry_date DATE
description TEXT

reference_type VARCHAR(50) -- 'sale', 'purchase', 'expense', 'manual'
reference_id UUID

total_debit DECIMAL(15,2)
total_credit DECIMAL(15,2)

is_posted BOOLEAN
is_manual BOOLEAN -- Manual entries can be edited/deleted

CONSTRAINT debit_credit_balance CHECK (total_debit = total_credit)
```

#### **`journal_entry_lines`**
Individual debit/credit lines.

```sql
id UUID PRIMARY KEY
journal_entry_id UUID REFERENCES journal_entries

account_id UUID REFERENCES accounts
account_name VARCHAR(255)

debit DECIMAL(15,2) DEFAULT 0
credit DECIMAL(15,2) DEFAULT 0
description TEXT

CONSTRAINT debit_or_credit CHECK (
  (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
)
```

#### **`payments`**
Payment receipts and vouchers.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

payment_no VARCHAR(50) UNIQUE -- Auto: PMT-0001 / RCP-0001
payment_date DATE

payment_type VARCHAR(50) -- 'received', 'paid'

contact_id UUID REFERENCES contacts
contact_name VARCHAR(255)

amount DECIMAL(15,2)

payment_method payment_method -- 'cash', 'bank', 'card', 'wallet'
payment_account_id UUID REFERENCES accounts

reference_type VARCHAR(50) -- 'sale', 'purchase', 'rental', 'other'
reference_id UUID

journal_entry_id UUID
```

---

### **11. Settings & Configuration**

#### **`settings`**
Company-wide settings.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies

key VARCHAR(255) -- e.g., 'default_currency'
value JSONB -- e.g., '"PKR"'
category VARCHAR(100) -- 'general', 'accounting', 'sales'
description TEXT

UNIQUE(company_id, key)
```

#### **`modules_config`**
Module ON/OFF toggle.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies

module_name VARCHAR(100) -- 'rentals', 'studio', 'accounting'
is_enabled BOOLEAN
config JSONB -- Module-specific settings

UNIQUE(company_id, module_name)
```

#### **`document_sequences`**
Auto-numbering sequences.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
branch_id UUID REFERENCES branches

document_type VARCHAR(50) -- 'sale', 'purchase', 'expense'
prefix VARCHAR(20) -- 'INV-', 'PO-', 'EXP-'
current_number INTEGER
padding INTEGER -- Number of digits (4 = 0001)

UNIQUE(company_id, branch_id, document_type)
```

---

### **12. Security & Audit**

#### **`audit_logs`**
Complete audit trail.

```sql
id UUID PRIMARY KEY
company_id UUID REFERENCES companies
user_id UUID REFERENCES users

table_name VARCHAR(100)
record_id UUID
action VARCHAR(50) -- 'INSERT', 'UPDATE', 'DELETE'

old_data JSONB
new_data JSONB

ip_address INET
user_agent TEXT
created_at TIMESTAMPTZ
```

---

## 🔐 **SECURITY (RLS)**

### **Row Level Security Enabled:**

✅ All tables have RLS enabled  
✅ Users can only access their company's data  
✅ Branch-based access control  
✅ Role-based permissions (admin, manager, etc.)  
✅ Module-level permissions (view, create, edit, delete)

### **Key RLS Policies:**

```sql
-- Users can only view own company data
CREATE POLICY "Users can view company data"
  ON [table] FOR SELECT
  USING (company_id = get_user_company_id());

-- Users need permission for each module
CREATE POLICY "Users can create sales"
  ON sales FOR INSERT
  WITH CHECK (
    company_id = get_user_company_id()
    AND has_module_permission('sales', 'create')
  );

-- Admins can do everything
-- Managers can approve
-- Accountants can view financial
-- Salespeople can only POS
-- Viewers can only read
```

### **Helper Functions:**

```sql
get_user_company_id() -- Returns current user's company
get_user_role() -- Returns current user's role
has_module_permission(module, permission) -- Check permission
has_branch_access(branch_id) -- Check branch access
```

---

## ⚙️ **FUNCTIONS & TRIGGERS**

### **Auto-Numbering:**

```sql
-- Generate next document number
get_next_document_number(company_id, branch_id, document_type)
-- Returns: 'INV-0001', 'PO-0002', etc.
```

**Triggers:**
- `trigger_set_sale_invoice_number` - Auto INV number
- `trigger_set_purchase_po_number` - Auto PO number
- `trigger_set_expense_number` - Auto EXP number
- `trigger_set_rental_booking_number` - Auto RNT number

### **Calculate Totals:**

```sql
calculate_sale_totals() -- Auto-calculate sale totals
calculate_purchase_totals() -- Auto-calculate purchase totals
```

**Triggers:**
- When sale_items/purchase_items are added/updated
- Automatically updates subtotal, tax, discount, total
- Updates payment status (paid/partial/unpaid)

### **Stock Management:**

```sql
update_stock_on_sale() -- Reduce stock when sale = 'final'
update_stock_on_purchase() -- Increase stock when purchase = 'final'
```

**Triggers:**
- Auto-update product stock
- Auto-update variation stock
- Create stock movement record
- Calculate running balance

### **Accounting Integration:**

```sql
auto_post_sale_to_accounting() -- Post sale to journal
auto_post_purchase_to_accounting() -- Post purchase to journal
```

**Triggers:**
- When status = 'final'
- Create journal entry automatically
- Debit/Credit accounts
- Link back to source transaction

### **Contact Balance:**

```sql
update_contact_balance_on_sale() -- Increase AR
update_contact_balance_on_purchase() -- Increase AP
```

### **Audit Logging:**

```sql
log_audit_trail() -- Record all changes
```

**Triggers:**
- Records INSERT, UPDATE, DELETE
- Stores old and new data (JSON)
- Captures user, timestamp, IP
- Applied to all important tables

---

## 💻 **CURSOR AI IMPLEMENTATION**

### **Step 1: Install Supabase Client**

```bash
npm install @supabase/supabase-js
```

### **Step 2: Create Supabase Client**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### **Step 3: Environment Variables**

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### **Step 4: Create Type Definitions**

```typescript
// src/types/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          created_at: string
          // ... all columns
        }
        Insert: {
          id?: string
          name: string
          // ... required fields
        }
        Update: {
          name?: string
          // ... optional fields
        }
      }
      // ... other tables
    }
  }
}
```

### **Step 5: Example Queries**

#### **Fetch Products:**
```typescript
const { data: products, error } = await supabase
  .from('products')
  .select(`
    *,
    category:product_categories(name),
    variations:product_variations(*)
  `)
  .eq('is_active', true)
  .order('name');
```

#### **Create Sale:**
```typescript
// Insert sale
const { data: sale, error: saleError } = await supabase
  .from('sales')
  .insert({
    company_id: companyId,
    branch_id: branchId,
    customer_id: customerId,
    customer_name: customerName,
    status: 'draft',
    // ... other fields
  })
  .select()
  .single();

// Insert sale items
const { error: itemsError } = await supabase
  .from('sale_items')
  .insert(items.map(item => ({
    sale_id: sale.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.price,
    total: item.quantity * item.price
  })));

// Update sale status to 'final'
// This triggers stock update & accounting post automatically!
const { error: finalError } = await supabase
  .from('sales')
  .update({ status: 'final' })
  .eq('id', sale.id);
```

#### **Fetch Sales with Items:**
```typescript
const { data: sales } = await supabase
  .from('sales')
  .select(`
    *,
    customer:contacts(name, phone),
    items:sale_items(
      *,
      product:products(name)
    ),
    journal:journal_entries(entry_no)
  `)
  .eq('branch_id', branchId)
  .order('invoice_date', { ascending: false });
```

#### **Get Account Balance:**
```typescript
const { data: balance } = await supabase
  .rpc('get_account_balance', {
    account_uuid: accountId
  });
```

### **Step 6: Real-time Subscriptions**

```typescript
// Subscribe to new sales
const subscription = supabase
  .channel('sales_changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'sales'
    },
    (payload) => {
      console.log('New sale:', payload.new);
      // Update UI
    }
  )
  .subscribe();

// Unsubscribe when done
subscription.unsubscribe();
```

---

## 🧪 **TESTING**

### **Test 1: Verify Tables**

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Should return 35 tables
```

### **Test 2: Verify RLS**

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;

-- Should return all tables
```

### **Test 3: Test Auto-Numbering**

```sql
-- Get next invoice number
SELECT get_next_document_number(
  '00000000-0000-0000-0000-000000000001'::uuid, -- company
  '00000000-0000-0000-0000-000000000011'::uuid, -- branch
  'sale'
);

-- Should return: INV-0001
```

### **Test 4: Test Sale Creation**

```sql
-- Insert test sale
INSERT INTO sales (
  company_id,
  branch_id,
  customer_id,
  customer_name,
  status,
  total
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000011'::uuid,
  'ct000000-0000-0000-0000-000000000001'::uuid,
  'Ayesha Khan',
  'draft',
  10000
);

-- Check if invoice_no was auto-generated
SELECT invoice_no FROM sales ORDER BY created_at DESC LIMIT 1;
-- Should show: INV-0001
```

### **Test 5: Test Stock Update**

```sql
-- Create sale with items
-- Set status to 'final'
-- Check if stock reduced

SELECT current_stock FROM products
WHERE id = 'p0000000-0000-0000-0000-000000000001'::uuid;

-- Stock should be reduced by sold quantity
```

---

## 🐛 **TROUBLESHOOTING**

### **Issue: "Permission denied for table"**

**Solution:**
```sql
-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

### **Issue: "RLS policy violated"**

**Solution:**
- Check if user is authenticated
- Verify company_id matches user's company
- Check module permissions
- Verify branch access

```sql
-- Check user's company
SELECT company_id FROM users WHERE id = auth.uid();

-- Check permissions
SELECT * FROM permissions WHERE user_id = auth.uid();
```

### **Issue: "Document number not generating"**

**Solution:**
```sql
-- Check if trigger exists
SELECT tgname FROM pg_trigger
WHERE tgname LIKE '%invoice_number%';

-- Manually insert sequence if needed
INSERT INTO document_sequences (
  company_id, branch_id, document_type, prefix, current_number
) VALUES (
  'company_id_here',
  'branch_id_here',
  'sale',
  'INV-',
  0
);
```

### **Issue: "Stock not updating"**

**Solution:**
- Check if sale status = 'final'
- Verify trigger exists: `trigger_update_stock_on_sale`
- Check product `track_stock` = true

### **Issue: "Accounting not auto-posting"**

**Solution:**
- Verify accounts exist (cash, sales revenue, AR)
- Check trigger: `trigger_auto_post_sale_to_accounting`
- Look for errors in journal_entries table

---

## 📊 **PERFORMANCE TIPS**

### **Indexes Created:**

✅ All foreign keys indexed  
✅ Frequently queried columns indexed  
✅ Date columns indexed for reports  
✅ Company/Branch columns indexed  

### **Query Optimization:**

```sql
-- GOOD: Use select specific columns
SELECT id, name, price FROM products;

-- BAD: Avoid SELECT *
SELECT * FROM products;

-- GOOD: Filter by indexed columns
WHERE company_id = ? AND branch_id = ?

-- GOOD: Use LIMIT for large tables
SELECT * FROM sales LIMIT 50;

-- GOOD: Use CTEs for complex queries
WITH recent_sales AS (
  SELECT * FROM sales WHERE invoice_date >= CURRENT_DATE - 30
)
SELECT * FROM recent_sales;
```

---

## 📝 **MIGRATION GUIDE**

### **Future Schema Updates:**

1. Never drop tables (data loss!)
2. Always use migrations
3. Test on staging first

```sql
-- Example migration
BEGIN;

-- Add new column
ALTER TABLE products
ADD COLUMN barcode_2 VARCHAR(100);

-- Create index
CREATE INDEX idx_products_barcode_2 ON products(barcode_2);

-- Update existing data if needed
UPDATE products SET barcode_2 = barcode WHERE barcode IS NOT NULL;

COMMIT;
```

---

## ✅ **CHECKLIST**

### **Before Production:**

- [ ] All SQL scripts run successfully
- [ ] RLS policies tested
- [ ] Functions & triggers working
- [ ] Seed data loaded (optional)
- [ ] Supabase client configured in app
- [ ] Environment variables set
- [ ] Authentication working
- [ ] Test user created
- [ ] Test company created
- [ ] Sample sale created & posted
- [ ] Stock updated correctly
- [ ] Accounting entries created
- [ ] Backups configured

---

## 🎉 **SUCCESS!**

Your Supabase database is now ready for Din Collection ERP!

### **What You Have:**

✅ **35 Tables** - Complete ERP coverage  
✅ **RLS Security** - Multi-tenant safe  
✅ **Auto-Numbering** - Professional documents  
✅ **Auto-Posting** - Accounting integrated  
✅ **Stock Management** - Real-time tracking  
✅ **Audit Trail** - Complete compliance  
✅ **Demo Data** - Ready to test  

### **Next Steps:**

1. Connect Supabase to your React app
2. Create authentication flow
3. Build first module (Products/Sales)
4. Test end-to-end workflow
5. Deploy to production

---

**Built with ❤️ for Din Collection**  
**Database:** Production-Ready  
**Date:** January 18, 2026  
**Version:** 1.0.0

---

**HAPPY CODING! 🚀**
