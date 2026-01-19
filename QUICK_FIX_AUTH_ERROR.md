# 🚨 QUICK FIX: Authentication Error

## Problem
**Error:** `400 Bad Request` - Invalid login credentials

**Reason:** User `admin@dincollection.com` does not exist in Supabase Auth yet.

## ✅ SOLUTION (2 Minutes)

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Login to your account
3. Select project: `pcxfwmbcjrkgzibgdrlz`

### Step 2: Create User
1. Click **"Authentication"** in left sidebar
2. Click **"Users"** tab
3. Click **"Add user"** button (top right)
4. Select **"Create new user"**

### Step 3: Fill User Details
```
Email: admin@dincollection.com
Password: admin123
Auto Confirm User: ✅ (Check this box!)
```

### Step 4: Click "Create user"

### Step 5: Link to Database
Run this SQL in Supabase SQL Editor:

```sql
-- Link auth user to public.users table
INSERT INTO public.users (
  id,
  company_id,
  email,
  full_name,
  role,
  is_active
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@dincollection.com' LIMIT 1),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin@dincollection.com',
  'Admin User',
  'admin',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
```

### Step 6: Test Login
1. Go back to your app
2. Click **"Demo Account"** button
3. Should login successfully! ✅

---

## Alternative: Use Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Create user
supabase auth users create admin@dincollection.com --password admin123 --email-confirm
```

---

## Why This Happened?

Supabase has **two separate user systems**:
1. **`auth.users`** - Authentication (login credentials)
2. **`public.users`** - Application data (company, role, etc.)

Both need to exist and be linked!

---

**After creating user, login will work! 🎉**
