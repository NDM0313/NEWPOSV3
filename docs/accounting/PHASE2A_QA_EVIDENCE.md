# PHASE 2A QA Evidence

**Last verified (DB/runtime):** 2026-03-30  
**Scope:** Parity implementation + Phase 2A.1 sync alignment + Phase 2A.2 migration (`migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql`) — **applied on target DB.**

## Environment Notes

- No destructive scripts; no table deletion as part of this phase.
- Evidence below records **executed** SQL / RPC outputs supplied by QA (not templates only).

---

## 1) Worker payment canonical chain from mobile — **PASS**

- **Test case:** Mobile worker payment writes canonical chain (`payments` → `journal_entries` → `journal_entry_lines` → `worker_ledger_entries`).
- **Screen/path:** `Accounts → Worker Payment` — `erp-mobile-app/src/components/accounts/WorkerPaymentFlow.tsx`; API `erp-mobile-app/src/api/accounts.ts` (`recordWorkerPayment`).
- **Recorded identifiers:** `reference_number = PAY-0038`, `worker_id = d208e44f-bf49-4288-8c01-d486ecb6da5c` (company context as per QA DB; see template section below for example company id used in capture).
- **Exact SQL verification:** Row-detail queries as in section “SQL evidence” below (payments / JE / JEL / worker_ledger).
- **Result:** **PASS** — canonical four-layer chain present for the posted payment.
- **Screenshot (optional follow-up):** May attach mobile success screen for training docs; **not a phase gate blocker.**

## 2) Duplicate retry / idempotency (count check) — **PASS**

- **Test case:** Same worker + `PAY-0038` must not produce duplicate rows across layers.
- **Recorded counts (verified DB):**
  - `payments_ct = 1`
  - `je_ct = 1`
  - `jel_ct = 2` (two `journal_entry_lines` for the one JE)
  - `worker_ledger_ct = 1`
- **Code path:** `recordWorkerPayment` idempotency + `erp-mobile-app/src/lib/registerSyncHandlers.ts` worker payment replay contract.
- **Result:** **PASS**
- **Screenshot (optional follow-up):** Not required for gate.

## 3) Branch-aware customer ledger RPC (runtime) — **PASS**

- **Test case:** `get_customer_ledger_sales` callable with `p_branch_id`; company scope vs branch scope.
- **Migration signatures (verified):** `get_customer_ledger_sales(uuid, uuid, date, date, uuid)`; `get_financial_dashboard_metrics(uuid, uuid)`.
- **Recorded customer:** `customer_id = 45e60a2e-9b1a-478c-8f75-cf09d29a0eba`
- **Recorded row counts:** `company_scope row_ct = 2`, `branch_scope row_ct = 2`
- **Interpretation:** RPC is branch-aware at runtime; for this customer, final rows fall in the selected branch so counts match (not a defect).
- **Client paths:** `erp-mobile-app/src/api/customerLedger.ts`, `src/app/services/customerLedgerApi.ts`, `src/app/services/accountingService.ts`.
- **Result:** **PASS**
- **Optional follow-up:** Side-by-side web/mobile UI screenshots for training — **not a blocker.**

### SQL templates (branch ledger)

```sql
SELECT count(*) FROM get_customer_ledger_sales(:company_id, :customer_id, NULL, NULL, NULL);
SELECT count(*) FROM get_customer_ledger_sales(:company_id, :customer_id, NULL, NULL, :branch_id);
```

## 4) Payables/receivables source-label parity

- **Test case:** Explicit operational due-source labels on web + mobile
- **Screen/path used:**  
  - Mobile `Accounts -> Receivables` and `Accounts -> Payables`  
  - Web `AccountingDashboard` receivable/payable tabs
- **Exact SQL verification used:** Not SQL-driven (UI semantics check)
- **Evidence reference:**  
  - `erp-mobile-app/src/components/accounts/ReceivablesReport.tsx` label: `Source: operational document due ('sales.due_amount')`  
  - `erp-mobile-app/src/components/accounts/PayablesReport.tsx` label: `Source: operational document due ('purchases.due_amount')`  
  - `src/app/components/accounting/AccountingDashboard.tsx` labels for GL cards and operational receivable/payable tabs
