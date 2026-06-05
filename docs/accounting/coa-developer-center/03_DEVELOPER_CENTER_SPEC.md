# Accounting Developer Center — Specification

**Phase:** A (spec only — no UI implementation)  
**Date:** 2026-06-03  
**Status:** Draft for review before Phase B implementation

---

## 1. Overview

A unified **admin/developer-only** workspace to diagnose Chart of Accounts health, trace transactions across GL and operational layers, explain report inclusion/exclusion (Roznamcha, Account Statement, Day Book), and queue safe repairs with preview and confirmation.

**Replaces (eventually):** scattered tabs in Developer Integrity Lab, Truth Lab, and ad-hoc SQL — without deleting existing tools until Phase 11 cleanup.

---

## 2. Navigation and route

| Item | Value |
|------|-------|
| **Primary route** | `/admin/accounting-developer-center` |
| **Settings path** | Settings → Accounting & Finance → **Developer Center** |
| **Secondary entry** | Accounting → link from Integrity Lab / AR/AP Center |
| **Component (future)** | `src/app/components/admin/AccountingDeveloperCenterPage.tsx` |
| **Service facade (future)** | `src/app/services/accountingDeveloperCenterService.ts` |
| **Access helper (future)** | `src/app/lib/accountingDeveloperCenterAccess.ts` |

### Permission model (confirmed)

| Role | View tabs | Safe COA edit | Queue dry-run | Apply repair |
|------|-----------|---------------|---------------|--------------|
| `admin` | Yes | Yes (display fields) | Yes | No |
| `super admin` / `superadmin` | Yes | Yes | Yes | Yes (with confirm phrase) |
| `developer` | Yes | Yes | Yes | Yes (with confirm phrase) |
| `accounting_auditor` | Yes | No | Yes | No |
| Standard staff | No | No | No | No |

**Implementation note:** Extend [`developerAccountingAccess.ts`](src/app/lib/developerAccountingAccess.ts) to include admin/super-admin/accounting_auditor per [`DEVELOPER_INTEGRITY_LAB.md`](docs/accounting/DEVELOPER_INTEGRITY_LAB.md). Remove reliance on `VITE_ACCOUNTING_DIAGNOSTICS=1` in production builds.

**Env flag:** Staging-only `VITE_ACCOUNTING_DIAGNOSTICS=1` may remain for local dev; never required in production.

---

## 3. Shell layout

```
┌─────────────────────────────────────────────────────────────┐
│ Accounting Developer Center                    [Company ▼]  │
├─────────────────────────────────────────────────────────────┤
│ [COA Health] [Transaction Trace] [Journal Integrity] ...    │
├─────────────────────────────────────────────────────────────┤
│ Tab content (filters + results table + detail drawer)       │
└─────────────────────────────────────────────────────────────┘
```

- Company scope from `SupabaseContext.companyId`
- Optional branch filter on trace/report tabs
- All filter toolbars: `no-print` class for future export
- Detail drawer: links to operational document, JE explorer, related payments

---

## 4. Tab specifications

### Tab 1 — Chart of Accounts Health

**Purpose:** Single view for COA structural integrity and per-account usage before any edit.

**Inputs:**
- Company id (implicit)
- Optional: account code search, "show only issues" toggle

**Output columns (issues table):**

| Column | Description |
|--------|-------------|
| `severity` | error / warning / info |
| `check_id` | e.g. `DUPLICATE_CODE`, `INACTIVE_USED`, `MISSING_PARENT` |
| `account_code` | |
| `account_name` | |
| `detail` | Human-readable issue |
| `line_count` | Journal lines (if applicable) |
| `action` | View account · Open trace |

**Account usage drill-down (selected account):**

| Column | Description |
|--------|-------------|
| `metric` | line_count, total_debit, total_credit, first_used, last_used |
| `modules` | sales, purchase, rental, expense, … inferred from JE reference_types |
| `can_edit_name` | yes/no |
| `can_archive` | yes/no |
| `cannot_touch` | yes if control/system |

