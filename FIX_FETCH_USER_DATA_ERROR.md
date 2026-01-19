# 🔧 FIX: fetchUserData() 400 Error

## ⚠️ Problem
After successful login, getting error:
```
GET /rest/v1/users?select=company_id%2Crole&id=eq.dd403f59-d0b2-4a6e-a652-fcc2ea698ee7 400 (Bad Request)
```

**Root Cause:**
- User exists in `auth.users` ✅
- User **MISSING** in `public.users` ❌
- RLS policy `"Users can view company users"` uses `get_user_company_id()`
- `get_user_company_id()` function queries `public.users` table
- If entry doesn't exist, function returns NULL
- RLS policy fails → 400 Bad Request

---

## ✅ SOLUTION

### **Step 1: Link Auth User to Database User**

Run this in Supabase SQL Editor:

```sql
-- Link auth user to public.users table
INSERT INTO public.users (
  id,
  company_id,
  email,
  full_name,
  role,
  is_active
) 
SELECT 
  au.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  au.email,
  'Admin User',
  'admin',
  true
FROM auth.users au
WHERE au.email = 'admin@dincollection.com'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  is_active = true;
```

**Or use the existing script:**
- Run `fix-auth-user-link.sql` in SQL Editor

---

### **Step 2: Verify Entry Created**

```sql
-- Verify user exists in both tables
SELECT 
  'Auth User' as check_type,
  au.id as auth_id,
  au.email as auth_email,
  'Public User' as check_type_2,
  pu.id as public_id,
  pu.email as public_email,
  pu.company_id,
  pu.role,
  CASE 
    WHEN au.id = pu.id THEN '✅ LINKED'
    ELSE '❌ NOT LINKED'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'admin@dincollection.com';
```

**Expected:**
- Both IDs should match
- `company_id` should be set
- `role` should be `admin`

---

### **Step 3: Refresh App**

1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh app: http://localhost:5173
3. Login again
4. Check console - should see:
   - `[FETCH USER DATA SUCCESS]`
   - `companyId` and `role` loaded

---

## 🔍 CODE IMPROVEMENTS APPLIED

### **1. Better Error Handling:**
- Added detailed logging in `fetchUserData()`
- Detects missing user entry
- Attempts auto-creation (if RLS allows)

### **2. Auto-Creation Attempt:**
- If user missing in `public.users`, tries to create entry
- Falls back gracefully if RLS blocks

### **3. Detailed Logging:**
- Console logs show exact failure point
- Error codes and messages logged
- Helps identify RLS vs data issues

---

## 📋 VERIFICATION CHECKLIST

- [ ] User exists in `auth.users` ✅
- [ ] User exists in `public.users` (run SQL to create)
- [ ] IDs match between both tables
- [ ] `company_id` is set in `public.users`
- [ ] `role` is set in `public.users`
- [ ] App refreshed after SQL script
- [ ] Console shows `[FETCH USER DATA SUCCESS]`

---

## 🎯 QUICK FIX

**Run this single SQL command:**

```sql
INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
SELECT id, '00000000-0000-0000-0000-000000000001'::uuid, email, 'Admin User', 'admin', true
FROM auth.users WHERE email = 'admin@dincollection.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true;
```

Then refresh app and login again!

---

**After running SQL script, error will be fixed! 🚀**
