# Accounting Test Bench (Developer Integrity)

Forensic accounting diagnostics for **owner / super admin / flagged staging** only.  
UI: **Developer Tools → Accounting Test Bench** or URL `/admin/accounting-test-bench`.

## Files

| File | Role |
|------|------|
| `src/app/lib/developerAccountingAccess.ts` | `canAccessAccountingDiagnostics(userRole)` |
| `src/app/services/developerAccountingDiagnosticsService.ts` | Trace search, rules, anomalies, account health |
| `src/app/components/admin/AccountingTestBenchPage.tsx` | Page UI |
| `src/app/App.tsx` | Route guard + lazy load |
| `src/app/context/NavigationContext.tsx` | View id `accounting-test-bench` |
| `src/app/components/layout/Sidebar.tsx` | Nav item (gated) |

## Access

- **Allowed:** `owner`, `super admin`, `superadmin` (case-insensitive on role string from `users.role`).
- **Local dev:** `import.meta.env.DEV` and role `admin` or `owner`.
- **Staging override:** `VITE_ACCOUNTING_DIAGNOSTICS=1` in env (any user — use only on internal deploys).

Normal **Admin** / **Manager** / **Staff** do **not** see the sidebar link; direct URL still shows **Access denied** unless one of the above applies.

## Route / navigation

1. Sidebar **Developer Tools** → **Accounting Test Bench** (only if `canAccessAccountingDiagnostics`).
2. `pushState` to `/admin/accounting-test-bench` for bookmarkable URL.
3. `App.tsx` early return renders the page when `pathname` or `currentView` matches.

## Service design

- **Read-only:** Supabase client queries only; RLS applies.
- **`runTraceSearch(companyId, query, mode)`** — resolves journals + related entities; runs **`rulesForJournal`** per hit; builds **expected vs actual** for `studio_production_stage` and `worker_advance_settlement`.
- **`fetchJournalAnomalies(companyId, limit)`** — recent `journal_entries`, full rule pass per row (N+1; keep limit low).
- **`fetchAccountHealth(companyId, codes)`** — uses anomaly scan + line match to **1100 / 1180 / 2000 / 2010**.
- **`loadJournalWithLines`** — shared loader with account codes.

## SQL / RPC / views

**None required for v1** — lowest-risk rollout uses existing tables (`journal_entries`, `journal_entry_lines`, `accounts`, `sales`, `purchases`, `payments`, `workers`, `studio_production_stages`, `worker_ledger_entries`).

**Optional later (performance):**

- Materialized view or RPC returning recent JEs with line aggregates + account codes for faster anomaly grid.
- `SECURITY DEFINER` RPC restricted to service role or `is_super_admin()` if you move rules server-side.

## Rule engine design

Rules live in **`rulesForJournal`** in the service (TypeScript). Each returns **`DiagnosticsRuleHit`**; trace attaches **`journalId`**.

| Rule id | Intent |
|---------|--------|
| `draft_sale_gl` | Sale not `final` must not have `reference_type=sale` JE |
| `draft_purchase_gl` | Purchase not in posted statuses must not have `reference_type=purchase` JE |
| `stage_bill_pattern` | `studio_production_stage` → Dr **5000** / Cr **2010** |
| `advance_settlement_pattern` | `worker_advance_settlement` → Dr **2010** / Cr **1180** |
| `worker_prepay_should_be_1180` | `worker_payment` when no unpaid stage bill → debit **1180** not **2010** |
| `worker_postbill_should_be_2010` | Opposite mismatch |
| `manual_control_touch` | `journal`/blank ref touching **1100/1180/2000/2010** |
| `voided_entry` | Voided JE — TB policy warning |
| `weak_reference` | Loose typing + no `payment_id` |

**`DIAGNOSTICS_RULE_CATALOG`** mirrors this list for the **Rule catalog** tab.

## Lowest-risk rollout order

1. **Ship UI + client service** (this PR) — no DB migrations.
2. **Train internal users** on access policy (`VITE_ACCOUNTING_DIAGNOSTICS` only on staging).
3. **Tune limits** (40–80 JEs) if anomaly tab is slow.
4. **Add server-side rules** only if you need company-wide batch without browser timeouts.
5. **Integrate with Integrity Lab** (deep-link query string) as a follow-up.

## Relationship to Accounting Integrity Lab

- **Integrity Lab** (`accounting-integrity-lab`): broader QA, certifications, snapshots.
- **Test Bench** (`accounting-test-bench`): focused **trace + rule + TB-sensitive accounts**; stricter **role gate**.
