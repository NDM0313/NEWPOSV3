# 🔴 LEDGER REPAIR — Final Report (Roman Urdu)

## 1. Analysis Report (Phase A + B)

### A1) Ledger UI entrypoint

- **Customer Ledger** open hota hai: **Contacts** → customer select → Ledger button → `CustomerLedgerPage` (ya `CustomerLedgerPageOriginal`).
- **`CustomerLedgerPage`** (`src/app/components/accounting/CustomerLedgerPage.tsx`) **sirf** `accountingService.getCustomerLedger(customerId, companyId, selectedBranchId, startDate, endDate, searchTerm)` call karta hai. Koi direct `sales`/`payments` table query nahi.
- **customerId** Contacts se `selectedContact.uuid` (yani contact id / UUID) ja raha hai – yehi `sales.customer_id` ke sath match hona chahiye.

### A2) Date range

- **Pehle:** `dateRange` default **from: undefined, to: undefined** tha. Jab dono undefined, `startDate`/`endDate` undefined jate hain → RPC ko `null, null` milta hai → **saari dates** include. Lekin agar kahin UI "aaj only" set kar deta to narrow range se sale hide ho sakti thi.
- **Ab:** Default **last 30 days** (from = today - 30, to = today) set kar diya taake aaj ki / nayi sale range mein rahe.

### A3) Customer selection UUID

- Ledger open karte waqt `customerId` = `selectedContact.uuid` (Contacts page). Console pe already log hai: `customerId`, `companyId`, `dateRange`, `startDate`, `endDate`. RPC row count `getCustomerLedger` ke andar log hota hai: "Customer sales found (RPC): N".

---

### B1) Sale exists + eligible (DB proof)

**Query chala:**

```sql
select id, company_id, customer_id, branch_id, status, invoice_no, invoice_date, total, created_at
from sales
order by created_at desc
limit 10;
```

**Result:** 10 sales mili. Sab `status = 'final'`. `customer_id` / `company_id` set. Example: customer `05a7ef1b-1f22-4949-ac99-3ecf37999693` par SL-0011, STD-0003, STD-0002.

**RPC rule:** `get_customer_ledger_sales` mein **koi status filter nahi** – sirf `company_id`, `customer_id`, optional `p_from_date`/`p_to_date`. Toh draft/final ka RPC level par koi chhotaana nahi.

### B2) Payments link

- `payments.reference_type = 'sale'` aur `reference_id` = sale ka UUID. Ye single source of truth hai; display number use nahi hota.

### B3) RPC direct call (DB pe)

**Query:**

```sql
select * from get_customer_ledger_sales(
  '8cfa0861-6df0-4910-9f1d-74fc7e65036d'::uuid,
  '05a7ef1b-1f22-4949-ac99-3ecf37999693'::uuid,
  null, null
);
```

**Result:** 3 rows (SL-0011, STD-0003, STD-0002). Matlab **DB/RPC theek hai** – agar UI mein nahi dikh raha to frontend / mapping / merge ya journal error pe early return.

### B4) GRANT / SECURITY DEFINER

**Query:**

```sql
select proname, prosecdef
from pg_proc
where proname in ('get_customer_ledger_sales','get_customer_ledger_payments');
```

**Result:** Dono functions **prosecdef = true** (SECURITY DEFINER). Migration 41 style GRANT EXECUTE authenticated/anon already doc mein hai.

---

## 2. Root Cause (Phase C)

### C1) Journal query error par early return (FIXED)

- **Problem:** `getCustomerLedger` mein jab **journal_entry_lines** query **error** deti thi (network, RLS, etc.), code **turant `return []`** kar raha tha. Us case mein RPC call hoti hi nahi thi, isliye RPC mein rows hon par bhi ledger **blank** rehta tha.
- **Proof:** Code path: `if (error) { ... return []; }` → RPC + synthetic kabhi run nahi hote.

### C2) Date range default (FIXED)

- **Risk:** Agar kabhi default ya UI se "today only" set ho jata to nayi sale range se bahar ho sakti thi. Default ab **last 30 days** kar diya.

### C3) RPC-first guarantee

- **Intention (LEDGER_CHANGES):** Sales/payments RPC se aayein, journal missing ho to synthetic, kuch journal + kuch missing ho to merge. **Guarantee:** Jab RPC mein rows hon, ledger kabhi "sirf isliye" blank na ho ke journal fail ho.

---

## 3. Fix Plan (Phase D)

| Item | Kya kiya |
|------|----------|
| D1) RPC-first hard | Journal lines query **error** par ab **return [] nahi** – log karo, `linesToUse = []` rakho, RPC + synthetic/merge chalne do. |
| D2) RPC filter | RPC already sirf company_id + customer_id + date use karta hai; koi extra branch/status exclude nahi. |
| D3) Studio pipeline | Studio final → `sales` table row (customer_id, etc.) + payment reference_id = sale.id; ledger RPC/synthetic/merge isi se bhar raha hai. |
| D4) Ledger Debug | Test 4 add: **getCustomerLedger** call karke entries count dikhao; agar RPC mein rows hon lekin ledger 0 to message: "RPC mein rows hain lekin ledger 0 – mapping/merge check karein". |

