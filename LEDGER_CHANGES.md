# Customer Ledger – Saari Changes (Office + Home MacBook)

Yeh file ledger se related **sab changes** document karti hai: office mein kya kiya gaya aur home MacBook par kya kiya gaya.

---

## 1. Office mein kya kiya (Supabase / Backend)

### 1.1 Migration: Customer Ledger RPC (company-only)

- **Migration file:** `supabase-extract/migrations/41_customer_ledger_rpc_company_only.sql`
- **Kya hai:**
  - `get_customer_ledger_sales(p_company_id, p_customer_id, p_from_date, p_to_date)` – **SECURITY DEFINER**, `SET search_path = public`. Sirf `company_id` + `customer_id` se filter, koi auth/RLS check nahi. Isse studio sales bhi saari branches ke ledger mein dikhti hain.
  - `get_customer_ledger_payments(p_company_id, p_sale_ids, p_from_date, p_to_date)` – same, payments ke liye.
  - **GRANT EXECUTE** dono functions par **authenticated** aur **anon** ke liye taaki app (browser) in RPCs ko call kar sake.

### 1.2 Migrations 39, 40, 41

- 39: pehla RPC version (get_user_company_id check ke sath).
- 40: null-safe / edge cases.
- 41: company-only (auth check hata kar sirf company + customer / sale_ids), + GRANT EXECUTE.

### 1.3 Verification (Office)

- SQL Editor mein:  
  `SELECT * FROM get_customer_ledger_sales('company-uuid', 'customer-uuid', NULL, NULL);`  
  → 2 rows (STD-0002, STD-0003) aani chahiye.
- Test Pages → Ledger Debug: Run All 3 Tests (RPC, Direct query, API getTransactions).
- NEXT_TASKS.md mein Priority 1 DONE mark kiya.

---

## 2. Home MacBook par kya kiya (App Code + UX)

### 2.1 Customer Ledger data source (accountingService)

**Problem:** Main Customer Ledger **accountingService.getCustomerLedger** use karta tha, jo direct `sales` / `payments` table query karta tha → RLS ki wajah se studio / kuch sales nahi dikhti thi.

**Fix:**

- **Sales:** Direct query hata kar ab **RPC `get_customer_ledger_sales`** use hota hai (company + customer, RLS bypass).
- **Payments:** Direct query hata kar ab **RPC `get_customer_ledger_payments`** use hota hai (sale IDs RPC se, RLS bypass).
- **salesMap** ab RPC result se banta hai (dobara direct sales query nahi).

**File:** `src/app/services/accountingService.ts` – `getCustomerLedger()`.

---

### 2.2 Ledger jab journal entries nahi hoti (synthetic ledger)

**Problem:** Agar customer ke liye koi journal entry line nahi thi to ledger bilkul khali aa raha tha (0 entries), chahe RPC se sales/payments aa rahe hon.

**Fix:**

- Jab **journal lines = 0** ho lekin RPC se **sales ya payments** aayein → inhi se **synthetic ledger entries** bana kar dikhate hain (date, ref no, debit/credit, running balance). Isse studio sales / aise sales jo journal mein abhi tak nahi bani, ledger mein dikh jati hain.
- **Merge step:** Jab journal se kuch entries hon lekin kuch sales/payments ka koi journal line na ho → un **missing** sales/payments ko bhi synthetic entries bana kar **merge** kiya jata hai (sort by date, running balance dobara calculate). Isse **nayi regular sales** bhi ledger mein dikh jati hain jo abhi tak journal mein reflect nahi hui.

**File:** `src/app/services/accountingService.ts` – same `getCustomerLedger()`.

---

### 2.3 AR account mismatch (nayi sales ledger mein nahi dikh rahi thi)

**Problem:**

- **Ledger** sirf **ek** AR account (pehle 2000, phir 1100) ki lines padh raha tha.
- **SalesContext** (nayi sale save hone par journal entry) alag AR account use kar raha tha (e.g. 1100 ya “Accounts Receivable” ka koi aur). Isliye nayi sale ki line ledger wale account par nahi thi → ledger mein dikhai nahi de rahi thi.

**Fix:**

- **SalesContext:** AR account ab **wahi logic** use karta hai jo ledger use karta hai: pehle **code 2000**, phir **1100**, phir koi bhi AR. File: `src/app/context/SalesContext.tsx` – sale journal entry create karte waqt.
- **getCustomerLedger:** Ab **saare** AR accounts ki lines padhta hai (`.in('account_id', arAccountIds)`), sirf ek nahi. Isse 2000 aur 1100 dono ki entries ledger mein aati hain.

**Files:**  
`src/app/context/SalesContext.tsx`, `src/app/services/accountingService.ts`.

---

### 2.4 Auto-migrations (app khud migration apply kare)

**Kya kiya:**