**Safe actions:**
- Edit display name, description, `is_active`, reporting group (only when check allows)
- Run read-only hierarchy audit
- Export issues CSV/JSON

**Dangerous actions (Phase E only):**
- `ensureDefaultAccounts` seed repair
- Archive inactive unused account

**RPC / queries needed:**
- Client: `accountHierarchyAuditService`, `fullAccountingAuditService`
- New (additive): `rpc_coa_health_snapshot(p_company_id uuid)` — aggregates duplicate codes, inactive-used, OB gaps, orphan parents

**Audit log:** COA field edits → `activity_logs` or new `developer_center_audit` table

**Reuses:** Dev Lab tab H · COA audit (read parts only in Phase B)

---

### Tab 2 — Transaction Trace

**Purpose:** Unified lookup: enter any identifier → see full chain from operational doc to GL to report visibility.

**Inputs (any one):**
- Reference number: `RCV-*`, `PAY-*`, `EXP-*`, `JV-*`, `JE-*`, `FT-*`, `REN-*`, `SL-*`, `PUR-*`
- Journal entry number: `JE-0012`
- UUID: payment id, rental id, sale id, contact id
- Amount + date (fuzzy match)

**Output sections (12-panel layout):**

| # | Section | Content |
|---|---------|---------|
| 1 | Operational document | sale / purchase / rental / expense row |
| 2 | Payment row | `payments` |
| 3 | Rental payment | `rental_payments` if any |
| 4 | Journal entry | header fields |
| 5 | Journal lines | debit/credit per account |
| 6 | Accounts used | code, name, type |
| 7 | Branch | document → payment → JE chain |
| 8 | Roznamcha status | included / excluded + reason |
| 9 | Account Statement status | included / excluded + reason |
| 10 | Day Book status | visible / void-excluded-from-balance |
| 11 | Dashboard impact | which KPIs affected |
| 12 | Diagnosis | plain-language "possible reason if missing" |

**Safe actions:**
- Copy trace JSON
- Open in Journal Explorer (deep link)
- Open source document in ERP

**Dangerous actions:** None in Phase B

**RPC needed:**
- New: `rpc_trace_accounting_reference(p_company_id uuid, p_query text)` — resolves ref → ids → joins

**Reuses:** `developerAccountingDiagnosticsService` trace, `truthLabTraceWorkbenchService`, `accountingDisplayRefResolver`

**Example queries this tab must answer:**
- Why HQ-RCV-0006 / JE-0012 / Rs 10,000 not in Roznamcha?
- Why customer advance not on statement?
- Why Day Book shows unbalanced JE?
- Why opening balance on wrong date?

---

### Tab 3 — Journal Integrity

**Purpose:** Company-wide JE health — duplicates, orphans, unbalanced vouchers, rule violations.

**Inputs:**
- Date range (optional)
- Severity filter
- Rule filter (RULE_01–RULE_15)

**Output columns:**

| Column | Description |
|--------|-------------|
| `severity` | error / warning / info |
| `rule_id` | RULE_xx |
| `entry_no` | JE-00xx |
| `entry_date` | |
| `reference_type` | |
| `ui_ref` | SL-/PAY-/human ref |
| `detail` | Rule message |
| `debit_total` | |
| `credit_total` | |
| `imbalance` | |

**Safe actions:**
- Export scan JSON
- Open in Transaction Trace
- Add to Repair Queue (detect only)

**Dangerous actions (Phase E, not B/C):**
- Void duplicate JE
- Sync `accounts.balance` from journals

**RPC:** Existing `rpc_integrity_count_*`, client `runIntegrityJournalScan`

**Audit:** Queue insert to `integrity_lab_issues`

**Reuses:** Dev Lab tabs B, D, E; `accountingIntegrityService`

---

### Tab 4 — Payment / Reference Trace

**Purpose:** Deep payment chain — allocation, edit history, PF-14 mutation chain, ref numbering.

**Inputs:**
- Payment ref (RCV/PAY/EXP/WPY)
- Payment UUID
- Document ref + amount

**Output columns:**

