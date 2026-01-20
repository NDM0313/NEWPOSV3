# 🎯 DEMO SETUP INSTRUCTIONS

## ✅ COMPLETED

1. ✅ Demo company created in database
2. ✅ Demo login button added to LoginPage
3. ✅ Demo data seeding script created
4. ✅ Reset script created
5. ✅ RLS status documented

## ⚠️ MANUAL STEPS REQUIRED

### Step 1: Create Auth User in Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Authentication** → **Users** → **Add user**
4. Enter:
   - **Email:** `demo@dincollection.com`
   - **Password:** `demo123`
   - **Auto Confirm User:** ✅ (MUST be checked)
5. Click **"Create user"**
6. Note the `user_id` (UUID) from the created user
7. Link to public.users:
   ```sql
   UPDATE users 
   SET id = '<auth_user_id_from_step_6>'
   WHERE email = 'demo@dincollection.com' 
   AND company_id = (SELECT id FROM companies WHERE is_demo = true);
   ```

### Step 2: Fix Demo Data Seeding Script

The demo data seeding script (`14_demo_dummy_data.sql`) has type casting issues. 

**Issue:** Function calls need proper type casts for DATE and ENUM types.

**Quick Fix:** All function calls need:
- `(CURRENT_DATE - INTERVAL 'X days')::DATE` instead of `CURRENT_DATE - INTERVAL 'X days'`
- `'value'::enum_type` for enum parameters

**Alternative:** Run the script and fix errors one by one, or manually seed demo data via frontend.

### Step 3: Verify Demo Login

1. Open application
2. Click "Demo Login (Admin)" button
3. Should automatically log in and redirect to dashboard
4. Verify data is visible

---

## 📊 DEMO COMPANY DETAILS

**Company ID:** `5aac3c47-af92-44f4-aa7d-4ca5bd4c135b`  
**Email:** `demo@dincollection.com`  
**Password:** `demo123`  
**Flag:** `is_demo = true`

---

## 🔄 RESET DEMO DATA

To reset demo data to clean state:

```sql
SELECT reset_demo_data();
```

This will:
- Delete all demo transactions
- Delete demo products and contacts
- Recreate default accounts
- Re-seed demo data

---

## ✅ SUCCESS CRITERIA

- [x] Demo company created
- [x] Demo login button created
- [x] Reset script available
- [x] RLS status documented
- [ ] Auth user created (MANUAL)
- [ ] Demo data seeded (PENDING TYPE FIXES)
- [ ] Demo login tested (PENDING)

---

**Next Steps:**
1. Create auth user
2. Fix demo data seeding script type casts
3. Test demo login
4. Verify demo flow
