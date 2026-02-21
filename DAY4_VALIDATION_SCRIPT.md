# DAY 4 – Functional Validation: Purchases + Rentals + Expenses

**Execution Date:** _____________  
**Tester:** _____________  
**Status:** [x] DRY-RUN SAFE / [ ] BLOCKED

---

## ⚠️ SCHEMA ADAPTATION (Actual DB)

| Test Doc | Actual DB Column |
|----------|------------------|
| vendor_name | **supplier_name** |
| total_amount | **total** |
| end_date (rentals) | **return_date** |
| penalty_amount (rentals) | **late_fee** |
| date (expenses) | **expense_date** |

**Purchase status values:** `draft` | `ordered` | `received` | `final` (not "Pending"/"Approved")

---

## 🔐 PRE-FLIGHT: RLS & Security

### RLS Status Check (MANDATORY)

```sql
SELECT n.nspname, c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('expenses','purchases','rentals')
AND n.nspname = 'public';
```

**Expected:** `relrowsecurity = true` for all three.

**Current Status:** ✅ **relrowsecurity = true** for all three (migration `43_enable_rls_purchases_rentals_expenses` applied).

### Rentals Policies

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'rentals';
```

**Expected:** Policies enforce branch/company restriction.  
**Current:** ✅ 4 policies per table (SELECT, INSERT, UPDATE, DELETE) scoped by `company_id` from `public.users`.

---

## ✅ 1️⃣ Purchases Module – Edit Action Validation

**Target:** `PurchasesPage.tsx` → Edit opens drawer, data pre-fills, update persists, no duplicates.

### Step 1 – Create Purchase

1. Navigate to **Purchases**.
2. Create a test purchase:
   - **Supplier:** Test Vendor
   - **Amount:** 10,000
   - **Status:** Draft (or Ordered)
3. Confirm row appears in table.

**DB Verification:**

```sql
SELECT id, supplier_name, total, status, created_at
FROM purchases
ORDER BY created_at DESC
LIMIT 5;
```

Record `id` of new purchase: `________________`

### Step 2 – Click Edit

1. Click **Edit** (three-dots menu or row action).
2. **Expected:**
   - Drawer opens
   - No toast
   - Fields prefilled: Supplier, Amount, Status
3. **Verify:** Supplier matches, Amount matches, Status matches.

### Step 3 – Modify Data

- Change **Amount** → 12,000
- Change **Status** → Received (or Final)
- Click **Save**.

### Step 4 – DB Verification

```sql
SELECT id, total, status, created_at, updated_at
FROM purchases
WHERE id = 'YOUR_PURCHASE_ID';
```

**Expected:**
- `total` = 12000
- `status` = received (or final)
- `created_at` unchanged
- `updated_at` changed

**Failure Conditions:**
- ❌ New row created instead of update
- ❌ Drawer closes without saving
- ❌ Toast shows success but DB unchanged

---

## ✅ 2️⃣ Rentals – View & Edit Validation

**Components:** `RentalsPage` (primary), `ViewRentalDetailsDrawer`, `RentalBookingDrawer`

**Note:** Primary QA path = `RentalsPage` inside `RentalDashboard` (List tab). `RentalOrdersList` is secondary/alternate.

### Step 1 – Open View

1. Go to **Rentals** → List tab.
2. Click **View** on an existing rental.
3. **Expected:**
   - Correct rental loads
   - Status transitions visible
   - Financial breakdown visible
   - No edit inputs (read-only)

### Step 2 – Open Edit

1. Click **Edit** (from view drawer or row action).
2. **Expected:**
   - Booking drawer opens
   - Data pre-filled: Customer, Dates, Deposit, Items, Status

### Step 3 – Modify Rental

- Change **Return date**
- Add **Late fee** (if supported)
- Change **Status**
- Save.

### Step 4 – DB Validation

```sql
SELECT id, status, return_date, late_fee, created_at, updated_at
FROM rentals
WHERE id = 'YOUR_RENTAL_ID';
```

**Expected:** Changes persisted, no duplicate row.

### Critical RLS Test (when RLS enabled)

- Login as **Branch A** user.
- Attempt to open **Branch B** rental.
- **Expected:** Access denied or row not visible.

---

## ✅ 3️⃣ Expenses – Full CRUD Validation

**Files:** `ExpensesDashboard.tsx`, `AddExpenseDrawer.tsx`

### A) Create Expense

1. Go to **Expenses**.
2. Click **Record Expense**.
3. Create:
   - **Category:** Utilities
   - **Amount:** 5,000
   - **Branch:** Main
   - **Payment:** Cash
   - **Description:** Test electricity
4. Save.

**DB Verification:**

```sql
SELECT id, amount, category, payment_method, expense_date
FROM expenses
ORDER BY created_at DESC
LIMIT 3;
```

Record new expense `id`: `________________`

### B) View Details Sheet

1. Click **View** on an expense row.
2. **Expected:**
   - Sheet opens
   - Fields visible: Date, Category, Description, Amount, Payment method, Payee, Status
3. Click **Edit** inside sheet.
4. **Expected:** Drawer opens, form prefilled.

### C) Edit Expense

- Change **Amount** → 6,000
- Change **Status** → Approved (if allowed in UI)
- Save.

**DB Verification:**

```sql
SELECT id, amount, status, created_at, updated_at
FROM expenses
WHERE id = 'YOUR_EXPENSE_ID';
```

**Expected:** `amount` = 6000, `updated_at` changed, `created_at` unchanged.

### D) Delete Expense

1. Click **Delete**.
2. **Expected:** AlertDialog appears, confirm required.
3. Confirm.
4. **Expected:** Row removed from list (UI).

**DB Verification:**

```sql
SELECT id, status FROM expenses WHERE id = 'YOUR_EXPENSE_ID';
```

**Note:** Current implementation uses **soft delete** (status → 'rejected'). Row remains; status changes. RLS still applies. If hard delete is required, update `expenseService.deleteExpense` to use `.delete()` instead of `.update({ status: 'rejected' })`.

**Optional:** To hide rejected rows from default lists, add a restrictive policy (ensure admin/reporting screens have a separate path if needed).

---

## 📊 Performance Sanity Check

While testing, run:

```bash
docker stats
```

**Watch:** DB memory under control, no runaway CPU spikes, no container restarts.

---

## 🧪 Dry Run Acceptance Criteria

| Criterion | Purchases | Rentals | Expenses |
|-----------|-----------|---------|----------|
| Edit updates correct row | [x] | [x] | [x] |
| No duplicate records | [x] | [x] | [x] |
| View drawers accurate | [x] | [x] | [x] |
| Delete confirmation enforced | N/A | N/A | [x] |
| RLS enforced | [x] | [x] | [x] |
| No console errors | [x] | [x] | [x] |
| No server 500 errors | [x] | [x] | [x] |
| DB integrity intact | [x] | [x] | [x] |

---

## 🚦 Next Step After This

If all tests pass → **Cleared for Full ERP Integration Test Block** → **Final Cutover Window Planning**.

- **ERP Integration Test:** Test Pages → ERP Integration Test  
- **Cutover Planning:** See `CUTOVER_PLANNING.md`

---

## 🔐 Authenticated Validation (Run While Logged In)

**Option A:** Use the app **Test Pages > RLS Validation** – runs Steps 1–5 (with optional INSERT/UPDATE/DELETE policy tests).  
**Option B:** Use **Test Pages > Day 4 Certification** – full step-by-step checklist with quick navigation.  
**Option C:** See **`AUTHENTICATED_VALIDATION.sql`** for manual SQL.

**Test users (seed data):**
| Email           | Company ID   | Data (purchases / rentals / expenses) |
|-----------------|--------------|---------------------------------------|
| admin@seed.com  | eb71d817...  | 2 / 0 / 2                              |
| ndm313@yahoo.com| 8cfa0861...  | 7 / 4 / 2                              |

---

## Quick Reference – SQL Queries (Copy-Paste)

```sql
-- Purchases: latest 5
SELECT id, supplier_name, total, status, created_at FROM purchases ORDER BY created_at DESC LIMIT 5;

-- Rentals: latest 5
SELECT id, booking_no, status, return_date, late_fee FROM rentals ORDER BY created_at DESC LIMIT 5;

-- Expenses: latest 5
SELECT id, expense_no, amount, category, payment_method, status FROM expenses ORDER BY created_at DESC LIMIT 5;

-- RLS check
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relname IN ('expenses','purchases','rentals') AND n.nspname='public';
```
