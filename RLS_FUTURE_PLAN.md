# 🔒 RLS (ROW LEVEL SECURITY) FUTURE PLAN

## 📋 CURRENT STATUS

**Status:** ❌ **RLS DISABLED**

**Date:** 2026-01-20

**Reason:** RLS is currently disabled to allow:
- Demo/testing without policy complications
- Easier development and debugging
- Faster iteration during core phase

**Acceptable For:**
- ✅ Development environment
- ✅ Demo environment
- ✅ Testing phase

**NOT Acceptable For:**
- ❌ Production environment
- ❌ Multi-tenant production
- ❌ Client-facing applications

---

## 🎯 FUTURE IMPLEMENTATION PLAN

### PHASE 1: COMPANY-BASED ISOLATION

**Goal:** Ensure users can only access their company's data

**Tables to Secure:**
- `companies` (users can only see their own company)
- `branches` (users can only see branches of their company)
- `users` (users can only see users of their company)
- `products` (users can only see products of their company)
- `contacts` (users can only see contacts of their company)
- `sales` (users can only see sales of their company)
- `purchases` (users can only see purchases of their company)
- `expenses` (users can only see expenses of their company)
- `accounts` (users can only see accounts of their company)
- `journal_entries` (users can only see journal entries of their company)
- All other company-scoped tables

**Policy Pattern:**
```sql
-- Example for products table
CREATE POLICY "Users can only see products of their company"
ON products FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can only insert products for their company"
ON products FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can only update products of their company"
ON products FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can only delete products of their company"
ON products FOR DELETE
USING (
    company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    )
);
```

---

### PHASE 2: USER-BASED ACCESS CONTROL

**Goal:** Implement role-based access control

**Roles:**
1. **Admin:**
   - Full access to all company data
   - Can manage users, settings, accounts
   - Can delete transactions (with restrictions)

2. **Manager:**
   - Full access to transactions (Sales, Purchases, Expenses)
   - Can view reports
   - Cannot modify settings
   - Cannot manage users

3. **Staff:**
   - Read-only access to most data
   - Can create sales (limited)
   - Cannot view financial reports
   - Cannot modify products

**Policy Pattern:**
```sql
-- Example: Admin only access to settings
CREATE POLICY "Only admins can modify settings"
ON settings FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Example: Staff can only view, not modify
CREATE POLICY "Staff can view products"
ON products FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Staff cannot modify products"
ON products FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM users 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
);
```

---

### PHASE 3: BRANCH-BASED FILTERING (OPTIONAL)

**Goal:** Allow branch-level data isolation

**Use Case:**
- Multi-branch companies
- Branch managers see only their branch data
- Head office sees all branches

**Policy Pattern:**
```sql
-- Example: Branch manager sees only their branch
CREATE POLICY "Branch managers see only their branch"
ON sales FOR SELECT
USING (
    branch_id IN (
        SELECT branch_id FROM user_branches 
        WHERE user_id = auth.uid()
    )
    OR
    company_id IN (
        SELECT company_id FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
```

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Enable RLS on All Tables

```sql
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
-- ... (all other tables)
```

### Step 2: Create Company-Based Policies

```sql
-- Create policies for each table
-- Use the pattern shown above
```

### Step 3: Test with Demo Company

```sql
-- Test policies with demo user
-- Verify data isolation
-- Verify access restrictions
```

### Step 4: Test with Real Companies

```sql
-- Create test real company
-- Verify no cross-company data access
-- Verify all CRUD operations work
```

### Step 5: Implement Role-Based Policies

```sql
-- Add role checks to policies
-- Test with different user roles
-- Verify access restrictions
```

---

## ⚠️ IMPORTANT CONSIDERATIONS

### Service Role Key

**Current Usage:**
- Business creation uses service role key
- This bypasses RLS (intentional)

**Future:**
- Keep service role key for:
  - Business creation
  - System-level operations
  - Admin operations

### Demo Company

**Current:**
- Demo company has `is_demo = true`
- No special RLS treatment needed

**Future:**
- Demo company policies same as real companies
- Demo users isolated from real users

### Performance

**Considerations:**
- RLS policies add query overhead
- Indexes on `company_id` critical
- Test query performance after enabling RLS

---

## 📅 TIMELINE

**Phase 1 (Company Isolation):** After demo phase complete  
**Phase 2 (Role-Based Access):** After Phase 1 tested  
**Phase 3 (Branch Filtering):** Optional, as needed

---

## ✅ SUCCESS CRITERIA

- [ ] RLS enabled on all tables
- [ ] Company isolation verified
- [ ] No cross-company data access
- [ ] Role-based access working
- [ ] Performance acceptable
- [ ] Demo company works with RLS
- [ ] Real companies work with RLS

---

**Status:** 📋 **PLANNED**  
**Priority:** 🔴 **HIGH** (Before production)  
**Estimated Effort:** 2-3 days
