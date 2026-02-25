# RLS Final Validation Checklist

---

## 1. SQL Verification (Supabase SQL Editor)

Paste and run **`deploy/RLS_FINAL_VALIDATION.sql`** in full.

### Part A (no auth)
| Check | Expected |
|-------|----------|
| relrowsecurity | `true` for purchases, rentals, expenses |
| relforcerowsecurity | `true` for all three |
| pg_policies | 12 rows (4 per table) |
| policy_count | purchases=4, rentals=4, expenses=4 |

### Part B (authenticated – run as user)
| Check | Expected |
|-------|----------|
| auth.uid() | Non-null UUID |
| public.users WHERE id = auth.uid() | Exactly 1 row with company_id |
| count(*) purchases/rentals/expenses | Only that company's rows |
| Sample SELECT | Returns rows; company_id matches user's company |

**Quick run:** Sidebar → Test Pages → **RLS Validation**. Click "Run Validation" while logged in.

---

## 2. Manual UI Test Checklist

### Purchases
- [ ] Navigate to **Purchases**
- [ ] List loads (rows visible, no empty state if data exists)
- [ ] Click **Edit** on a row → drawer opens, fields prefilled
- [ ] Change amount, save → row updates, no duplicate
- [ ] Create new purchase → appears in list, company_id correct (verify via SQL)

### Rentals (RentalsPage primary – List tab)
- [ ] Navigate to **Rentals** → **List** tab
- [ ] List loads (rows visible)
- [ ] Click **View** → details drawer opens
- [ ] Click **Edit** → booking drawer opens, data prefilled
- [ ] Change return date / late fee, save → updates, no duplicate

### Expenses (soft delete)
- [ ] Navigate to **Expenses**
- [ ] List loads
- [ ] Click **View** → details sheet opens
- [ ] Click **Edit** → drawer opens, save → updates
- [ ] Click **Delete** → AlertDialog confirms → confirm
- [ ] Row removed from list (or hidden)
- [ ] SQL: `SELECT status FROM expenses WHERE id = '...'` → `status = 'rejected'`

---

## 3. Troubleshooting

### User sees zero rows

**Cause:** `auth.uid()` → `public.users` mapping broken.

**Check:**
```sql
-- 1. Get current user (run from app / "Run as user")
SELECT auth.uid();

-- 2. Does this user exist in public.users?
SELECT id, company_id, email FROM public.users WHERE id = 'PASTE_UUID_HERE';

-- 3. If 0 rows: user not in public.users. Fix:
-- Insert row: INSERT INTO public.users (id, company_id, email, role) VALUES ('auth-uuid', 'company-uuid', 'email', 'admin');
```

**Flow:** `auth.uid()` → `public.users.id` → `public.users.company_id` → RLS policy uses this company_id. If user missing, policy subquery returns NULL → no rows match.

### INSERT fails silently

- Check WITH CHECK clause: `company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())`
- Ensure app sends `company_id` from user context (not hardcoded).
- Verify `public.users.company_id` is NOT NULL for the user.

### UPDATE affects 0 rows (cross-company)

- Expected. RLS blocks updates to other company's rows.
- Same-company update should work.

### Expense delete: row still in DB

- Expected. Soft delete sets `status = 'rejected'`. Row remains; RLS still applies.
- Other company users cannot see it (SELECT returns 0 rows).

---

## 4. Exact Queries Reference

```sql
-- Policies
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('purchases','rentals','expenses') ORDER BY tablename, policyname;

-- auth.uid() mapping
SELECT id, company_id, email FROM public.users WHERE id = auth.uid();

-- Count filtered (authenticated)
SELECT count(*) FROM purchases;
SELECT count(*) FROM rentals;
SELECT count(*) FROM expenses;

-- Sample latest
SELECT id, supplier_name, total, status, company_id FROM purchases ORDER BY created_at DESC LIMIT 5;
SELECT id, booking_no, status, return_date, company_id FROM rentals ORDER BY created_at DESC LIMIT 5;
SELECT id, expense_no, amount, category, status, company_id FROM expenses ORDER BY created_at DESC LIMIT 5;
```