- **Result:** PASS
- **Screenshot (optional):** For training only — **not a gate blocker.**
- **Notes:** Label parity is explicit and consistent with Phase 2A semantic split (see also `AccountingDashboard.tsx` legend for GL vs document vs contact roll-up).

## 5) Dashboard executive AR/AP basis (runtime) — **PASS**

- **Test case:** `get_financial_dashboard_metrics(company_id, branch_id)` exposes operational roll-up aligned to `get_contact_balances_summary`.
- **Screen/path:** Web `Dashboard` (`src/app/components/dashboard/Dashboard.tsx` + `get_dashboard_metrics`); mobile `erp-mobile-app/src/components/dashboard/DashboardModule.tsx` + `erp-mobile-app/src/api/financialDashboard.ts`.
- **Verified RPC output (branch-scoped run):**
  - `ar_ap_basis = get_contact_balances_summary`
  - `ar_ap_scope = branch`
  - `receivables = 18000.03`
  - `payables = 464302.00`
- **Cross-check:** Values match branch-scoped `SUM(receivables)` / `SUM(payables)` from `get_contact_balances_summary` for the same `company_id` / `branch_id` (verified in QA).
- **Result:** **PASS**
- **Screenshot (optional follow-up):** Executive cards — **not a blocker.**

## 6) Zero new legacy references

- **Test case:** Confirm no new usage of blocked legacy tables in parity-touched files
- **Screen/path used:** Source scan only
- **Exact SQL verification used:** N/A
- **Exact scan patterns used:**  
  - `chart_accounts`  
  - `account_transactions`  
  - `accounting_audit_logs`  
  - `automation_rules`  
  - `ledger_master`  
  - `\bledger_entries\b`
- **Files scanned:**  
  - `erp-mobile-app/src/api/accounts.ts`  
  - `erp-mobile-app/src/api/customerLedger.ts`  
  - `erp-mobile-app/src/components/dashboard/DashboardModule.tsx`  
  - `erp-mobile-app/src/lib/registerSyncHandlers.ts`
- **Result:** PASS
- **Screenshot/evidence reference:** Search command outputs from this run
- **Notes:** No blocked legacy table references introduced by parity/sync changes.

## 7) Regression smoke checks

- **Test case:** Supplier payment, general JE, customer ledger open, web accounting tabs render.
- **Result:** **Informational** — optional periodic smoke capture recommended; **not recorded as a gate failure** (core DB evidence above closes Phase 2A).

---

## Priority Task A (sync/offline alignment) — **PASS**

- **Patch:** `erp-mobile-app/src/lib/registerSyncHandlers.ts`
- Worker replay passes `paymentAccountId` and forwards `branchId`, `paymentMethod`, `userId`, `workerName`, `paymentReference`, `stageId`.

## Informational follow-ups (non-blocking)

- Optional screenshots: worker payment success, executive dashboard cards, branch ledger UI.
- Optional full regression smoke log attachment.
- Legacy offline queue runbook for payloads missing `paymentAccountId` (see `PHASE2A_OPEN_ITEMS.md`).

---

## Phase 2A.2 — Migration + runtime (consolidated)

- **Migration file:** `migrations/20260370_phase2a2_ledger_sales_branch_dashboard_contact_ar_ap.sql` — **applied on DB** (no further migration edit in this doc pass).
- **Test A — `get_customer_ledger_sales`:** **PASS** — signature `get_customer_ledger_sales(uuid, uuid, date, date, uuid)`; runtime branch test with customer `45e60a2e-9b1a-478c-8f75-cf09d29a0eba` (counts above).
- **Test B — `get_financial_dashboard_metrics`:** **PASS** — signature `get_financial_dashboard_metrics(uuid, uuid)`; verified JSON fields and amounts above; matches `get_contact_balances_summary` sums.

