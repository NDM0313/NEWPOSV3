# AR/AP Reconciliation Center (Integrity Lab)

User-facing workspace to **separate** operational subledger signals, GL control balances, and **exception queues** — without overwriting numbers or changing Trial Balance math.

---

## 1. Exact files to create / change

| Action | Path |
|--------|------|
| **Create** | `migrations/20260329_ar_ap_integrity_lab.sql` |
| **Create** | `src/app/services/arApReconciliationCenterService.ts` |
| **Create** | `src/app/components/accounting/ArApReconciliationCenterPage.tsx` |
| **Change** | `src/app/context/NavigationContext.tsx` — view `ar-ap-reconciliation-center` |
| **Change** | `src/app/App.tsx` — lazy route + accounting module gate |
| **Change** | `src/app/components/layout/Sidebar.tsx` — nav item |
| **Change** | `src/app/components/layout/MobileNavDrawer.tsx` — nav item |
| **Change** | `src/app/components/contacts/ContactsPage.tsx` — “Reconciliation Center” button |
| **Change** | `src/app/components/reports/TrialBalancePage.tsx` — “Integrity Lab” on AR/AP rows |
| **Change** | `src/app/components/accounting/AccountingDashboard.tsx` — “Open AR/AP Integrity Lab” on control accounts |
| **Depends** | `migrations/20260328_ar_ap_reconciliation_layer.sql` (reconciliation audit view + `count_unmapped_ar_ap_journal_entries`) |

---

## 2. SQL views / RPCs

| Object | Role |
|--------|------|
| `v_ar_ap_operational_totals` | Per `company_id`, `branch_id`: receivables/payables from **open sales/purchases only** (not full Contacts RPC). |
| `v_ar_ap_gl_control_totals` | Per company/branch: lifetime GL on AR/AP lines (from `v_reconciliation_ar_ap_line_audit`). |
| `v_ar_ap_variance_summary` | Joins operational view + GL view (lifetime); **informational** — dated TB vs Contacts still done in app. |
| `v_ar_ap_unposted_documents` | Sales/purchases with **no** non-void `journal_entries` row (`reference_type` sale/purchase + `reference_id`). |
| `v_ar_ap_unmapped_journals` | Unmapped AR/AP **lines** + `contact_mapping_status` + `reason` (heuristic). |
| `v_ar_ap_manual_adjustments` | JEs tagged `ar_ap_reconciliation`, `[AR_AP_RECON]` in description, or lines on suspense **1195** / name match. |
| `ar_ap_integrity_lab_snapshot(company, branch?, as_of_date)` | As-of GL AR/AP nets, unposted doc count, unmapped **distinct JE** counts (reuses `count_unmapped_ar_ap_journal_entries`), manual JE count, suspense balance. |
| `ensure_ar_ap_reconciliation_suspense_account(company_id)` | Idempotent insert of account **1195** `AR/AP Reconciliation Suspense`. |
| `mark_ar_ap_reconciliation_reviewed(company_id, item_kind, item_key)` | Upsert review marker. |
| `ar_ap_reconciliation_review_items` | Table backing “Mark reviewed”. |

---

## 3. Service layer design

**`arApReconciliationCenterService.ts`**

- `fetchIntegrityLabSummary` — `ar_ap_integrity_lab_snapshot` RPC + `contactService.getContactBalancesSummary` (full operational) + `getArApGlSnapshot` fallback for GL if RPC missing; computes variances; `deriveIntegrityLabStatus` for badge.
- `fetchUnpostedDocuments` / `fetchUnmappedJournalLines` / `fetchManualAdjustments` — query views with company, optional branch UUID, as-of date on date columns.
- `fetchReviewedItemKeys` / `markArApItemReviewed` — review table + RPC.
- `ensureArApSuspenseAccount` — calls `ensure_ar_ap_reconciliation_suspense_account`.
- Item key helpers: `unpostedItemKey`, `unmappedLineItemKey`, `manualJeItemKey`.

---

## 4. UI screen structure

**Route:** `ar-ap-reconciliation-center` (sidebar: **AR/AP Reconciliation**).

- **Header:** as-of date, Refresh, Back to Contacts.
- **Status badge:** combined labels (Clean · Variance · Missing posting · Unmapped · Manual adjustment) with color from worst primary status.
- **Summary cards (9):** operational recv/pay (full RPC), GL recv/pay (as-of from snapshot), variances, unposted count, unmapped JE count, manual JE count + suspense balance.
- **Explicit actions:** Ensure suspense 1195, Open Accounting, Developer Integrity Lab.
- **Tabs:** **Exception queues** (three tables) | **Rules & repair** (copy for actions).
- **Row actions (dropdown):** Open source document / Open journal / Relink contact (stub) / Create missing posting / Reverse and repost (routes to Dev Lab + toasts) / Mark reviewed.

---

## 5. Suspense-account rules

1. **Code 1195**, name **AR/AP Reconciliation Suspense** — created only via **`ensure_ar_ap_reconciliation_suspense_account`** or equivalent explicit SQL; never auto-posted without user intent.
2. Every clearing journal should include **`[AR_AP_RECON]`** in `journal_entries.description` and/or **`reference_type = 'ar_ap_reconciliation'`** so it appears in `v_ar_ap_manual_adjustments`.
3. **Suspense balance** in the lab = sum `(debit − credit)` on 1195 / name match, as-of date, branch filter aligned with snapshot.
4. Reversals: use normal journal reversal patterns; lab lists tagged/suspense JEs until voided or reversed — **no silent deletion**.