| Column | Description |
|--------|-------------|
| `step` | Chain order |
| `entity` | payment / JE / sale / allocation |
| `ref` | |
| `amount` | |
| `account` | liquidity / party |
| `created_at` | |
| `voided` | |
| `notes` | edit chain / fingerprint |

**Safe actions:** Copy chain, open Transaction Trace

**Dangerous actions:** Phase E — relink `payment_account_id`, backfill `contact_id`

**RPC:** Extend trace RPC with payment ancestry

**Reuses:** `ArApTruthLabPage`, `arApTruthLabService`, `docs/accounting/PF14_TRANSACTION_CHANGE_TRACE_AND_REPAIRS.md`

---

### Tab 5 — Roznamcha Trace

**Purpose:** Diagnostic view — why each candidate row is included or excluded from cash book for a date range.

**Inputs:**
- Date range
- Branch (optional)
- Ref / amount filter (optional)

**Output columns:**

| Column | Description |
|--------|-------------|
| `candidate_id` | pay:uuid / rp:uuid / je:uuid |
| `source` | payments / rental_payments / journal / orphan |
| `ref` | resolved canonical ref |
| `date` | |
| `direction` | IN / OUT |
| `amount` | |
| `liquidity_account` | |
| `included` | yes / no |
| `exclusion_reason` | date_filter / branch_filter / voided / no_liquidity / document_je_skip / dedupe_lost / entity_dedupe |
| `dedupe_key` | entity + movement keys |
| `source_priority` | 3 / 2 / 1 |
| `winner_ref` | if dedupe lost |

**Safe actions:** Export trace, open Transaction Trace

**Dangerous actions:** None (diagnostic only in Phase C)

**RPC:** `rpc_roznamcha_trace_candidates(p_company_id, p_from, p_to, p_branch_id)` — server-side mirror of `roznamchaDedupe` logic

**Reuses:** `roznamchaService.ts`, `roznamchaDedupe.ts`, `ROZNAMCHA_DATA_SOURCES_AND_DUPLICATES.md`

---

### Tab 6 — Account Statement Trace

**Purpose:** Explain party statement rows — synthetic vs journal, inclusion rules.

**Inputs:**
- Party (customer / supplier / worker)
- Date range
- Optional: ref filter

**Output columns:**

| Column | Description |
|--------|-------------|
| `row_source` | journal / synthetic_payment / synthetic_sale / synthetic_rental |
| `date` | |
| `ref` | RCV / SL / REN |
| `description` | |
| `debit` | |
| `credit` | |
| `running_balance` | |
| `included` | yes / no |
| `exclusion_reason` | non_final_sale / voided / glJournalOnly / duplicate_merged / contact_mismatch |
| `je_id` | if journal-sourced |

**Safe actions:** Compare with on-screen Account Statement, export

**Dangerous actions:** None

**RPC:** `rpc_statement_trace_party(p_company_id, p_contact_id, p_from, p_to)`

**Reuses:** `getCustomerLedger` logic in `accountingService.ts`, `LedgerDebugTestPage` patterns

---

### Tab 7 — Day Book Diagnostics

**Purpose:** Period balance check and unbalanced voucher list with drill-down.

**Inputs:**
- Date range
- Branch (optional)

**Output:**
- Total debit, total credit, difference
- `is_balanced` flag (tolerance 0.02)
- Table of unbalanced vouchers: `entry_no`, debit sum, credit sum, difference
- Voided voucher count (included in list, excluded from balance)

**Output columns (unbalanced list):**

| Column | Description |
|--------|-------------|
| `entry_no` | |
| `entry_date` | |
| `reference_type` | |
| `debit_sum` | |
| `credit_sum` | |
| `difference` | |
| `line_count` | |
| `action` | Open Transaction Trace |

**Safe actions:** Export, open trace

**Dangerous actions:** **None** — show repair recommendation text only, never auto-fix

**Implementation:** Extract balance logic from `DayBookReport.tsx` into shared helper

**Reuses:** `DAY_BOOK_DATA_SOURCES_AND_UNBALANCED.md`