### Historical note (why old dashboard AR/AP differed from other screens)

- **Pre–2A.2:** `receivables` in `get_financial_dashboard_metrics` used `SUM(sales.due_amount)` for final + `due > 0` only (`migrations/20260342_dashboard_metrics_cash_bank_journal_sot.sql`).
- **Post–2A.2:** Executive AR/AP = `SUM` over `get_contact_balances_summary` (per `20260370` + `20260353` rules). GL AR/AP remains journal-derived on Accounting top cards; document due remains on Receivables/Payables tabs — see `AccountingDashboard.tsx` legend.

# PHASE 2A QA Evidence Capture (filled run)

Date: 2026-03-30  
Company ID (example QA): `db1302ec-a8d7-4cff-81ad-3c8d7cb55509`  
Worker ID: `d208e44f-bf49-4288-8c01-d486ecb6da5c`  
Payment reference: `PAY-0038`

---

## Test 1 — Worker Payment Canonical Chain + duplicate counts (mobile-origin) — PASS

### Verified counts

| Layer | Count |
|--------|--------|
| `payments` | 1 |
| `journal_entries` (via `payment_id`) | 1 |
| `journal_entry_lines` | 2 |
| `worker_ledger_entries` | 1 |

### SQL evidence (payments)
```sql
SELECT id, company_id, branch_id, reference_type, reference_id, reference_number, amount, payment_date, payment_account_id
FROM payments
WHERE company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'
  AND reference_type = 'worker_payment'
  AND reference_id = 'd208e44f-bf49-4288-8c01-d486ecb6da5c'
  AND reference_number = 'PAY-0038';
```

### Count checks (verified: all 1 except `jel_ct` = 2)

```sql
SELECT COUNT(*) AS payments_ct FROM payments
WHERE company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'
  AND reference_type = 'worker_payment'
  AND reference_id = 'd208e44f-bf49-4288-8c01-d486ecb6da5c'
  AND reference_number = 'PAY-0038';

SELECT COUNT(*) AS je_ct FROM journal_entries je
JOIN payments p ON p.id = je.payment_id
WHERE p.company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'
  AND p.reference_number = 'PAY-0038';

SELECT COUNT(*) AS jel_ct FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN payments p ON p.id = je.payment_id
WHERE p.company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'
  AND p.reference_number = 'PAY-0038';

SELECT COUNT(*) AS worker_ledger_ct FROM worker_ledger_entries
WHERE company_id = 'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'
  AND worker_id = 'd208e44f-bf49-4288-8c01-d486ecb6da5c'
  AND (payment_reference = 'PAY-0038' OR document_no = 'PAY-0038');
```

---

## Test 2 — Branch-aware ledger RPC (runtime) — PASS

- **Customer ID:** `45e60a2e-9b1a-478c-8f75-cf09d29a0eba`
- **Verified:** `company_scope row_ct = 2`, `branch_scope row_ct = 2` (branch-aware function; data happens to be all in selected branch).

```sql
SELECT count(*) FROM get_customer_ledger_sales(
  'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid,
  '45e60a2e-9b1a-478c-8f75-cf09d29a0eba'::uuid,
  NULL, NULL, NULL
);
-- bind branch uuid for second call
SELECT count(*) FROM get_customer_ledger_sales(
  'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid,
  '45e60a2e-9b1a-478c-8f75-cf09d29a0eba'::uuid,
  NULL, NULL, :branch_id::uuid
);
```

---

## Test 3 — Executive dashboard AR/AP (runtime) — PASS

```sql
SELECT get_financial_dashboard_metrics(
  'db1302ec-a8d7-4cff-81ad-3c8d7cb55509'::uuid,
  :branch_id::uuid
);
```

**Recorded JSON fields:** `ar_ap_basis = get_contact_balances_summary`, `ar_ap_scope = branch`, `receivables = 18000.03`, `payables = 464302.00` (match branch-scoped `get_contact_balances_summary` sums).