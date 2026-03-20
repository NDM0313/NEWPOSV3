# Accounting Integrity Test Lab — RESULT (deliverable)

This document is the **RESULT.md** deliverable for the internal **Accounting Integrity Test Lab** feature (includes **Phase 2**).

## Git commit hash

Record the current **`git rev-parse HEAD`** after each tooling drop (avoid stale SHAs in docs).

---

## Phase 2 (QA usability)

| Enhancement | Detail |
|-------------|--------|
| **Check categories** | Each check has `category`: **Engine integrity**, **Reconciliation**, **Data quality / legacy**. Filter in tab C. |
| **Modes** | **Fresh scenario** = only JEs + payment totals for the **selected** sale/purchase. **Live data** = full company TB/BS/AR/AP/legacy gaps. |
| **Triage tags** | Per row: `engine_bug`, `legacy_data`, `missing_backfill`, `source_link`, `reconciliation_timing`, `informational`. |
| **Trace actions** | FAIL/WARN rows expose buttons: open sale/purchase, Accounting tab (Day Book / Journal / Accounts / Receivables / Payables), customer-ledger test, copy id. Uses `sessionStorage` key `erp_integrity_lab_nav` consumed by `AccountingDashboard` on load. |
| **Action runner** | Buttons **disabled** until the right document is selected; **Add sale payment** disabled until a **specific branch** is chosen (not “All branches”) — avoids bad `recordPayment` calls / 400s. |
| **Purchase list 400 fix** | Loads `po_no` (not `po_number`) and orders by `id` — matches DB (`localhost-*.log` purchase 400). |
| **Extended snapshots (F)** | Before/after JSON includes document, payments, **journal lines with accounts**, **affectedAccounts**, aggregate Dr−Cr, **company TB hint**, **AR/AP snapshot**, inventory heuristic. |
| **Regression presets (G)** | One-click strips for sale + purchase flows at top of tab B. |
| **Status banner** | Green if **no FAIL**; WARN-only (typical in Live mode) no longer shows as hard failure. |

---

## What was built

| Item | Location |
|------|----------|
| **Page** | `src/app/components/admin/AccountingIntegrityLabPage.tsx` |
| **Service** | `src/app/services/accountingIntegrityLabService.ts` |
| **Accounting deep-link** | `src/app/components/accounting/AccountingDashboard.tsx` reads `INTEGRITY_LAB_SESSION_KEY` |
| **Navigation** | Sidebar → **Developer Tools** → **Accounting Integrity Lab** (`accounting-integrity-lab`) |
| **Route wiring** | `src/app/App.tsx` (lazy-loaded), `NavigationContext` View type, `Sidebar.tsx` |

## Source of truth (enforced in code comments + checks)

- **GL:** `accounts`, `journal_entries`, `journal_entry_lines`
- **Cash/AP/AR movements tied to ops:** `payments` (with `journal_entries.payment_id` where canonical)
- **Stock:** `stock_movements`
- **Documents:** `sales`, `purchases`, line tables (`sales_items` / `sale_items`, purchase items)

Not used for GL truth in this lab: `chart_accounts`, `account_transactions`, `ledger_master` / `ledger_entries` (UI/subledgers).

## Golden rule

Only **final / posted** documents should drive accounting and stock. The lab UI states this explicitly; actions like **Finalize sale/purchase** call real services that align with production behavior.

## Sections (A–F)

- **A · Setup:** Company from session, branch filter, scenario type, pick active sale/purchase, shortcuts to open Sale/Purchase/Contact/Product drawers.
- **B · Action runner:** Wired to `saleService` / `purchaseService` (finalize, payment, discount/shipping/expense bumps, line qty +1, payment edit, cancel) and purchase equivalents.
- **C · Auto checks:** Journal entry balance scan, payment→JE link (sale/purchase), trial balance, balance sheet equation, P&L internal consistency, AR/AP reconciliation (warn tolerance), inventory heuristic, accounts.balance vs journal (skip if no column).
- **D · Effective state:** JSON snapshots: document + `payments` + `journal_entries` (with line totals) + sample `stock_movements`.
- **E · Reports reconcile:** Same suite as C (one-click).
- **F · Snapshots:** Before/after JSON for the last runner action on the selected document.

## PASS / FAIL

- Each check shows **PASS / FAIL / WARN / SKIP**.
- Failures list: **module**, **step**, **record**, **expected**, **actual**.

## Test scenario seed strategy

1. **Recommended:** Duplicate company in Supabase (or use a dedicated QA company) so production data is untouched.
2. Ensure default COA exists (`npm run ensure-accounting` or migrations).
3. Create **customer**, **supplier**, **simple product** via lab shortcuts or normal UI.
4. **Sale:** Draft → add line → **Finalize** → run checks → add payment → re-run.
5. **Purchase:** Same pattern with finalize and supplier payment.
6. **Negative tests:** Cancel sale/purchase after finalize and confirm stock reversal + status; expect some WARN on AR/AP if timing differs from GL.

