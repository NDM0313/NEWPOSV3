# 🚀 SCHEMA APPLICATION INSTRUCTIONS

## Date: 2026-01-20

## ✅ COMPLETED

1. **.env.local Updated** ✅
   - New project URL: https://wrwljqzckmnmuphwhslt.supabase.co
   - New publishable key configured
   - New service role key configured
   - Database connection strings added

## ⚠️ MANUAL STEP REQUIRED: Apply Schema

### Quick Steps:

1. **Open Supabase Dashboard**
   ```
   https://supabase.com/dashboard
   ```

2. **Select Project**
   - Project: `wrwljqzckmnmuphwhslt`

3. **Open SQL Editor**
   - Left sidebar → **SQL Editor**
   - Click **New Query**

4. **Copy Schema File**
   - Open: `supabase-extract/migrations/03_frontend_driven_schema.sql`
   - Select ALL (Ctrl+A)
   - Copy (Ctrl+C)

5. **Paste and Run**
   - Paste into SQL Editor (Ctrl+V)
   - Click **Run** button
   - Wait 30-60 seconds

6. **Verify Success**
   - Should see: `Success. No rows returned`
   - If errors, check error message

### Verification Query:

After applying, run this in SQL Editor:

```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

**Expected:** Should return 20 (19 tables + 1 for migrations if using migrations)

---

## 📋 WHAT WILL BE CREATED

- ✅ 9 ENUM types (contact_type, sale_type, payment_status, etc.)
- ✅ 20 tables (companies, branches, users, products, sales, purchases, etc.)
- ✅ All indexes for performance
- ✅ All triggers for auto-update
- ✅ `create_business_transaction` function

---

## 🔄 AFTER SCHEMA APPLIED

1. **Restart Dev Server**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart:
   npm run dev
   # or
   vite
   ```

2. **Test Connection**
   - Open app: http://localhost:5173
   - Try creating a new business
   - Verify it works

---

**Status:** ✅ .env.local updated | ⚠️ Schema application pending
