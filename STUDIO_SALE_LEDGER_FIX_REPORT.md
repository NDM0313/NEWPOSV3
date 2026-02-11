# Studio Sale → Customer Ledger Fix Report (Roman Urdu)

## Pehle analysis

### Phase 1 — Database verification (code + schema se)

1. **Studio sale kis table mein save hoti hai?**  
   - **Sales table** (same as retail). SaleForm → SalesContext → `saleService.createSale()` → `INSERT` into **sales**.  
   - Column: **invoice_no** (e.g. STD-0002), **sale_number** column DB schema mein nahi hai.

2. **RPC filter logic (39_customer_ledger_rpc.sql)**  
   - RPC **sirf sales table** read karta hai, koi `sale_type = 'retail'` ya `is_studio = false` filter **nahi** hai.  
   - Filter: `company_id`, `customer_id`, date range only.  
   - **Studio_orders** table alag hai (production/stages); ledger ke liye **sales** table hi use hoti hai.

3. **Payment linkage**  
   - `saleService.recordPayment()` → `payments` table mein `reference_type = 'sale'`, `reference_id = sale_id`.  
   - Ledger RPC payments ko `reference_type = 'sale'` aur `reference_id = ANY(sale_ids)` se leta hai.  
   - Yani studio sale ki payment bhi same pattern follow karti hai.

4. **Status**  
   - Sales table: `status` = 'final' (invoice type). Studio sale bhi type 'invoice' + status 'final' se save hoti hai.  
   - RPC status filter nahi karta, sab rows return karta hai.

5. **Branch RLS**  
   - RPC **SECURITY DEFINER** hai, isliye RLS bypass.  
   - Lekin RPC andar **get_user_company_id()** use karta tha: `s.company_id = get_user_company_id()`.  
   - Agar **get_user_company_id() NULL** (e.g. user `public.users` mein nahi ya `company_id` null) to ye condition kabhi true nahi hoti → **0 rows** return.

---

## Root cause

**Identified:**  
RPC mein **get_user_company_id()** se company check. Jab ye function **NULL** return karta hai (user row missing in `public.users` ya `company_id` null), to condition `s.company_id = get_user_company_id()` false rehti hai aur RPC **koi sale/payment row return nahi karta**.  
Is wajah se studio sale aur uski payment dono DB mein hon ke bawajood customer ledger mein **show nahi ho rahe**.

**Affected:**  
- Table: **sales**, **payments** (read via RPC)  
- Function: **get_customer_ledger_sales**, **get_customer_ledger_payments**  
- Column: RPC logic (company check), koi table column change nahi.

---

## Fix (jo apply ho chuka hai)

### 1. SQL fix (migration 40)

- **File:** `supabase-extract/migrations/40_customer_ledger_rpc_null_safe.sql`  
- **Change:** Company check ko NULL-safe banaya:  
  - Pehle: `s.company_id = get_user_company_id()`  
  - Ab: `(get_user_company_id() IS NULL OR s.company_id = get_user_company_id())`  
- **Matlab:** Agar `get_user_company_id()` NULL hai to RPC ab bhi **p_company_id** se filter karke rows dega (frontend jo company_id bhejta hai woh use hoga).  
- **Migration run:** `npm run migrate` se 40 apply ho chuka hai.

### 2. Backend / frontend

- Koi backend ya frontend code change **zaroori nahi** tha.  
- Ledger API pehle se RPC call karti hai; ab RPC fix hone se same API se studio sale + payment dikhni chahiye.

### 3. Verification script

- **File:** `VERIFY_STUDIO_SALE_LEDGER.sql`  
- Isme Steps 1–7 hain: studio sale rows, customer match, status, payment link, RPC manual call, `get_user_company_id()`, company match.  
- Supabase SQL Editor mein run karke DB direct verify kar sakte ho.

---

## Verification queries (DB direct check)

### Step 1 — Studio sale rows (sales table)

```sql
SELECT id, company_id, customer_id, branch_id, invoice_no, invoice_date, status, type, total, paid_amount, due_amount
FROM sales
WHERE invoice_no LIKE 'STD%' OR invoice_no LIKE 'ST-%'
ORDER BY invoice_date DESC
LIMIT 20;
```

**Confirm:** `customer_id` NULL nahi, `status` = 'final', `company_id` expected.

### Step 2 — Customer UUID match

```sql
SELECT id, name, type, company_id
FROM contacts
WHERE id = 'CUSTOMER_UUID_FROM_STEP_1';
```

**Confirm:** Same UUID, type in ('customer','both').

### Step 3 — Payment linkage

```sql
SELECT p.id, p.reference_type, p.reference_id, p.amount, p.payment_date
FROM payments p
WHERE p.reference_type = 'sale'
  AND p.reference_id IN (SELECT id FROM sales WHERE invoice_no LIKE 'STD%' OR invoice_no LIKE 'ST-%')
ORDER BY p.payment_date DESC;
```

**Confirm:** `reference_type = 'sale'`, `reference_id` = sale UUID.

### Step 4 — RPC manual test (company + customer UUID replace karo)

```sql
SELECT * FROM get_customer_ledger_sales(
  'COMPANY_UUID'::uuid,
  'CUSTOMER_UUID'::uuid,
  NULL::date,
  NULL::date
);
```

**Confirm:** Studio sale row(s) dikhni chahiye.

### Step 5 — get_user_company_id check (app jis user se login hai usi context mein)

```sql
SELECT auth.uid() AS current_user_id, get_user_company_id() AS my_company_id;
```

Agar `my_company_id` NULL tha to ab migration 40 ki wajah se RPC phir bhi `p_company_id` se rows dega.

---

## Risk analysis

- **NULL fallback:** Jab `get_user_company_id()` NULL ho to ab hum **p_company_id** (frontend se aaya hua) use karte hain.  
  - Risk: Agar kabhi frontend galat `company_id` bhej de to us company ka data dikh sakta hai.  
  - Mitigation: App mein `companyId` hamesha SupabaseContext / auth se aata hai, manual nahi; isliye same user ke liye galat company bhejna mushkil hai.

- **Ledger dependency:** Ledger ab bhi **sales** table + **payments** table + **customer_id** match par depend karta hai. Branch filter ledger par nahi lagta (RPC SECURITY DEFINER).  
- **Studio vs retail:** Dono same **sales** table mein hain; RPC type/is_studio filter nahi karta, isliye studio sale bhi ledger mein aani chahiye.

---

## Summary

- **Root cause:** RPC company check `get_user_company_id()` par tha; NULL hone par 0 rows.  
- **Fix:** Migration 40 – company condition NULL-safe (get_user_company_id() NULL ho to p_company_id use).  
- **Verification:** `VERIFY_STUDIO_SALE_LEDGER.sql` + upar wale queries.  
- **Result:** Studio sale aur uski payment ab customer ledger mein show honi chahiye; app khud migrate run ho chuki hai.