- **`npm run dev`** ab pehle **migrations** chalata hai (`node scripts/run-migrations.js`), phir Vite. Agar `.env.local` mein **DATABASE_POOLER_URL** ya **DATABASE_URL** set ho to saari pending migrations (including 41) apply ho jati hain.
- **run-migrations.js:** Agar DB URL na ho to ab **exit(0)** (sirf message), taaki app start ho sake.
- **package.json:**  
  - `"dev": "node scripts/run-migrations.js && vite"`  
  - `"dev:no-migrate": "vite"` (bina migration ke).

**Files:** `package.json`, `scripts/run-migrations.js`.

---

### 2.5 Migration 41 – GRANT EXECUTE

- **File:** `supabase-extract/migrations/41_customer_ledger_rpc_company_only.sql`
- **Add:**  
  `GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(...) TO authenticated, anon;`  
  `GRANT EXECUTE ON FUNCTION get_customer_ledger_payments(...) TO authenticated, anon;`  
  Taaki app (browser) in RPCs ko call kar sake.

---

### 2.6 Stock / decimal display (2 digits system-wide)

**Problem:** Stock jahan bhi dikh raha tha (e.g. 265.2999999999997) decimal zyada tha.

**Fix:**

- **Global helper:** `src/app/components/ui/utils.ts` – **`formatDecimal(value, maxFractionDigits = 2)`** add kiya.
- **Use:** SaleItemsSection, PurchaseItemsSection, InventoryDashboardNew, StockAdjustmentDrawer, ProductsPage, InventoryAnalyticsTestPage – jahan bhi stock/numeric quantity dikhai de rahi thi, wahan `formatDecimal(...)` use kiya (max 2 decimal).

---

### 2.7 Shell / env (Home MacBook)

- **`.zshenv`:** `Export` → `export`, `PATH` → `$PATH` fix kiya taaki terminal error na aaye.

---

## 3. Short summary – ledger flow ab kaise kaam karta hai

1. **Customer Ledger** data **accountingService.getCustomerLedger** se aata hai.
2. **Sales / payments** ab **RPC** se aate hain (`get_customer_ledger_sales`, `get_customer_ledger_payments`) → RLS bypass, saari company sales/payments milti hain.
3. **Journal lines** ab **saare AR accounts** se aati hain (2000, 1100, etc.), sirf ek nahi.
4. **Nayi sales** journal **2000 (prefer)** / 1100 wale AR account par ban rahi hain, jise ledger padh raha hai.
5. **Agar journal line na ho** to RPC sales/payments se **synthetic entries** banti hain; agar kuch journal ho aur kuch sale/payment journal mein na ho to **merge** karke sab dikhaya jata hai.

---

## 4. Timezone Fix (Pakistan UTC+5) – Global Default

**Problem:** App browser timezone par depend karta tha – Pakistan (UTC+5) se use karte waqt date/time mismatch ho sakta tha.

**Fix:** App ab default **Asia/Karachi (Pakistan, UTC+5)** use karta hai – globally.

- **`src/lib/appConfig.ts`** – `APP_TIMEZONE = 'Asia/Karachi'`
- **`formatDateWithTimezone`** – Sale/Purchase save karte waqt ab Pakistan timezone se format (ISO +05:00)
- **`formatLongDate`**, **`formatDateAndTime`** – Display bhi Pakistan timezone se
- **`getTodayInAppTimezone()`**, **`getTodayYYYYMMDD()`** – "Today" = Pakistan ka aaj
- **`dateFormat.ts`** – Presets (Today, Yesterday, This Month, Last Month) ab Pakistan timezone ke hisaab se
- **CustomerLedgerPage** – Default date range "last 30 days" ab Pakistan "today" se
- **LedgerDebugTestPage** – To date default = Pakistan today

---

## 5. Files jin mein changes hui (reference)

| Area              | File(s) |
|-------------------|--------|
| Ledger data       | `src/app/services/accountingService.ts` |
| Sale journal (AR) | `src/app/context/SalesContext.tsx`      |
| Auto-migrate      | `package.json`, `scripts/run-migrations.js` |
| Migration 41      | `supabase-extract/migrations/41_customer_ledger_rpc_company_only.sql` |
| Decimal display   | `src/app/components/ui/utils.ts`, SaleItemsSection, PurchaseItemsSection, Inventory*, ProductsPage |
| Shell             | `~/.zshenv` (user home) |
| **Timezone**      | `src/lib/appConfig.ts`, `src/app/components/ui/utils.ts`, `src/utils/dateFormat.ts`, CustomerLedgerPage, LedgerDebugTestPage |

---

## 6. Office vs Home – kaun kya kiya

| Kaam                    | Office / Supabase     | Home MacBook / App      |
|-------------------------|------------------------|--------------------------|
| RPC migrations 39–41    | Apply / verify         | Code use RPC, merge, AR fix |
| GRANT EXECUTE           | —                      | 41 mein add              |
| getCustomerLedger RPC  | —                      | Sales/payments RPC use   |
| Synthetic + merge       | —                      | No journal → synthetic; merge missing |
| AR account align        | —                      | SalesContext + all AR IDs |
| Auto-migrations        | —                      | dev script + run-migrations |
| Stock 2 decimals       | —                      | formatDecimal global     |

Agar koi aur ledger-related change ho to isi file mein section add kar lena.
