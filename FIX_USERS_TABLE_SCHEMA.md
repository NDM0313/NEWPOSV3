# 🔧 FIX: users.company_id Column Missing

## ⚠️ Error
```
column users.company_id does not exist (code: 42703)
```

## 🔍 Root Cause
The `users` table in your Supabase database is **missing the `company_id` column**, even though:
- ✅ The schema file (`supabase-extract/schema.sql`) defines it
- ✅ The code expects it
- ❌ The actual database table doesn't have it

**Possible reasons:**
1. Schema was not fully applied to database
2. Table was created manually without this column
3. Migration script didn't run completely

---

## ✅ SOLUTION

### **Step 1: Run SQL Script**

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- File: fix-users-table-schema.sql
```

**Or run directly:**

```sql
-- Add company_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Set default for existing users
UPDATE public.users
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE company_id IS NULL;

-- Make it NOT NULL
ALTER TABLE public.users 
ALTER COLUMN company_id SET NOT NULL;
```

### **Step 2: Verify**

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'company_id';
```

**Expected result:**
```
column_name  | data_type | is_nullable
-------------|-----------|-------------
company_id   | uuid      | NO
```

### **Step 3: Update Existing Users**

If you have existing users without `company_id`:

```sql
-- Set company_id for all users
UPDATE public.users
SET company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE company_id IS NULL;
```

### **Step 4: Refresh App**

1. Clear browser cache
2. Refresh the app
3. Login again
4. Check console - should see `[FETCH USER DATA SUCCESS]`

---

## 🔍 VERIFICATION QUERIES

### **Check Table Structure:**
```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;
```

### **Check Foreign Key:**
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'users'
  AND kcu.column_name = 'company_id';
```

---

## 📋 COMPLETE USERS TABLE SCHEMA

After fix, `users` table should have:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,  -- ← THIS WAS MISSING
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role user_role DEFAULT 'viewer',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🚨 IMPORTANT NOTES

1. **Default Company:** The script uses `'00000000-0000-0000-0000-000000000001'` as default company ID
   - Make sure this company exists in `companies` table
   - Or change to your actual company ID

2. **Foreign Key:** The column references `companies(id)`
   - If `companies` table doesn't exist, create it first
   - Or remove the foreign key constraint temporarily

3. **Existing Data:** If you have users without `company_id`:
   - They will be assigned to default company
   - Update manually if needed

---

## ✅ SUCCESS INDICATORS

After running the fix:
- ✅ No more `column users.company_id does not exist` error
- ✅ Console shows `[FETCH USER DATA SUCCESS]`
- ✅ `companyId` is loaded in `SupabaseContext`
- ✅ User can access the application

---

**Run the SQL script and refresh the app!** 🚀
