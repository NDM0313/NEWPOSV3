# 🎯 SUPABASE SETUP GUIDE - DIN COLLECTION ERP

## 📋 **COMPLETE DATABASE SETUP INSTRUCTIONS**

---

## 🚀 **STEP 1: Connect to Supabase**

### **Option A: Using Supabase Dashboard**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the SQL scripts

### **Option B: Using psql (Command Line)**
```bash
# Connect to your Supabase database
psql "postgresql://postgres.pcxfwmbcjrkgzibgdrlz:khan313ndm313@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
```

---

## 📝 **STEP 2: Run Schema Script**

### **Execute Schema:**
```sql
-- Copy and paste the entire content of: supabase-schema.sql
-- This will create all tables, indexes, triggers, and functions
```

**What it creates:**
- ✅ 18 main tables
- ✅ All indexes for performance
- ✅ Triggers for auto-updating `updated_at`
- ✅ Foreign key relationships
- ✅ Comments for documentation

---

## 🎨 **STEP 3: Insert Demo Data**

### **Execute Demo Data:**
```sql
-- Copy and paste the entire content of: supabase-demo-data.sql
-- This will insert realistic demo data matching your app
```

**What it inserts:**
- ✅ 3 Branches
- ✅ 10 Accounts (Cash, Bank, Mobile Wallet)
- ✅ 11 Contacts (Suppliers, Customers, Workers)
- ✅ 10 Products
- ✅ 5 Sales with items
- ✅ 5 Purchases with items
- ✅ 5 Expenses
- ✅ 1 Rental booking
- ✅ 2 Studio sales
- ✅ 10 Accounting entries
- ✅ 3 Payments
- ✅ 3 Stock movements
- ✅ 8 Numbering rules
- ✅ 10 Settings
- ✅ 3 Users

---

## 🔍 **STEP 4: Verify Data**

Run these queries to verify:

```sql
-- Count all records
SELECT 'Branches' as table_name, COUNT(*) as count FROM branches
UNION ALL
SELECT 'Accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'Contacts', COUNT(*) FROM contacts
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Sales', COUNT(*) FROM sales
UNION ALL
SELECT 'Sale Items', COUNT(*) FROM sale_items
UNION ALL
SELECT 'Purchases', COUNT(*) FROM purchases
UNION ALL
SELECT 'Purchase Items', COUNT(*) FROM purchase_items
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'Rentals', COUNT(*) FROM rentals
UNION ALL
SELECT 'Studio Sales', COUNT(*) FROM studio_sales
UNION ALL
SELECT 'Accounting Entries', COUNT(*) FROM accounting_entries
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Stock Movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'Numbering Rules', COUNT(*) FROM numbering_rules
UNION ALL
SELECT 'Settings', COUNT(*) FROM settings
UNION ALL
SELECT 'Users', COUNT(*) FROM users;
```

**Expected Results:**
- Branches: 3
- Accounts: 10
- Contacts: 11
- Products: 10
- Sales: 5
- Sale Items: 3+
- Purchases: 5
- Purchase Items: 2+
- Expenses: 5
- Rentals: 1
- Studio Sales: 2
- Accounting Entries: 10
- Payments: 3
- Stock Movements: 3
- Numbering Rules: 8
- Settings: 10
- Users: 3

---

## 🔐 **STEP 5: Configure Row Level Security (RLS)**

### **Enable RLS (Optional - for production):**
```sql
-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies based on your authentication requirements
-- Example: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON branches
    FOR ALL USING (auth.role() = 'authenticated');

-- Repeat for other tables as needed
```

---

## 📊 **STEP 6: Create Views (Optional but Recommended)**

### **Useful Views for Reports:**

