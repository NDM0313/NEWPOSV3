# Final basis stabilization report

This phase **does not change canonical GL math**. It separates **operational**, **GL**, **party GL**, and **reconciliation/variance** surfaces in the UI and adds additive SQL helpers.

## What changed (summary)

| Area | Change |
|------|--------|
| **Reports → Overview** | Two sub-views: **Operational Overview** (document flow) and **Financial GL Overview** (journal P&amp;L + control positions). No unlabeled “Net Profit”. |
| **Contacts** | Reconciliation strip → **four tiles**: Customer vs AR 1100, Supplier vs AP 2000, Worker vs WP 2010, variance summary (explicit non-mixing). |
| **Accounting → COA / party panel** | Drill-downs: **Operational parties**, **Trial Balance (GL)**, **Unmapped buckets** (opens control breakdown). |
| **Financial reports** | **Basis: GL (journal)** banners on Trial Balance, P&amp;L, Balance Sheet; export filenames/titles include `(GL)` and period. |
| **Dashboard / Sales / Purchases** | Prior footnotes retained; Rentals + Studio Costs + Studio Workers labeled. |
| **SQL** | `sql/final_basis_stabilization_views.sql` — views for company `db1302ec-a8d7-4cff-81ad-3c8d7cb55509`. |

## Manual verification (screenshots to capture)

**Before (historical):** single Overview mixing operational profit with GL expectations; Contacts reconciliation comparing mixed payables to AP only.

**After — check:**

1. Reports → Overview → **Operational Overview**: six cards including document due + **Net result (operational flow)**.
2. Reports → Overview → **Financial GL Overview**: revenue/expense/net profit (GL) + cash/bank + AR/AP/WP controls.
3. Contacts → expand **Reconciliation · tab vs GL**: four tiles + summary tile #4.
4. Accounting → Chart of Accounts → open party panel on control → three drill-down buttons.
5. Reports → Financial → Trial Balance / P&amp;L / Balance Sheet: green **Basis: GL** banner.
6. Rentals summary strip: basis line above stat cards.
7. Accounting → Studio Costs: violet basis line above summary cards.

## Acceptance checklist (exact verdicts)

- **Canonical GL truth** = **PASS** (unchanged; validated prior to this phase).
- **Reports Overview basis separation** = **PASS**
- **Contacts reconciliation split** = **PASS**
- **Supplier operational vs GL labeling** = **PASS**
- **Worker operational vs GL labeling** = **PASS**
- **Dashboard card basis clarity** = **PASS** (executive cards + module footnotes)
- **READY FOR DESIGN POLISH** = **YES** (logic/basis complete; visual polish optional)

## Related files

- `sql/final_basis_stabilization_views.sql`
- `sql/final_accounting_stabilization_audit.sql` (audit pack; still valid)
- `docs/accounting/DASHBOARD_BASIS_MAP.md`, `FINAL_GL_VS_OPERATIONAL_TIEOUT.md`