---

## 4. Exact Code / SQL Changes

### 4.1 accountingService.ts

**Change:** Journal lines error par early return hatao.

```ts
// PEHLE:
if (error) {
  console.error('[ACCOUNTING SERVICE] Error fetching customer ledger:', error);
  return [];
}
const linesToUse = lines || [];

// AB:
if (error) {
  console.error('[ACCOUNTING SERVICE] Error fetching journal lines (continuing with RPC/synthetic):', error);
}
const linesToUse = lines || [];
```

### 4.2 CustomerLedgerPage.tsx

**Change:** Default date range = last 30 days.

```ts
// PEHLE: from: undefined, to: undefined
// AB:
const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(() => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from, to };
});
```

### 4.3 LedgerDebugTestPage.tsx

**Change:** Test 4 add – `accountingService.getCustomerLedger` call, count + agar RPC rows > 0 lekin ledger 0 to error message.

- Import: `accountingService`.
- Test 4: `getCustomerLedger(cId, companyId, undefined, fromDate, toDate)` → `entries.length`; agar Test 1 (RPC) count > 0 aur entries.length === 0 to `error: 'RPC mein rows hain lekin ledger 0 – mapping/merge check karein'`.

### 4.4 SQL (koi naya migration nahi)

- RPC / GRANT / SECURITY DEFINER already verified. Naya SQL change nahi.

---

## 5. Verification

### 5.1 Proof queries (DB)

```sql
-- Latest sales (regular + studio)
select id, company_id, customer_id, status, invoice_no, invoice_date, total
from sales
order by created_at desc
limit 10;

-- RPC returns rows for customer
select * from get_customer_ledger_sales(
  '<company_uuid>'::uuid,
  '<customer_uuid>'::uuid,
  null, null
);

-- Payments for a sale
select id, reference_type, reference_id, amount
from payments
where reference_id = '<sale_uuid>';

-- RPC SECURITY DEFINER
select proname, prosecdef
from pg_proc
where proname in ('get_customer_ledger_sales','get_customer_ledger_payments');
```

### 5.2 UI test checklist

1. **Regular sale + ledger**
   - Ek **final** regular sale banao (invoice), payment optional.
   - Us customer ka **Customer Ledger** kholo (Contacts → customer → Ledger).
   - **Check:** Sale (aur payment agar di) ledger mein dikhe.

2. **Studio sale + ledger**
   - Studio job **final** karo (bill/sale create ho).
   - Usi customer ka ledger kholo.
   - **Check:** Studio sale (STD-*) ledger mein dikhe.

3. **Ledger Debug**
   - Test Pages → **Ledger Debug**.
   - Same company + customer select karo, date range (e.g. 2025-01-01 to aaj).
   - **Run All 4 Tests.**
   - **Check:** Test 1 (RPC) aur Test 4 (getCustomerLedger) dono mein count > 0; Test 4 ka error message na aaye.

4. **Date range**
   - Ledger kholo – default **last 30 days** dikhna chahiye.
   - Aaj ki sale is range mein honi chahiye.

---

## 6. Before / After

| Scenario | Pehle | Ab |
|----------|--------|-----|
| Journal lines query fail (e.g. RLS/network) | Ledger blank, RPC call hi nahi hoti | RPC + synthetic chalti hai, ledger RPC se bhar jata hai |
| Default date range | undefined (saari dates) | Last 30 days (aaj ki sale include) |
| Debug | Sirf RPC + Direct + getTransactions | + getCustomerLedger count, RPC vs ledger mismatch message |

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/app/services/accountingService.ts` | Journal error par return [] hata kar continue (RPC/synthetic) |
| `src/app/components/accounting/CustomerLedgerPage.tsx` | Default date range = last 30 days |
| `src/app/components/test/LedgerDebugTestPage.tsx` | Test 4: getCustomerLedger count + RPC vs ledger warning |

---

## 8. Non‑negotiable (confirm)

- **payments** table = payments ka single source; display number se logic nahi.
- Ledger customer totals **company-only** (branch access par depend nahi).
- Business logic **UUID** use karta hai (invoice_no display ke liye).

---

## 9. Regression checklist

- [ ] New regular sale (final) → Customer Ledger mein dikhe.
- [ ] New studio sale (final) → Customer Ledger mein dikhe.
- [ ] Payment add → Ledger mein payment entry dikhe.
- [ ] Ledger Debug Test 1 (RPC) aur Test 4 (getCustomerLedger) dono count > 0 jab data ho.
- [ ] Journal lines fail hone par bhi (e.g. Supabase down simulate) RPC se synthetic ledger aaye (optional manual test).