```sql
-- Sales Summary View
CREATE OR REPLACE VIEW sales_summary AS
SELECT 
    s.id,
    s.invoice_no,
    s.sale_date,
    s.customer_name,
    s.total,
    s.paid_amount,
    s.due_amount,
    s.payment_status,
    s.shipping_status,
    COUNT(si.id) as item_count,
    s.branch_name
FROM sales s
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, s.invoice_no, s.sale_date, s.customer_name, s.total, s.paid_amount, s.due_amount, s.payment_status, s.shipping_status, s.branch_name;

-- Product Stock Status View
CREATE OR REPLACE VIEW product_stock_status AS
SELECT 
    p.id,
    p.sku,
    p.name,
    p.category,
    p.stock,
    p.low_stock_threshold,
    CASE 
        WHEN p.stock = 0 THEN 'out-of-stock'
        WHEN p.stock <= p.low_stock_threshold THEN 'low-stock'
        ELSE 'in-stock'
    END as stock_status,
    p.branch_name
FROM products p;

-- Contact Balance Summary View
CREATE OR REPLACE VIEW contact_balance_summary AS
SELECT 
    c.id,
    c.code,
    c.name,
    c.type,
    c.receivables,
    c.payables,
    c.net_balance,
    c.status,
    c.branch_name,
    c.last_transaction_date
FROM contacts c;
```

---

## 🔗 **STEP 7: Connect Your App to Supabase**

### **Install Supabase Client:**
```bash
npm install @supabase/supabase-js
```

### **Create Supabase Client:**
Create file: `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### **Get Your Supabase Credentials:**
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy:
   - **Project URL** (for supabaseUrl)
   - **anon/public key** (for supabaseKey)

---

## 📋 **DATABASE SCHEMA OVERVIEW**

### **Core Tables:**
1. **branches** - Store locations
2. **accounts** - Accounting accounts
3. **contacts** - Customers, Suppliers, Workers
4. **products** - Product catalog
5. **sales** - Sales invoices
6. **sale_items** - Items in sales
7. **purchases** - Purchase orders
8. **purchase_items** - Items in purchases
9. **expenses** - Business expenses
10. **rentals** - Rental bookings
11. **rental_items** - Items in rentals
12. **studio_sales** - Studio custom orders
13. **accounting_entries** - Double-entry accounting
14. **payments** - Payment records
15. **stock_movements** - Inventory history
16. **settings** - System settings
17. **users** - System users
18. **numbering_rules** - Auto-numbering

---

## 🎯 **QUICK START COMMANDS**

### **Using psql:**
```bash
# Connect
psql "postgresql://postgres.pcxfwmbcjrkgzibgdrlz:khan313ndm313@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

# Run schema
\i supabase-schema.sql

# Run demo data
\i supabase-demo-data.sql

# Verify
SELECT COUNT(*) FROM products;
```

### **Using Supabase Dashboard:**
1. Open SQL Editor
2. Paste `supabase-schema.sql` → Run
3. Paste `supabase-demo-data.sql` → Run
4. Check Tables section to verify

---

## ✅ **VERIFICATION CHECKLIST**

- [ ] Schema created successfully
- [ ] All 18 tables exist
- [ ] Demo data inserted
- [ ] Foreign keys working
- [ ] Indexes created
- [ ] Triggers working
- [ ] Can query data
- [ ] App can connect

---

## 🔧 **TROUBLESHOOTING**

### **Issue: Connection Error**
- Check connection string
- Verify Supabase project is active
- Check firewall settings

### **Issue: Table Already Exists**
- Drop existing tables first:
```sql
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
-- Repeat for all tables
```

### **Issue: Foreign Key Error**
- Ensure parent tables are created first
- Check data order in demo-data.sql

### **Issue: Permission Denied**
- Check RLS policies
- Verify user permissions in Supabase

---

## 📚 **NEXT STEPS**

1. ✅ Run schema script
2. ✅ Run demo data script
3. ✅ Verify data
4. ✅ Connect app to Supabase
5. ✅ Update contexts to use Supabase
6. ✅ Test CRUD operations
7. ✅ Deploy to production

---

## 🎉 **SUCCESS!**

Your database is now ready with:
- ✅ Complete schema
- ✅ Realistic demo data
- ✅ All relationships
- ✅ Indexes for performance
- ✅ Ready for production use

**Connection String:**
```
postgresql://postgres.pcxfwmbcjrkgzibgdrlz:khan313ndm313@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

**Ready to connect your app!** 🚀
