# Next Tasks (Agla Kaam)

## ✅ Priority 1: Studio Sale Customer Ledger – DONE

**Fix applied:**  
- Migration **customer_ledger_rpc_company_only** apply ki gayi (Supabase): `get_customer_ledger_sales` aur `get_customer_ledger_payments` dono **SECURITY DEFINER** + `SET search_path = public` ke sath.  
- RPC ab RLS bypass karta hai – studio sales (STD-0002, STD-0003, etc.) Customer Ledger mein dikhni chahiye.  
- Verify: SQL Editor mein `SELECT * FROM get_customer_ledger_sales('8cfa0861-6df0-4910-9f1d-74fc7e65036d'::uuid, '05a7ef1b-1f22-4949-ac99-3ecf37999693'::uuid, NULL, NULL);` → 2 rows aate hain.  

**Aap ab:** Test Pages → Ledger Debug par "Run All 3 Tests" chalao; Customer Ledger UI mein bhi studio sales dikhni chahiye.

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
