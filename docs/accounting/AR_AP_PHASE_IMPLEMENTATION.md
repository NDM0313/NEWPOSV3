# AR/AP reconciliation — implementation (phased)

Read-only foundation + UI honesty; journal remains GL source of truth; Trial Balance formula unchanged.

---

## 1. Exact files to change

| Area | Files |
|------|--------|
| SQL | `migrations/20260328_ar_ap_reconciliation_layer.sql` (view + RPC) |
| Reports / GL snapshot | `src/app/services/accountingReportsService.ts` (`getArApGlSnapshot`) |
| Reconciliation API | `src/app/services/contactBalanceReconciliationService.ts` |
| Contacts UI | `src/app/components/contacts/ContactsPage.tsx` |
| COA / Accounts tab | `src/app/components/accounting/AccountingDashboard.tsx` |
| TB UX (prior) | `src/app/components/reports/TrialBalancePage.tsx` |
| Operational balances RPC | `migrations/get_contact_balances_summary_rpc.sql`, `migrations/get_contact_balances_summary_worker_ledger_fix.sql` |
| Audit narrative | `docs/accounting/AR_AP_CONTROL_VS_SUBLEDGER_AUDIT.md` |

---

## 2. SQL views/RPCs to add

**Deployed in:** `20260328_ar_ap_reconciliation_layer.sql`

- **`v_reconciliation_ar_ap_line_audit`** — Lines on AR/AP control accounts (by account code `1100`/`2000` or name+type heuristic), joined to `journal_entries`, with `is_unmapped_heuristic` from `reference_type` / `reference_id` only (no `party_contact_id` yet).
- **`count_unmapped_ar_ap_journal_entries(p_company_id, p_branch_id, p_as_of_date)`** — Returns `ar_unmapped_entry_count`, `ap_unmapped_entry_count` (distinct JEs with any unmapped-heuristic line through as-of date).

**Branch / company:** `p_branch_id NULL` = all branches; UUID = only rows where `journal_entries.branch_id` matches (JEs with NULL branch excluded when filtering by branch).

**Optional next SQL (not required for phase 1):** materialized summary per company/branch for heavy dashboards; RPC returning operational totals vs GL in one round-trip (currently merged in TS).

---

## 3. New backend service design

**File:** `contactBalanceReconciliationService.ts`

- **`getCompanyReconciliationSnapshot(companyId, branchId?, asOfDate?, options?)`**
  - Pulls GL AR/AP via `accountingReportsService.getArApGlSnapshot` (TB-consistent control balances).
  - Optionally uses **tab-scoped** operational totals from `options.operationalReceivablesTotal` / `operationalPayablesTotal`; else sums full `get_contact_balances_summary` map.
  - Calls `count_unmapped_ar_ap_journal_entries`; tolerates RPC missing (counts → 0).
  - Returns: `operationalReceivablesTotal`, `operationalPayablesTotal`, `glArNetDrMinusCr`, `glApNetCredit`, variances, `unmappedArJournalCount`, `unmappedApJournalCount`, `confidence: 'pending_journal_mapping'`, `message`.
- **`buildContactReconciliationRow`** — Per-contact GL `null` until line-level party linkage exists.
- **`AR_AP_POSTING_TOUCHPOINTS`** — Static checklist for phase 4 posting audit.

---

## 4. UI changes for Contacts and COA

**Contacts (`ContactsPage.tsx`)**

- Summary cards: label operational totals as **“Operational · open documents”**; disclaimer that they are not statutory GL.
- **`reconSnapshot` effect** must run **after** `summary` `useMemo` (avoid TDZ on `summary`).
- Panel **“Reconciliation · this tab vs GL control”**: Operational | GL (Dr−Cr / Cr−Dr) | Variance | Unmapped JE badges; link to Trial Balance; explicit note that per-contact GL-aligned balance is **pending journal mapping**.

**COA / Accounts (`AccountingDashboard.tsx`, Accounts tab)**

- Rows whose name matches **Accounts Receivable**, **Accounts Payable**, or **Worker Payable**: badge **GL control**; actions **Open GL ledger** (same as ledger), **Open subledger** (navigate to Contacts + toast), **Open reconciliation** (Contacts + toast).

---

## 5. Recommended schema evolution for party linkage

**Preferred:** nullable **`party_contact_id`** (UUID, FK to `contacts` or your canonical party table) on **`journal_entry_lines`**, plus optional **`party_role`** enum/text if one line could imply multiple semantics.

**Why over a mapping table:** fewer joins for subledger rollups and TB drill-down; matches common ERP subledger dimension pattern. Use a separate **`journal_line_party_allocations`** table only if you need **split** party lines (one line → N parties with amounts).

**Migration shape**

1. `ALTER TABLE journal_entry_lines ADD COLUMN party_contact_id UUID REFERENCES ... NULL;`
2. Backfill from `journal_entries.reference_type` / `reference_id` where resolvable (sales → customer, purchases → supplier, etc.) in **batches** with logging.
3. Partial index: `(company_id, party_contact_id) WHERE party_contact_id IS NOT NULL` if table is wide; index `account_id` already supports control-account filters.

**Rollout safety:** nullable column; old reports unchanged if they ignore the column; new views/RPCs **opt in** to `party_contact_id` when non-null, else fall back to current heuristic.

---

## 6. Lowest-risk rollout order

1. Apply `20260328_ar_ap_reconciliation_layer.sql` on Supabase (view + RPC grants).
2. Deploy app with `contactBalanceReconciliationService` + Contacts reconciliation panel + COA actions.
3. Train users: operational vs GL; variance is expected until posting + backfill.
4. Implement posting changes (write `party_contact_id` on new lines) **before** relying on per-contact GL.
5. Backfill historical lines; then add per-contact GL RPC/view and row-level UI.

---

## 7. Blockers or ambiguities in current code

- **Account naming:** COA actions key off **exact** English names (`Accounts Receivable`, etc.). Renamed accounts need code-based detection (e.g. link to `accounts.code` 1100/2000) for robustness.
- **Worker Payable vs AP:** Single control bucket in some heuristics; reconciliation copy should clarify worker vs supplier subledgers where both exist.
- **Tab-scoped operational vs GL:** GL snapshot is **company-wide** (and optional branch on TB service); Contacts **operational** totals are **filtered by active tab** — variance is **methodologically mixed** unless GL is also scoped the same way (future enhancement).
- **Unmapped count:** Heuristic only; `reference_type` whitelist may mark entries “mapped” without a resolvable contact UUID.
- **RPC availability:** Until migration is applied, unmapped counts stay 0; if `getArApGlSnapshot` fails, the reconciliation `useEffect` catch clears the panel.
