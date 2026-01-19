# Create Demo User in Supabase

## Problem
Supabase Auth requires users to be created in `auth.users` table, not just `public.users` table.

## Solution

### Option 1: Create User via Supabase Dashboard (Easiest)

1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `pcxfwmbcjrkgzibgdrlz`
3. Go to **Authentication** → **Users**
4. Click **"Add user"** → **"Create new user"**
5. Fill in:
   - **Email:** `admin@dincollection.com`
   - **Password:** `admin123`
   - **Auto Confirm User:** ✅ (Check this)
6. Click **"Create user"**

### Option 2: Create User via SQL (Advanced)

Run this in Supabase SQL Editor:

```sql
-- Create auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'authenticated',
  'authenticated',
  'admin@dincollection.com',
  crypt('admin123', gen_salt('bf')), -- Encrypted password
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Link to public.users table
INSERT INTO public.users (
  id,
  company_id,
  email,
  full_name,
  role,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
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

### Option 3: Use Supabase Management API

```bash
# Using Supabase CLI or API
curl -X POST 'https://pcxfwmbcjrkgzibgdrlz.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dincollection.com",
    "password": "admin123",
    "email_confirm": true
  }'
```

## After Creating User

1. Test login with:
   - Email: `admin@dincollection.com`
   - Password: `admin123`

2. User should be able to login successfully!
