# Next Tasks (Agla Kaam)

## 🔴 Priority 1: Studio Sale Customer Ledger – Data Show Nahi Ho Raha

**Current state:**  
- Studio sales (STD-0001, STD-0002, STD-0003) DB mein dikh rahe hain.  
- Ledger Debug page par "Studio sales in DB" se 3 rows aate hain.  
- Lekin **RPC get_customer_ledger_sales** aur **Direct sales query** dono **0 row(s)** de rahe hain (same company_id + customer_id ke sath).

**Possible cause:**  
- **RLS (Row Level Security):** `sales` table par policy `has_branch_access(branch_id)` hai. Studio sale jis branch par bani hai, agar current user ko us branch ka access nahi to direct query 0 rows dega.  
- **RPC:** Migration 41 ke baad RPC sirf `p_company_id` + `p_customer_id` use karta hai (no auth). Phir bhi 0 rows aaye to:  
  - Supabase SQL Editor mein manually run karo:  
    `SELECT * FROM get_customer_ledger_sales('8cfa0861-6df0-4910-9f1d-74fc7e65036d'::uuid, '05a7ef1b-1f22-4949-ac99-3ecf37999693'::uuid, NULL, NULL);`  
  - Agar Editor mein bhi 0 rows = RPC definition / permissions check karo (function owner, search_path).  
  - Agar Editor mein rows aaye = frontend se galat params ja rahe hon (customerId/companyId verify karo).

**Next steps (in order):**  
1. Supabase Dashboard → SQL Editor: upar wala `SELECT * FROM get_customer_ledger_sales(...)` chalao (company_id + Shah Zaman ka customer_id). Agar yahan rows aaye to RPC theek hai, issue frontend/RLS side.  
2. Agar RPC bhi 0 de: function ko **SET search_path = public** aur owner **postgres** confirm karo; zarurat ho to function dobara create karo (migration 41).  
3. **Ledger data RLS bypass:** Option A – sales/payments par ek policy add karo jo company_id match par ledger read allow kare (e.g. company_id = get_user_company_id() without branch check for SELECT). Option B – ledger ke liye server-side API (e.g. Edge Function) banao jo service role se sales/payments read kare.  
4. Ledger Debug page par "Run All 3 Tests" phir chalao; jab Test 1 (RPC) aur Test 2 (Direct) dono mein rows aane lagen to asli Customer Ledger UI mein bhi data dikhna chahiye.

---

## ✅ Done This Session (for reference)

- Customer Ledger RPC: migrations 39, 40, 41 (get_customer_ledger_sales / get_customer_ledger_payments).  
- Ledger API: RPC use + fallback, get_user_company_id NULL handling, then company_id-only filter.  
- Ledger Debug Test page: Test Pages → Ledger Debug (RPC vs API).  
- Verification: VERIFY_STUDIO_SALE_LEDGER.sql, STUDIO_SALE_LEDGER_FIX_REPORT.md.

---

## Other / Backlog

- **Contacts:** Ensure customer ledger open karte waqt same customer_id use ho jo sales.customer_id hai (already matching by id; duplicate names par confirm).  
- **Tests:** Customer Ledger API tests (Test Ledger page) pass ho rahe hain; studio-sale-specific test add karo (e.g. create mock studio sale, then getTransactions and assert count > 0).  
- **Git:** Push to GitHub – neeche commands diye gaye.

---

## GitHub Upload (aap run karein)

```bash
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3"
git status
git add .
git commit -m "Ledger: RPC migrations 39-41, Ledger Debug test page, verification scripts; studio sale ledger still 0 rows - see NEXT_TASKS.md"
git push origin main
```

Agar remote name `origin` nahi ya branch alag hai to `git remote -v` aur `git branch` check karke push karein.
