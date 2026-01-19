# 🚨 CREATE USER NOW - STEP BY STEP

## ⚠️ ERROR: User doesn't exist in Supabase Auth

**You're getting `400 Bad Request` because the user `admin@dincollection.com` doesn't exist yet.**

---

## ✅ SOLUTION (2 Minutes)

### **STEP 1: Open Supabase Dashboard**

1. Go to: **https://supabase.com/dashboard**
2. Login to your Supabase account
3. Click on your project: **`pcxfwmbcjrkgzibgdrlz`**

### **STEP 2: Navigate to Authentication**

1. In the left sidebar, click **"Authentication"**
2. Click on **"Users"** tab (should be selected by default)

### **STEP 3: Create New User**

1. Click the **"Add user"** button (top right corner, blue button)
2. A modal will open
3. Select **"Create new user"** option

### **STEP 4: Fill User Details**

In the form, enter:

```
Email: admin@dincollection.com
Password: admin123
Auto Confirm User: ✅ (CHECK THIS BOX!)
```

**Important:** Make sure "Auto Confirm User" is checked, otherwise you'll need to confirm email.

### **STEP 5: Click "Create user"**

Click the blue "Create user" button at the bottom.

### **STEP 6: Link to Database (Optional but Recommended)**

After creating the user, run this SQL in Supabase SQL Editor:

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

**To run SQL:**
1. Click **"SQL Editor"** in left sidebar
2. Click **"New query"**
3. Paste the SQL above
4. Click **"RUN"** button

### **STEP 7: Test Login**

1. Go back to your app: **http://localhost:5173**
2. Click **"Demo Account (Admin Full Access)"** button
3. Should login successfully! ✅

---

## 🔧 Alternative: Use Script (Requires Service Role Key)

If you have the **Service Role Key**, you can run:

```bash
node create-user-simple.mjs
```

**To get Service Role Key:**
1. Supabase Dashboard → **Settings** → **API**
2. Scroll down to **"Project API keys"**
3. Copy the **"service_role"** key (NOT the anon key!)
4. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```
5. Run: `node create-user-simple.mjs`

---

## ❓ Why This Happened?

Supabase has **two separate user systems**:

1. **`auth.users`** - Authentication system (login credentials)
   - Created via Supabase Dashboard or Auth API
   - Stores email, password, session tokens

2. **`public.users`** - Application database table
   - Created via SQL or your app
   - Stores company_id, role, permissions, etc.

**Both need to exist and be linked!**

---

## ✅ After Creating User

- ✅ Login will work
- ✅ No more `400 Bad Request` errors
- ✅ Full admin access to the ERP system

---

## 🆘 Still Having Issues?

1. **Check email is correct:** `admin@dincollection.com`
2. **Check password is correct:** `admin123`
3. **Make sure "Auto Confirm" was checked**
4. **Check Supabase project is active** (not paused)
5. **Try refreshing the page** after creating user

---

**That's it! After creating the user, everything will work! 🎉**