## How to use the page

1. Log in as a user with **Settings / Developer Tools** access (same as other test pages).
2. Open **Developer Tools → Accounting Integrity Lab**.
3. Choose **Mode**: **Fresh** after selecting one sale or purchase to verify that document only; **Live** for company-wide health (expect legacy WARNs).
4. Set **branch** to a **specific** branch before **Add sale payment** (required).
5. Pick **Active sale** / **Active purchase** (shown in the summary strip).
6. **Tab B**: use **G · Ready-made regression** chips or the main buttons (disabled until prerequisites are met).
7. **Tab C**: filter by **Engine / Reconciliation / Data quality**; expand trace actions on any row to jump to Sales, Purchase drawer, or Accounting (search prefilled when possible).
8. **Tab F**: extended before/after JSON for the last action.
9. Do **not** expose this route to customers; it performs real DB operations.

## Blocker fixes (Priorities 1–3)

| Priority | Issue | Root cause | Fix |
|----------|--------|------------|-----|
| **1** | `GET /rest/v1/purchases?...status=in.(final,received,completed)` **400** | `completed` is **not** a DB purchase status (`draft \| ordered \| received \| final \| cancelled`). PostgREST rejects invalid enum filter. | `runPayablesVsAPCheck` now uses `PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION` = `['final','received']` in `purchaseDbConstants.ts` (aligned with dashboard/alerts). |
| **1** | PATCH noise / confusion | Same reconciliation run no longer triggers bad GET; remaining PATCH **400** is surfaced as JSON (RLS/trigger/column). | Lab tab **F** shows PostgREST `{ message, code, details, hint }` on failure. |
| **2** | `Lazy element type… promise resolves to undefined` | `React.lazy(() => import(x))` requires **default** export; `AccountingIntegrityLabPage` had only named export (fixed earlier). **Accounting** tab: `AccountingIntegrityTestLab` used `.then(m => ({ default: m.X }))` pattern vulnerable to export mismatches. | `export default AccountingIntegrityTestLab`; `lazy(() => import('./AccountingIntegrityTestLab'))` in `AccountingDashboard.tsx`. Integrity Lab route: `export default` + default lazy in `App.tsx`. |
| **3** | Before/after both showed e.g. `cancelled` after failed cancel | Stale **After** from a previous successful run; no explicit clear on error. | `wrapAction`: clear `snapshotAfter` + `lastActionError` at start; on catch set `lastActionError` to formatted API error and **do not** fetch after; **After** panel shows placeholder when action failed. |

**Priority 4 (your step):** Re-run **Fresh** and **Live** reconciliation after deploy; then trust TB/BS/AR/AP/JE triage again.

### Follow-up (purchase by-id GET 400 + lazy + snapshot audit)

| Item | Root cause | Fix |
|------|------------|-----|
| `GET …/purchases?id=eq…&select=*` **400** | (1) **Duplicate select**: `getPurchase` used `*` plus a second `attachments` field — PostgREST rejects overlapping select → **400**. (2) Broken **embed** (missing FK / schema drift) also yields 400/PGRST — needs fallback. | Removed duplicate `attachments`; narrowed `supplier:contacts(*)` to `id, name, phone`; on embed error **retry `getPurchaseSplit`**: header via `PURCHASE_HEADER_COLUMNS`, then `purchase_items`, optional `purchase_charges`, batched `products` / `product_variations`, optional `contacts`. Patches use `.select(PURCHASE_HEADER_COLUMNS)` instead of bare `.select()` where safe. |
| **Lazy undefined** (after Contact Search test) | **`CustomerLedgerInteractiveTest`** is **`export default`** only; `App.tsx` used `.then(m => ({ default: m.CustomerLedgerInteractiveTest }))` → **`undefined`**. | `lazy(() => import('…/CustomerLedgerInteractiveTest'))` (default module). |
| **Snapshot trust** | Need explicit timeline + outcome badge. | Tab **F**: ISO timestamps (before / action start / action end / after), **Success / Failed** badge, after skipped on failure; header uses `div` not `CardDescription` `<p>` to fix DOM nesting warning. |

### Known non-lab noise (from browser logs)

- `get_contact_balances_summary` **400** / missing column: **contact/RPC** issue, not the Integrity Lab. Fix RPC or migration separately.
- **Realtime WebSocket** failures: host validation / WS config — secondary to accounting engine debug.

## VPS / Supabase

- No automatic deploy is performed by this feature. Deploy web as usual (`npm run build`, push to host).
- Supabase: RLS applies; use a QA company or admin-capable user for full tests.

## Limitations (v1)

- **Customer ledger** subledger is not fully reconciled to JE in this page (focus is GL + documents + payments).
- **Inventory valuation vs stock** is a **WARN** heuristic (full valuation = Reports → Inventory Valuation).
- **Multi-company** switch is not on this page; change company via user profile / admin assignment.

---

*End of RESULT document.*
