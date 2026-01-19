# 🚀 QUICK SETUP GUIDE - Business Registration

## ✅ STEP 1: Run RLS Fix SQL

**Option A - PowerShell Script:**
```powershell
powershell -ExecutionPolicy Bypass -File run-rls-fix.ps1
```

**Option B - Manual (Supabase SQL Editor):**
1. Go to Supabase Dashboard → SQL Editor
2. Open `fix-rls-remove-recursion.sql`
3. Copy all content
4. Paste in SQL Editor
5. Click "RUN"

---

## ✅ STEP 2: Add Service Role Key to .env.local

### **Get Service Role Key:**
1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **"service_role secret"** key
3. Click **"Copy"** button

### **Update .env.local:**
1. Open `.env.local` file in project root
2. Find this line:
   ```
   VITE_SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
   ```
3. Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service_role key
4. Save file

### **Example .env.local:**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://pcxfwmbcjrkgzibgdrlz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (SECRET - Never commit to Git!)
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-actual-key-here
```

---

## ✅ STEP 3: Restart Dev Server

After updating `.env.local`:
```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## ✅ STEP 4: Test Business Creation

1. Open app in browser
2. Click **"Create New Business"** button
3. Fill form:
   - Business Name: `Test Business`
   - Owner Name: `John Doe`
   - Email: `test@example.com`
   - Password: `test123456`
4. Click **"Create Business"**
5. Should auto-login and redirect to dashboard

---

## 🔍 Verification

### **Check RLS Policies:**
Run in Supabase SQL Editor:
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('users', 'contacts', 'products')
GROUP BY tablename;
```

**Expected:**
- `users`: 7 policies
- `contacts`: 4 policies
- `products`: 4 policies

### **Check .env.local:**
```bash
# Verify service_role key is set
cat .env.local | grep SERVICE_ROLE
```

---

## ❌ Troubleshooting

### **Error: "Service role key not configured"**
- Check `.env.local` exists
- Verify `VITE_SUPABASE_SERVICE_ROLE_KEY` is set
- Restart dev server after updating `.env.local`

### **Error: "RLS policy violation"**
- Run `fix-rls-remove-recursion.sql` again
- Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'users';`

### **Error: "Failed to create business"**
- Check service_role key is correct
- Verify key has `service_role` role (not `anon`)
- Check Supabase project is active (not paused)

---

**Setup Complete! Ready for business registration!** ✅
