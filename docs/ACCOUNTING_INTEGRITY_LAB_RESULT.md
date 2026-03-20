# Accounting Integrity Test Lab — RESULT (deliverable)

This document is the **RESULT.md** deliverable for the internal **Accounting Integrity Test Lab** feature (includes **Phase 2**).

## Git commit hash

Record **`git rev-parse HEAD`** after each tooling drop (avoid stale SHAs in docs).

**Latest (canonical sale document JE fix):** `5a4d6c4`

---

## 2026-03-12 — Fresh posting gate: canonical purchase **document** JE only

| Item | Detail |
|------|--------|
| **Symptom** | Document certification **FAIL**: *Fresh posting gate (purchase)* — expected single canonical document JE, actual `active_je_count = 3`. |
| **Root cause** | Purchase flow still had direct canonical JE writers in `PurchaseContext` (create + update fallback), and checks were broad by `reference_type='purchase'` without strict canonical filtering (`payment_id IS NULL`). |
| **Fix** | Centralized canonical creation in `purchaseAccountingService.createPurchaseJournalEntry` with idempotent reuse; added canonical helpers (`findActiveCanonicalPurchaseDocumentJournalEntryId`, `listActiveCanonicalPurchaseDocumentJournalEntryIds`, `purchaseDocumentJournalFingerprint`); duplicate recovery in `accountingService.createEntry` now resolves canonical purchase JE only. |
| **Lab** | `runPostingStatusGateFreshCheck` and live non-posted purchase sample count only canonical purchase document JEs (`payment_id` null). |
| **SQL** | `migrations/20260312_canonical_purchase_document_je_unique_and_repair.sql` — preview duplicate canonical purchase JEs, void extras, keep one, add partial unique index `idx_journal_entries_canonical_purchase_document_active`. |
| **Files** | `purchaseAccountingService.ts`, `PurchaseContext.tsx`, `accountingIntegrityLabService.ts`, `accountingService.ts`, migration above. |

**QA:** draft/ordered → no canonical purchase JE; finalize/received → exactly one canonical purchase document JE; discount/freight edits → `purchase_adjustment` only; payment/account edit → payment JE / `payment_adjustment` only; cancel posted purchase should not create extra canonical document JEs.

---

## 2026-03-12 — Fresh posting gate: canonical sale **document** JE only

| Item | Detail |
|------|--------|
| **Symptom** | Document certification **FAIL**: *Fresh posting gate (sale)* — `expected` single canonical document JE, `actual` `active_je_count = 4` (or N payments). |
| **Root cause** | Payment receipt JEs use **`reference_type = 'sale'`** + **`payment_id`** (DB trigger `create_payment_journal_entry`). Counting all `reference_type = 'sale'` rows **includes payment JEs**. The old duplicate guard could also treat a payment row as “already posted” and skip the real document JE. |
| **Fix** | Canonical classifier: **`payment_id IS NULL`**, not void, `reference_type = 'sale'`. Engine + lab + `createEntry` idempotent path aligned. |
| **SQL** | `migrations/20260312_canonical_sale_document_je_unique_and_repair.sql` — commented **preview** query, **void** duplicate canonical rows (keep one), **partial unique index** `idx_journal_entries_canonical_sale_document_active`. |
| **Files** | `saleAccountingService.ts`, `accountingService.ts`, `accountingIntegrityLabService.ts`, `SalesContext.tsx`, migration above. |

**QA:** Same flow as table in § “Draft JE / 409 / legacy triggers”; Fresh gate must report **`active_je_count = 1`** for posted sale with total &gt; 0 when payments exist.

---

## 2026-03-20 — Two-layer verification (document vs company)

### Why action success and company reconciliation were mixed

The lab used one checklist and one **PASS/FAIL** banner. **Fresh** vs **Live** mode selected different queries, but operators still conflated “my sale payment worked” with “trial balance balances company-wide.” **Live** includes AR/AP mismatches from old rows — unrelated to the document under test.

### New mechanism

1. **Document certification** (`checkLayer: document`, `runDocumentCertificationChecks`) — answers: *Is this selected sale/purchase internally consistent right now?* Scoped data only; **not** company TB/BS/AR/AP.
2. **Company reconciliation** (`checkLayer: company`, `runCompanyReconciliationChecks`) — answers: *Does the whole company/legacy data pass reconciliation heuristics?* Explicit manual run; may **WARN/FAIL** even when the last document action was correct.

### How to use the lab

- Use **Action runner** for the flow under test; after success, **document certification** runs automatically (if a doc id is in scope).
- Run **company reconciliation** only when you want a legacy/whole-company read — tab **C §2** or tab **E**.
- Interpret **PASS**: **Document certification PASS** = no FAIL rows in that list (WARN/SKIP allowed). **Company PASS** = no FAIL and no WARN in that suite; **WARN** = no FAIL but at least one WARN.

### Phase 2 (QA usability) — updated

