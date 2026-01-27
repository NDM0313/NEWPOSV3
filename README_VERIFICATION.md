# 🔍 VERIFICATION SCRIPTS GUIDE

Complete guide for verifying accounting data and customer information.

---

## 🚀 QUICK START

### Main Verification Script
```batch
QUICK_START.bat
```
**OR**
```batch
verify-and-check.bat
```

### Check Specific Customer
```batch
check-customer.bat <CUSTOMER_ID_OR_CODE>
```

---

## 📋 AVAILABLE SCRIPTS

### 1. `QUICK_START.bat` ⭐ (Recommended)
- Complete verification in one go
- Checks environment, dependencies, data integrity
- **Run this first!**

### 2. `verify-and-check.bat`
- Detailed step-by-step verification
- Shows all steps with explanations
- Good for debugging

### 3. `check-customer.bat`
- Check specific customer data
- Shows sales, payments, journal entries
- Usage: `check-customer.bat CUSTOMER_ID`

---

## 🔧 NODE SCRIPTS (Direct)

### Final Verification
```bash
node scripts/final-verification.mjs
```
- Comprehensive accounting data check
- Verifies all entry types
- Shows summary

### Check Customer Data
```bash
node scripts/check-customer-data.mjs <CUSTOMER_ID>
```
- Finds customer by ID, UUID, or code
- Lists sales, payments, journal entries
- Shows summary

### Fix Extra Expenses
```bash
node scripts/fix-extra-expenses.mjs
```
- Fixes extra expense entries (CREDIT → DEBIT)
- Only run if verification shows issues

---

## 📊 WHAT GETS CHECKED

### ✅ Environment
- `.env.local` file exists
- `DATABASE_POOLER_URL` configured
- Node.js and npm installed

### ✅ Dependencies
- `node_modules` exists
- Packages installed

### ✅ Accounting Data
- Payments: Should be CREDIT ✅
- Extra Expenses: Should be DEBIT ✅
- Discounts: Should be CREDIT ✅
- Sales: Should be DEBIT ✅
- Data corruption: None found ✅

### ✅ Customer Data (if specified)
- Customer found
- Sales linked
- Payments linked
- Journal entries linked

---

## 🎯 EXPECTED OUTPUT

### Successful Verification:
```
✅ ALL CHECKS PASSED
✅ Accounting data is correct
✅ Ready for production use
```

### If Issues Found:
```
⚠️  SOME ISSUES FOUND
   - X payment entries need fixing
   - Y extra expense entries need fixing
```

---

## 🔗 MANUAL SQL QUERIES

If you need to run SQL directly in Supabase SQL Editor:

### Find Customer
```sql
SELECT id, uuid, code, name FROM contacts 
WHERE code = 'CUS-018' OR uuid = 'CUSTOMER_UUID';
```

### Check Journal Entries
```sql
SELECT je.*, jel.debit, jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
JOIN accounts a ON jel.account_id = a.id
WHERE a.code = '2000'  -- AR account
ORDER BY je.entry_date DESC;
```

### Check Payments
```sql
SELECT p.*, je.entry_no
FROM payments p
LEFT JOIN journal_entries je ON je.payment_id = p.id
ORDER BY p.created_at DESC;
```

---

## 📝 TROUBLESHOOTING

### Customer Not Found
- Check customer ID/code
- Run without parameter to see available customers
- Use UUID instead of code

### No Journal Entries
- Sales may not be creating entries
- Check sale creation process
- Verify database triggers are active

### Missing Links
- Payments/sales may not be linked
- Run backfill scripts
- Check `journal_entry_id` fields

---

## 🚀 NEXT STEPS

After verification:

1. **If All Checks Pass:**
   - Run: `npm run dev`
   - Test in browser
   - Check Customer Ledger

2. **If Issues Found:**
   - Run: `node scripts/fix-extra-expenses.mjs`
   - Apply SQL fix: `APPLY_FUNCTION_FIX_NOW.sql`
   - Re-run verification

---

**Last Updated:** January 27, 2026