---

## 6. Rollout order

1. Apply **`20260328_ar_ap_reconciliation_layer.sql`** (if not already).
2. Apply **`20260329_ar_ap_integrity_lab.sql`**.
3. Deploy frontend.
4. Train: operational (Contacts) vs GL (TB) vs queues; “reviewed” does not fix GL.
5. Optionally run `ensure_ar_ap_reconciliation_suspense_account` per company from SQL or UI before first tagged adjustment.
6. Later: `party_contact_id` on lines + real “Relink contact” + automated posting from queues.

---

## 7. Validation checklist

- [ ] TB totals unchanged (same `getTrialBalance` / journal aggregation).
- [ ] Contacts totals unchanged (same `get_contact_balances_summary`).
- [ ] Unposted view: pick a sale with no JE — row appears; after posting sale JE — row disappears.
- [ ] Unmapped counts match `count_unmapped_ar_ap_journal_entries` for same company/branch/as-of.
- [ ] Manual queue: post a JE with `[AR_AP_RECON]` — appears; suspense balance moves when 1195 is hit.
- [ ] Mark reviewed hides row in UI until key removed from `ar_ap_reconciliation_review_items`.
- [ ] RLS: tighten `ar_ap_reconciliation_review_items` policies to your `profiles.company_id` model if `USING (true)` is too open.

---

## Branch / company filters

- **Snapshot RPC:** `p_branch_id NULL` = all branches; UUID = only JEs/documents with matching `branch_id` (NULL branch on JE excluded when filtering by branch — same as reconciliation migration).
- **Operational full totals** in UI use `get_contact_balances_summary(company, branch)` — match Contacts page branch semantics.

## Phase 2b — Unified party GL rollup (2026-07-12 → 2026-07-15)

When Party Ledger unified loaders are ON (`unified_ledger_loader_party_ledger` + engine + screen), AR/AP Diagnostics party GL summary cards use:

- **RPC:** `get_unified_contact_party_gl_balances(company, branch, as_of, basis)`
- **Operational basis:** `effective_party` (party payables cards — economic view)
- **Parity baseline:** **`official_gl`** vs Contacts `get_contact_party_gl_balances` (approval `APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL`)
- **Fallback:** `get_contact_party_gl_balances` when kill switch active, loaders OFF, or RPC not deployed
- **Shadow parity:** admin chip uses **official_gl** max per-contact delta (0.01 PKR); `effective_party` differences are explained variance, not a production fail
- **Unchanged:** exception queues, hybrid repair, control GL snapshot, operational document totals, Contacts page

Evidence: `reports/ar-ap-phase-2b-unified-wireup-20260712/` · `reports/ar-ap-phase-2b-bridal-effective-party-investigation-20260715/` · `reports/ar-ap-phase-2b-official-gl-parity-closeout-20260715/`

### Rollout status (updated 2026-07-15)

| Status | Value |
|--------|-------|
| DEVELOPMENT COMPLETE | yes — `75c12cd7` + parity baseline `a5149971` |
| GITHUB PUSHED | yes |
| MIGRATION APPROVED | yes — `APPROVE_AR_AP_PHASE2B_UNIFIED_RPC_PRODUCTION_MIGRATION` |
| MIGRATION APPLIED | yes — prod since 2026-07-11 21:36:11Z |
| PARITY BASELINE APPROVED | yes — `APPROVE_AR_AP_PHASE2B_PARITY_BASELINE_OFFICIAL_GL` |
| PRODUCTION PARITY PASS | **yes** — all three companies on **official_gl** (max Δ 0) |
| FRONTEND ON VPS | `a5149971` (`VITE_BUILD_COMMIT`) |
| FALLBACK RETAINED | yes — `get_contact_party_gl_balances` |
| Contacts page | still legacy RPC (unchanged) |

DIN BRIDAL `effective_party` vs legacy Δ ~79850 remains **intentional** (JE-0213 + JV-000203); not a production parity fail.

---

## Known limitations

- **v_ar_ap_operational_totals** and **unposted** logic do not include worker payables or contact opening balances; full operational cards use the Contacts RPC in the service.

---

## Repair workflows (20260330+)

| Migration | Adds |
|-----------|------|
| `20260330_ar_ap_repair_workflows.sql` | `fix_status` on `ar_ap_reconciliation_review_items`, `journal_party_contact_mapping`, `ap_sub_bucket` on `v_ar_ap_unmapped_journals`, `count_unmapped_ar_ap_journal_entries_split`, extended `ar_ap_integrity_lab_snapshot`, `upsert_ar_ap_reconciliation_item` |

| UI / service | Role |
|--------------|------|
| `ArApRepairDialogs.tsx` | Unposted validate+post, journal reverse/rebuild wizard, relink mapping |
| `arApRepairWorkflowService.ts` | Validation, `documentPostingEngine` post/rebuild, void JE, party suggestions, mapping insert |

**Worker vs supplier AP:** `ap_sub_bucket` = `worker` for code `2010` or account name like “Worker Payable”; otherwise `supplier` for AP lines.

**Fix statuses:** `new`, `reviewed`, `ready_to_post`, `ready_to_relink`, `ready_to_reverse_repost`, `resolved` (UI can hide resolved).