| Enhancement | Detail |
|-------------|--------|
| **Check categories** | Each check has `category`: **Engine integrity**, **Reconciliation**, **Data quality / legacy**. Filter in tab C (applies to both lists). |
| **Two layers** | **Document certification** vs **Whole company / legacy reconciliation** — separate buttons, separate result lists, separate header badges. |
| **Triage tags** | Per row: `engine_bug`, `legacy_data`, `missing_backfill`, `source_link`, `reconciliation_timing`, `informational`. |
| **Trace actions** | FAIL/WARN rows expose buttons: open sale/purchase, Accounting tab (Day Book / Journal / Accounts / Receivables / Payables), customer-ledger test, copy id. Uses `sessionStorage` key `erp_integrity_lab_nav` consumed by `AccountingDashboard` on load. |
| **Action runner** | Buttons **disabled** until the right document is selected; **Add sale payment** disabled until a **specific branch** is chosen (not “All branches”) — avoids bad `recordPayment` calls / 400s. After success, **only** document certification refreshes — not company reconciliation. |
| **Purchase list 400 fix** | Loads `po_no` (not `po_number`) and orders by `id` — matches DB (`localhost-*.log` purchase 400). |
| **Extended snapshots (F)** | Before/after JSON includes document, payments, **journal lines with accounts**, **affectedAccounts**, aggregate Dr−Cr, **company TB hint**, **AR/AP snapshot**, inventory heuristic. Each action has **`actionId`**. |
| **Regression presets (G)** | One-click strips for sale + purchase flows at top of tab B. |
| **Status banners** | **Document certification: PASS/FAIL** and **Company reconciliation: PASS/WARN/FAIL/Not run** (independent). |

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

### 2026-03-12 — Live posting-gate sample + `converted` filter (400 fix)

| Item | Detail |
|------|--------|
| **Symptom** | Browser console spam: `GET .../sales?...converted=eq.false...` **400**, same for `purchases`, Integrity Lab live sample. |
| **Cause** | Live DB had **no** `sales.converted` / `purchases.converted` until migration applied; PostgREST rejects unknown filter columns. |
| **DB fix** | Applied `20260320_sales_purchases_conversion_workflow.sql` (+ `20260321_*` as `supabase_admin` for stock function owner). Added RPC `app_document_conversion_schema()` (`20260322_*`). |
| **App fix** | `getDocumentConversionSchemaFlags()` + canonical statuses in `documentStatusConstants.ts`; `runPostingStatusGateLiveCheck` uses flags before `.eq('converted', false)`. **Posting rules unchanged** (`postingStatusGate.ts` still final-only for sales; final\|received for purchases). |
| **Audit** | [LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md](./LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md) |

### 2026-03-12 — Draft JE / 409 / legacy triggers (enforced in code + SQL)

| Item | Root cause | Fix |
|------|------------|-----|
| **“DRAFT-0001” + JE** | Invoice **number** can stay `DRAFT-*` after **Finalize** while `status` is `final`; plus **duplicate paths** (SalesContext direct `journal_entries` insert + `saleAccountingService` + optional DB `auto_post_sale`). | `createSaleJournalEntry` **re-reads `sales.status`** and returns `null` unless `status === 'final'`. SalesContext uses **only** `saleAccountingService` (removed inline JE + `create_discount_journal_entry` RPC). |
| **POST journal_entries 409** | Unique index on `action_fingerprint` (PF-14.5) and/or **parallel sale** rows for same `reference_id` from trigger + app. | `accountingService.createEntry` treats **23505/409/unique** as idempotent: returns existing **`sale`** JE by `reference_id` or existing row by **fingerprint**. |
| **Legacy DB overlap** | `trigger_auto_post_sale_to_accounting` / `trigger_auto_post_purchase_to_accounting` / contact-balance triggers fight the app engine. | SQL: `migrations/20260312_disable_legacy_auto_post_contact_triggers.sql`. Audit: `docs/accounting/LEGACY_TRIGGER_AUDIT.md`. **Keep** `trigger_calculate_*_totals`. |

**Minimal QA script (after migrations on Supabase):** draft sale → no **canonical** `reference_type=sale` **document** JE (`payment_id` null); finalize → exactly **one** canonical document JE; add payment → payment JE (`payment_id` set, still `reference_type=sale`); cancel finalized sale → one `sale_reversal` JE; no 409 on double-click finalize.

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

### 2026-03-20 — Unbalanced JE root-cause + repair

| Item | Finding | Action |
|------|---------|--------|
| Unbalanced JE #1 | `dc2fd0f9-dd66-4e52-876c-bad2021bcfe7` (`EXP-0001`, ref `sale/8b4e9b31-...`): Dr `5200` 1500 + Dr `1100` 1500, **no credit** (diff 3000). | Voided as legacy bad voucher via targeted migration. |
| Unbalanced JE #2 | `4bce1498-bae8-40d8-9eb5-a3aca8d0239f` (`EXP-0002`, ref `sale/405c2ccd-...`): Dr `5200` 5000 + Dr `2000` 5000, **no credit** (diff 10000). | Voided as legacy bad voucher via targeted migration. |
| Generator logic | Old extra-expense sale posting path produced EXP-* duplicate/unbalanced entries; current DB function `create_extra_expense_journal_entry` is already **no-op** and SalesContext no longer calls it. | Kept engine fix, added traceable live-data repair migration. |

Repair migration:

- `migrations/20260320_void_legacy_unbalanced_exp_sale_je.sql`
- Safe scope: specific JE ids only, company-scoped, only if currently unbalanced + not already void.

Post-repair verification snapshot:

- Unbalanced JEs: **0**
- Trial Balance: debit `3719230.00` = credit `3719230.00`, diff **`0.00`**
- Balance Sheet diff: **`283800`** (non-zero, still requires separate reconciliation)
- Receivables vs AR diff: **`203400`**
- Payables vs AP diff: **`-865770`**
- Payments -> `journal_entries.payment_id` missing links: **1** row (purchase payment, likely legacy/backfill gap)

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
