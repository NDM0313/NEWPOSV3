# ✅ COMPLETE VERIFICATION GUIDE

**Date:** January 27, 2026  
**Purpose:** Complete database verification and customer data check

---

## 🚀 QUICK START

### Option 1: Run Complete Verification (Recommended)
```batch
verify-and-check.bat
```

### Option 2: Check Specific Customer
```batch
check-customer.bat CUS-018
```
Or with customer UUID:
```batch
check-customer.bat <customer-uuid>
```

### Option 3: Manual Node Scripts
```bash
# Final verification
node scripts/final-verification.mjs

# Check specific customer
node scripts/check-customer-data.mjs <customer-id-or-code>

# Fix extra expenses (if needed)
node scripts/fix-extra-expenses.mjs
```

---

## 📋 WHAT THE SCRIPTS DO

### 1. `verify-and-check.bat`
- ✅ Verifies `.env.local` exists
- ✅ Checks Node.js and npm
- ✅ Installs dependencies
- ✅ Runs final verification
- ✅ Checks customer data

### 2. `check-customer.bat`
- ✅ Finds customer by ID, UUID, or code
- ✅ Lists all sales for customer
- ✅ Lists all payments for customer
- ✅ Shows journal entries linked to customer
- ✅ Provides summary

### 3. `scripts/check-customer-data.mjs`
- ✅ Customer lookup (by ID, UUID, or code)
- ✅ Sales listing with journal entry links
- ✅ Payments listing with journal entry links
- ✅ Journal entries via AR account
- ✅ Comprehensive summary

---

## 🔍 MANUAL SQL QUERIES (Supabase SQL Editor)

If you need to run SQL directly, use these queries in Supabase SQL Editor:

### Check Journal Entries for Customer
```sql
-- Find customer first
SELECT id, uuid, code, name FROM contacts 
WHERE code = 'CUS-018' OR uuid = 'CUSTOMER_UUID_HERE';

-- Then check journal entries via sales
SELECT 
  je.id,
  je.entry_no,
  je.entry_date,
  je.description,
  jel.debit,
  jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
JOIN sales s ON je.reference_id = s.id AND je.reference_type = 'sale'
WHERE a.code = '2000'  -- AR account
  AND s.customer_id = 'CUSTOMER_UUID_HERE'
ORDER BY je.entry_date DESC;
```

### Check Payments Linking
```sql
SELECT 
  p.id,
  p.reference_number,
  p.amount,
  p.contact_id,
  p.journal_entry_id,
  je.entry_no
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
WHERE p.contact_id = 'CUSTOMER_UUID_HERE'
ORDER BY p.created_at DESC;
```

### Check Sales Linking
```sql
SELECT 
  s.id,
  s.invoice_no,
  s.customer_id,
  s.total,
  s.paid_amount,
  s.due_amount,
  s.journal_entry_id,
  je.entry_no
FROM sales s
LEFT JOIN journal_entries je ON je.reference_id = s.id AND je.reference_type = 'sale'
WHERE s.customer_id = 'CUSTOMER_UUID_HERE'
ORDER BY s.created_at DESC;
```

---

## 🎯 EXPECTED RESULTS

### ✅ Successful Verification:
- Customer found
- Sales listed with journal entries
- Payments listed with journal entries
- Journal entries show correct debit/credit
- No data corruption

### ⚠️ Common Issues:

1. **Customer Not Found**
   - Check customer code/UUID
   - Run without parameter to see available customers

2. **No Journal Entries**
   - Sales may not be creating journal entries
   - Check sale creation process
   - Verify triggers are active

3. **Missing Journal Entry Links**
   - Payments/sales may not be linked
   - Run backfill scripts if needed

---

## 📝 NEXT STEPS AFTER VERIFICATION

1. **If Data Issues Found:**
   - Run: `node scripts/fix-extra-expenses.mjs`
   - Run: `node scripts/final-verification.mjs`

2. **If Function Needs Update:**
   - Run SQL from: `APPLY_FUNCTION_FIX_NOW.sql`
   - In Supabase SQL Editor

3. **Test in Browser:**
   - Run: `npm run dev`
   - Open Customer Ledger
   - Check console logs
   - Verify data display

---

## 🔗 USEFUL LINKS

- **Supabase SQL Editor:** https://supabase.com/dashboard/project/wrwljqzckmnmuphwhslt/sql/new
- **Supabase Dashboard:** https://supabase.com/dashboard/project/wrwljqzckmnmuphwhslt

---

**Last Updated:** January 27, 2026
