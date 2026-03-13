# ERP UI Performance Validation (Phase 2)

**Date:** 2026-03-13  
**Scope:** Post–bugfix validation for product duplicate create, duplicate UI loads, and sales date query fixes. Regression check for earlier stabilization (purchase double stock, on-account payments, ledger, shipping).

---

## Test Matrix

| Flow | What to verify | Approx timing (fill when run) |
|------|----------------|--------------------------------|
| **Contact create** | One contact created; no double save; list updates once | ___ s |
| **Product create** | One product created per click; no duplicate rows in list or DB | ___ s |
| **Purchase create** | One purchase; stock updated once (no double posting) | ___ s |
| **Sale create** | One sale; receivable/ledger correct; no double posting | ___ s |
| **Open product stock ledger** | Ledger opens; no "stockMovements already exists" timer; data correct | ___ s |

---

## Regression Checks (no regression)

1. **Purchase double stock:** Creating a purchase with line items should post stock movement once per line. Verify in product stock ledger or inventory that quantity changed by the purchased amount only (not doubled).
2. **On-account payments:** Record an on-account payment (no sale/purchase). Ledger and contact balance should update; no 400 or missing optional sale_id/purchase_id.
3. **Ledger fix:** General ledger and reports should not reference or join `studio_orders`; no runtime errors from missing table/columns.
4. **Shipping fix:** Sales flow with shipping: shipping fields save and display; no regression in sale create or edit.

---

## Before/After (Phase 2 fixes)

- **Before:** Product form could create two products on one action; console showed repeated "loadAllSettings", "inventoryOverview:parallel", "stockMovements:&lt;id&gt; already exists"; sales report/dashboard could 400 on sale_date.
- **After:** One product per save (submit lock + disabled buttons); overlapping loads guarded (settings, inventory overview, stock movements); sales queries use invoice_date; dashboard uses invoice_date in date fallback.

---

## How to run

1. Start the app (e.g. `npm run dev`).
2. Open browser devtools → Console. Confirm no "Timer ... already exists" or repeated load logs during normal navigation.
3. Execute each flow in the test matrix once; record timings and any errors.
4. Run regression checks 1–4 above.
5. Optionally create a second product with a single Save click and confirm only one row in DB (e.g. Supabase table or API list).

---

## Notes

- Timings are environment-dependent (local vs VPS, DB latency). Document "before" if you have baseline logs; "after" should show reduced duplicate work and no 400 on sales.
- If any regression appears, see rollback notes in the individual bugfix docs and in `ERP_FINAL_STABILITY_PHASE2_REPORT.md`.