---

### Tab 8 — Opening Balance Tools

**Purpose:** Detect gaps between operational opening amounts and GL opening JEs.

**Inputs:**
- Entity type: contact AR/AP/worker, GL account, inventory
- Optional: contact/account picker

**Output columns:**

| Column | Description |
|--------|-------------|
| `entity_type` | |
| `entity_name` | |
| `operational_opening` | from contact/account/stock |
| `je_entry_no` | opening JE if exists |
| `je_amount` | |
| `gap` | difference |
| `status` | synced / missing_je / amount_mismatch / orphan_je |

**Safe actions:**
- Preview sync plan (before/after JSON)
- Add to Repair Queue

**Dangerous actions (Phase E):**
- Run `openingBalanceJournalService` sync — requires confirm + backup note

**RPC:** `rpc_opening_balance_ob_je_gap(p_company_id uuid)`

**Reuses:** Dev Lab tab I · OB sync (preview only first)

---

### Tab 9 — Repair Queue

**Purpose:** All write repairs flow through queue — never instant.

**Queue states:**
```
detected → preview_ready → confirmed → applied → failed → rolled_back
```

**Output columns:**

| Column | Description |
|--------|-------------|
| `id` | |
| `repair_type` | e.g. `ob_sync`, `payment_contact_backfill`, `rental_je_relink` |
| `status` | |
| `severity` | |
| `detected_at` | |
| `summary` | |
| `before_preview` | JSON (truncated in table) |
| `after_preview` | JSON |
| `confirmed_by` | |
| `applied_at` | |

**Repair types (Phase D dry-run, Phase E apply):**

| Repair | Allowed? | Notes |
|--------|----------|-------|
| Sync account opening balance JE | Yes | Per entity, transactional |
| Fix missing `payment_account_id` from JE liquidity line | Yes | Metadata only |
| Relink `rental_payment` → `journal_entry` | Yes | Link only |
| Sync `branch_id` document → payment → JE | Yes | Metadata only |
| Sync sequence effective max | Yes | Via numberingMaintenanceService |
| Mark duplicate bad ref for manual repair | Yes | Flag only, no rewrite |
| Archive unused account | Yes | Zero lines only |
| Blind mass reference rewrite | **No** | |
| Delete journal entries | **No** | |
| Change debit/credit amounts | **No** | Separate approval track |

**Dangerous actions:** All apply actions require:
1. Backup reminder checkbox
2. Typed confirmation phrase (e.g. `APPLY-REPAIR-{id}`)
3. Transaction + audit row

**Tables:** Extend `integrity_lab_issues` or new `developer_repair_plans`

**Audit tables:** `party_repair_audit`, `je_payment_linkage_repair_audit`, new unified view

---

### Tab 10 — Audit Log

**Purpose:** Read-only history of developer center actions and legacy repair audits.

**Inputs:**
- Date range
- Action type filter
- User filter

**Output columns:**

| Column | Description |
|--------|-------------|
| `timestamp` | |
| `actor` | user email |
| `action` | repair_applied / coa_edit / queue_confirm |
| `entity_type` | |
| `entity_id` | |
| `before` | JSON snapshot |
| `after` | JSON snapshot |
| `rollback_note` | if applicable |

**RPC / view:** `v_developer_center_audit_log` (union of existing audit tables)

**Safe actions:** Export CSV

**Dangerous actions:** None

---

## 5. New migrations (Phase B+ — additive only)

| Migration | Purpose | Phase |
|-----------|---------|-------|
| `rpc_trace_accounting_reference` | Unified read-only trace | B |
| `rpc_coa_health_snapshot` | COA health aggregate | B |
| `rpc_roznamcha_trace_candidates` | Roznamcha inclusion analysis | C |
| `rpc_statement_trace_party` | Statement row provenance | C |
| `rpc_opening_balance_ob_je_gap` | OB gap detection | C |
| `developer_repair_plans` table | Queue with before/after JSON | D |
| `v_developer_center_audit_log` view | Unified audit read | D |

