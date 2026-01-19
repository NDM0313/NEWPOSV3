# 🚨 CREATE USER NOW - STEP BY STEP GUIDE

## ⚠️ User Still Doesn't Exist!

Follow these steps to create the user:

---

## ✅ METHOD 1: Supabase Dashboard (EASIEST - 2 Minutes)

### Step 1: Open Supabase Dashboard
1. Go to: **https://supabase.com/dashboard**
2. Login with your Supabase account
3. Click on project: **`pcxfwmbcjrkgzibgdrlz`**

### Step 2: Go to Authentication
1. In the **left sidebar**, click **"Authentication"**
2. Click on **"Users"** tab (should be selected by default)

### Step 3: Create New User
1. Click the **"Add user"** button (top right corner - blue button)
2. A modal/popup will open
3. Select **"Create new user"** option

### Step 4: Fill User Details
In the form, enter exactly:

```
Email: admin@dincollection.com
Password: admin123
Auto Confirm User: ✅ (CHECK THIS BOX - VERY IMPORTANT!)
```

**⚠️ IMPORTANT:** 
- Make sure "Auto Confirm User" is **CHECKED** ✅
- Otherwise you'll need to confirm email manually

### Step 5: Click "Create user"
Click the blue **"Create user"** button at the bottom of the modal.

### Step 6: Link to Database (IMPORTANT!)
After creating the user, you need to link it to the database:

1. Click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button
3. Copy and paste this SQL:

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

4. Click **"RUN"** button (or press Ctrl+Enter)
5. You should see: ✅ "Success. No rows returned" or similar

### Step 7: Test Login
1. Go back to your app: **http://localhost:5173**
2. Click **"Demo Account (Admin Full Access)"** button
3. Should login successfully! ✅

---

## ✅ METHOD 2: Using Script (If you have Service Role Key)

### Step 1: Get Service Role Key
1. Go to: **https://supabase.com/dashboard**
2. Project: **`pcxfwmbcjrkgzibgdrlz`**
3. **Settings** → **API**
4. Scroll down to **"Project API keys"**
5. Copy the **"service_role"** key (NOT the anon key!)
   - It's a very long string starting with `eyJ...`
   - ⚠️ **WARNING:** This key is SECRET - never share it!

### Step 2: Add to .env.local
Open `.env.local` file and add:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 3: Run Script

**Option A - PowerShell (Windows):**
```powershell
.\create-user.ps1
```

**Option B - Node.js:**
```bash
node create-user-simple.mjs
```

### Step 4: Test Login
After script completes, test login in your app!

---

## ❓ TROUBLESHOOTING

### Problem: "User already exists" error
**Solution:** User might already exist. Try logging in directly.

### Problem: "Permission denied" error
**Solution:** Make sure you're using the **service_role** key, not the anon key.

### Problem: "Email not confirmed" error
**Solution:** Make sure "Auto Confirm User" was checked when creating the user.

### Problem: Login works but can't access data
**Solution:** Run the SQL script in Step 6 to link user to database.

---

## 📝 QUICK CHECKLIST

- [ ] User created in Supabase Dashboard
- [ ] "Auto Confirm User" was checked ✅
- [ ] SQL script run to link user to database
- [ ] Tested login in app
- [ ] Login successful! ✅

---

## 🆘 STILL HAVING ISSUES?

1. **Check Supabase project is active** (not paused)
2. **Verify email is correct:** `admin@dincollection.com`
3. **Verify password is correct:** `admin123`
4. **Check browser console** for any errors
5. **Try refreshing the page** after creating user

---

**After creating user, everything will work! 🎉**
