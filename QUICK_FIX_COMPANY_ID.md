# 🚨 QUICK FIX: Missing company_id Column

## Error:
```
column users.company_id does not exist (code: 42703)
```

## Solution:
Run the SQL script in Supabase to add the missing column.

---

## Step-by-Step Fix:

### **Option 1: Run via Supabase Dashboard (RECOMMENDED)**

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/pcxfwmbcjrkgzibgdrlz
   - Navigate to: **SQL Editor**

2. **Run the Fix Script:**
   - Click **"New Query"**
   - Copy the entire content of `fix-users-table-schema.sql`
   - Paste into the SQL Editor
   - Click **"RUN"** button
   - Wait for success message

3. **Verify:**
   - The script will:
     - Add `company_id` column to `users` table
     - Set default company for existing users
     - Add foreign key constraint
     - Make column NOT NULL

---

### **Option 2: Run via psql (Command Line)**

```powershell
# Set environment variables
$env:PGPASSWORD='khan313ndm313'
$env:PGUSER='postgres.pcxfwmbcjrkgzibgdrlz'

# Run the script
psql -h aws-1-ap-southeast-1.pooler.supabase.com -p 6543 -d postgres -f fix-users-table-schema.sql
```

---

## What the Script Does:

1. ✅ Checks if `company_id` column exists
2. ✅ Adds `company_id` column if missing
3. ✅ Sets default company ID for existing users
4. ✅ Adds foreign key constraint to `companies` table
5. ✅ Makes column NOT NULL

---

## After Running:

1. **Refresh the browser** (or restart dev server)
2. **Login again** - The error should be gone
3. **Check console** - No more "company_id does not exist" errors

---

## Files:
- `fix-users-table-schema.sql` - Main fix script
- `complete-database-analysis.sql` - Comprehensive check and fix

---

**Status:** Ready to run ✅