**None of these change GL posting rules or `record_payment_with_accounting`.**

---

## 6. Implementation phases (after doc approval)

| Phase | Scope | Deliverables |
|-------|-------|--------------|
| **A** | Docs only | This folder (4 files) |
| **B** | Read-only shell | Route, access, tabs 1–2, COA safe edit |
| **C** | Report trace | Tabs 5–7 |
| **D** | Repair queue | Tab 9 dry-run only |
| **E** | Safe repairs | One repair type at a time + tab 8 apply |
| **11** | Legacy cleanup | `99_LEGACY_TOOLS_CLEANUP_PLAN.md` |
| **12** | Tests | COA health, trace resolver, roznamcha/statement inclusion |

---

## 7. Tests (Phase 12)

| Test file | Coverage |
|-----------|----------|
| `coaHealthChecks.test.ts` | duplicate code, inactive-used, missing parent |
| `transactionTraceResolver.test.ts` | RCV/PAY/JE ref resolution |
| `roznamchaTrace.test.ts` | exclusion reasons (extend `roznamchaDedupe.test.ts`) |
| `statementTrace.test.ts` | synthetic vs journal classification |

Run: `npm run test:unit` + `npm run build` after each phase.

---

## 8. Recommendations

### Build first (highest ROI)

1. **Transaction Trace (Tab 2)** — daily pain: "why is this payment missing from Roznamcha/statement?"
2. **Roznamcha Trace (Tab 5)** — pure logic exists in `roznamchaDedupe.ts`; expose inclusion reasons
3. **COA Health (Tab 1)** — consolidates scattered audit services before any account edit

### Keep as-is (link, don't merge)

- **AR/AP Reconciliation Center** — business users need it outside developer gate
- **Numbering Maintenance** — already has analyze/fix; link from Developer Center
- **System Health** — infra diagnostics orthogonal to GL
- **Permission Inspector** — RBAC debugging

### Archive later (Phase 11 — not now)

- `AccountingTestBenchPage` → redirect to Developer Center
- `AccountingTestPage` (creates real JEs)
- Layout/certification test pages (19 under `src/app/components/test/`)
- `accounting/` root prototype folder (8 files)
- Dev Lab tabs M/N/O write actions → Repair Queue

### Do not touch in v1

- `record_payment_with_accounting` RPC body
- GL posting triggers (finalize, pay, void)
- Void/delete/reversal semantics
- RCV/PAY/EXP/JV/FT numbering **generation** rules
- `ERP_DATA_REPAIR_SCRIPT.sql`, company reset RPCs
- `supabase-extract` historical repair migrations

### Highest-risk accounting areas

| Area | Risk | Developer Center response |
|------|------|---------------------------|
| PF-14 payment edit chains | HIGH | Payment/Reference Trace + queue |
| Duplicate canonical sale/purchase JEs | HIGH | Journal Integrity RULE_09 |
| payments vs JE `reference_type` split | HIGH | Transaction Trace education + Roznamcha Trace |
| Opening balance JE sync | HIGH | OB Tools preview-first |
| Party subledger vs 1100/2000 control | HIGH | Statement Trace + AR/AP Center link |
| `accounts.balance` vs journals | MEDIUM | COA Health + Journal Integrity |
| Roznamcha dedupe false negatives | MEDIUM | Roznamcha Trace per-row reason |
| Dashboard `get_contact_balances_summary` missing | LOW (ops) | Document in flow map; apply migration |

---

## 9. References

- [`00_EXISTING_TOOLS_AUDIT.md`](00_EXISTING_TOOLS_AUDIT.md)
- [`01_CHART_OF_ACCOUNTS_AUDIT.md`](01_CHART_OF_ACCOUNTS_AUDIT.md)
- [`02_ACCOUNTING_FLOW_MAP.md`](02_ACCOUNTING_FLOW_MAP.md)
- [`docs/accounting/DEVELOPER_INTEGRITY_LAB.md`](../DEVELOPER_INTEGRITY_LAB.md)
- Plan: `coa_developer_center_eb2d4e9e.plan.md`
