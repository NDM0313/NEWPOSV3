# Single Core Ledger Migration: Master Execution Plan v3

**Date:** June 20, 2026  
**Project:** DIN Collection ERP  
**Purpose:** Convert the fragmented ledger/reporting logic into one journal-line based core while preserving three controlled reporting lenses: official accounting, clean operational view, and full audit history.

---

## 0. Executive Summary

The migration goal is **not** to reduce the ERP to one ledger view. The goal is to make the ERP use **one trusted data source** for ledger/reporting calculations:

- `journal_entries`
- `journal_entry_lines`

From this single source, the system must expose three controlled lenses:

1. **`official_gl`** — strict posted accounting truth.
2. **`effective_party`** — clean operational party view for users.
3. **`audit_full_history`** — complete correction/reversal/void history for tracing and audit.

This migration must be executed as a **read-engine migration first**. Do not mutate live business data, delete old engines, or switch production reports until the new engine is proven through row-by-row tie-out.

---

## 1. Architectural Goal: One Core, Three Lenses

### 1.1 Single Data Core

The single source of truth must be:

```text
journal_entries + journal_entry_lines
```

No report should silently merge raw documents, synthetic rows, payment tables, sale tables, rental tables, or custom operational mutations into balances unless the row is clearly marked as an **open-item/non-GL panel**.

### 1.2 Three Reporting Lenses

| Lens | Purpose | Expected Behavior |
|---|---|---|
| `official_gl` | Accounting truth | Includes all posted, non-void GL rows according to official accounting rules. |
| `effective_party` | Normal business/user view | Hides reversed chains, correction/void trails, canceled documents, and JE-0168 type correction noise. |
| `audit_full_history` | Compliance and trace view | Shows every row, including corrections, reversals, void chains, and historical actions. |

### 1.3 Important Rule

**Single core does not mean single view.**  
It means:

```text
One journal-line engine + multiple explicit basis filters
```

---

## 2. Current Engine Inventory

The agent must first map the existing engines before changing behavior.

| Current Engine / Service | Used In | Problem / Risk | Target Replacement |
|---|---|---|---|
| `getCustomerLedger` | Account Statements | Injects synthetic/unposted rows and mixes GL with document state. | Unified RPC + explicit `basis` filter. |
| `customerLedgerApi` | LedgerHub / operational customer ledger | Reads raw documents and may bypass correct GL attribution. | Unified journal-line RPC; open items shown separately. |
| `effectivePartyLedgerService` | Effective party ledger view | Separate logic for collapsed/corrected mutations. | Unified RPC with `effective_party` basis filter. |
| Report-specific GL queries | Trial Balance, Statement, Roznamcha, Cash Flow, AR/AP | Can drift screen-by-screen and cause mismatches. | Shared unified service layer calling the same RPC family. |

### 2.1 Required Mapping Report

Before code replacement, deliver a markdown mapping report:

```text
reports/SINGLE_CORE_LEDGER_ENGINE_MAPPING_REPORT.md
```

It must include:

- All files/services/functions currently producing ledger balances.
- Which screens use each engine.
- Which exports/prints/WhatsApp share flows use each engine.
- Current basis behavior: official, effective, audit, or mixed.
- Replacement plan for each file/function.

---

## 3. Hard Guardrails for Agent

These rules are mandatory.

1. Do **not** commit directly to `main`.
2. Do **not** deploy to VPS or production without explicit approval.
3. Do **not** mutate live data during Phase 0.
4. Do **not** delete old ledger files in early phases.
5. Feature flag must default to **OFF**.
6. Old engine must remain available for instant rollback.
7. Every balance difference must be explainable row-by-row.
8. Normal views must hide correction/reversal chains.
9. Audit views must show full correction/reversal history.
10. No cross-company or cross-branch data leakage is allowed.
11. No service-role key or unsafe privileged access may be used in frontend code.
12. All database changes must be reversible or non-destructive in early phases.
13. Open-item panels must be separate from posted GL balances.
14. Do not rename or reclass accounts in live data without a separate approved apply step.
15. Do not auto-post unposted documents without separate approval.

---

## 4. Safety and Rollback Protocol

### 4.1 Code Isolation

Create a dedicated branch:

```bash
git checkout -b feature/single-core-ledger
```

No direct changes to `main`.

### 4.2 Database Safety

Phase 0 must run on:

1. staging database, or
2. fresh SQL backup/clone, or
3. read-only diagnostics on live database.

### 4.3 Feature Flag

Use a runtime or DB-driven feature flag, for example:

```text
isUnifiedLedgerEnabled = false
```

Do not rely only on build-time `process.env` flags. Frontend build-time flags are not enough for safe live rollback.

### 4.4 Instant Rollback Rule

If the unified engine shows wrong balances:

1. turn `isUnifiedLedgerEnabled` OFF,
2. old engine resumes instantly,
3. no data rollback should be required because early phases must not mutate live data.

---

## 5. Security, RLS, and Access Rules

The unified RPC must respect existing security rules.

### 5.1 Required Security Filters

Every unified ledger RPC must enforce:

- `company_id`
- accessible branches
- current user role/permissions
- RLS-compatible access
- branch scope
- date scope
- party/account scope

### 5.2 No Cross-Branch Leakage

When a user filters Branch A, rows from Branch B must not appear unless the selected mode explicitly allows all-branch reporting and the user has permission.

### 5.3 No Cross-Company Leakage

Every query must be scoped by `company_id`.

---

## 6. Performance and Database Indexes

Because the new engine relies on journal lines, the following indexes must be verified or created.

### 6.1 Required Index Checks

Verify indexes on:

- `journal_entry_lines.account_id`
- `journal_entry_lines.contact_id` or resolver-related fields
- `journal_entry_lines.journal_entry_id`
- `journal_entries.entry_date`
- `journal_entries.company_id`
- `journal_entries.branch_id`
- `journal_entries.is_void`
- `journal_entries.reference_type`
- `journal_entries.reference_id`
- `journal_entries.status` if used
- `journal_entries.created_at` if used for audit sorting

### 6.2 Performance Acceptance

For normal date-range reports:

- party ledger should load without timeout,
- cash/bank ledger should load without timeout,
- trial balance should load without timeout,
- tie-out report should clearly show query duration.

Do not optimize by bypassing the unified basis contract.

---

## 7. Phase 0: Read-Only Diagnostics First

Phase 0 is a prerequisite, but it must first be **read-only**.

### 7.1 Phase 0 Must Not Apply Changes

The first deliverable must only produce diagnostics:

| Diagnostic | Output |
|---|---|
| Payment Contact Backfill Check | Count/list of sale-linked payments missing `contact_id`. |
| AR Control Reclass Check | Count/list of entries directly hitting `1100` control account incorrectly. |
| Unposted Final Documents Check | Count/list of Final sales/purchases/rentals not posted to GL. |
| Opening Balance Check | List of opening balance entries and whether they are duplicated/missing. |
| Reversal/Correction Chain Check | List of JE-0168 type correction/reversal chains. |

### 7.2 Required Diagnostic Report

Create:

```text
reports/SINGLE_CORE_PHASE_0_DIAGNOSTIC_REPORT.md
```

The report must include:

- issue counts,
- sample affected rows,
- proposed safe fix,
- whether the fix is read-only, apply-safe, or requires manual approval,
- no automatic data mutation.

### 7.3 Apply Step Requires Separate Approval

Do not backfill, reclass, post, cancel, reverse, or delete anything during Phase 0 unless the user explicitly approves an apply step.

---

## 8. Phase 1: Unified SQL Engine

Create new RPCs alongside existing RPCs.

### 8.1 Do Not Modify Old RPCs Yet

Do not alter or delete old RPCs such as:

```text
get_customer_ar_gl_ledger_for_contact
```

### 8.2 Required New RPC Family

Minimum target RPCs:

```text
get_unified_party_ledger
get_unified_account_ledger
get_unified_trial_balance
get_unified_cash_bank_ledger
```

If a single RPC is used internally, it must still expose clear public contracts for party, account, trial balance, and cash/bank reporting.

### 8.3 Basis Parameter

Every ledger RPC must accept a basis parameter:

```text
basis = official_gl | effective_party | audit_full_history
```

### 8.4 Resolver Usage

Use the existing master resolver where appropriate:

```text
_gl_resolve_party_id_for_journal_entry
```

The resolver must not corrupt Walk-in Customer (`CUS-0000`) attribution or general AR.

### 8.5 Opening Balance Handling

Opening balance rows must be handled explicitly.

Rules:

- Include valid opening JEs according to basis/date/account/party/branch.
- Do not duplicate opening balances as synthetic rows.
- Opening rows must be traceable to journal entries.
- Date-range opening balance calculation must not double-count prior-period rows.

---

## 9. Phase 2: TypeScript Service Layer

Create a new service layer:

```text
src/app/services/unifiedLedgerService.ts
```

### 9.1 Service Responsibilities

The service must:

- read the feature flag,
- call unified RPCs when enabled,
- fallback to old engine when disabled,
- normalize output shape,
- return basis metadata,
- expose query duration and debug/tie-out metadata for developer mode.

### 9.2 Suggested Interface

```ts
export type LedgerBasis = 'official_gl' | 'effective_party' | 'audit_full_history';

export async function getUnifiedPartyLedger(params: {
  companyId: string;
  branchId?: string | null;
  contactId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis: LedgerBasis;
}) {
  // 1. Read runtime feature flag.
  // 2. If disabled, use old engine fallback.
  // 3. If enabled, call unified RPC.
  // 4. Return rows + balance + metadata.
}
```

### 9.3 No Frontend Security Bypass

Do not use service-role keys or privileged database access in frontend code.

---

## 10. Phase 3: Tie-Out UI and Shadow Testing

### 10.1 Tie-Out UI

Create a developer-only tie-out page or tab.

Suggested route:

```text
/financial-trace/unified-ledger-tieout
```

### 10.2 Tie-Out Must Show

| Field | Description |
|---|---|
| Old Balance | Balance from current engine. |
| New Balance | Balance from unified engine. |
| Difference | Old minus New. |
| Missing Rows | Rows in old but not in new. |
| Extra Rows | Rows in new but not in old. |
| Basis Used | `official_gl`, `effective_party`, or `audit_full_history`. |
| Date Range | Selected period. |
| Branch | Selected branch/all branches. |
| Query Duration | Performance indicator. |
| Resolver Notes | How party/account was resolved. |

### 10.3 No User-Facing Switch Yet

Only admin/developer/auditor roles should see the shadow testing toggle.

---

## 11. Golden Contact and Report Test Set

The unified engine cannot pass until it matches the golden set.

### 11.1 Pilot Contacts / Entities

Test at minimum:

- JALIL
- Inayat
- Saqib
- Walk-in Customer `CUS-0000`
- one supplier
- one worker
- one cash account
- one bank account
- one branch-specific party
- one party with payments and reversals
- one party with opening balance

### 11.2 Required Screens / Reports

Test old vs new on:

- Account Statement
- LedgerHub
- Party Statement
- AR/AP Center
- Trial Balance
- Balance Sheet if affected
- P&L if affected
- Roznamcha
- Day Book
- Cash Flow
- Cash/Bank Ledger
- Print view
- CSV/Excel export
- WhatsApp share rows/statements

---

## 12. Acceptance Criteria

The unified engine passes only if all criteria are met.

1. **Trial Balance parity:** total debit equals total credit.
2. **Statement parity:** old vs new final balances match exactly for all golden contacts.
3. **Correction hiding:** normal/effective views hide JE-0168 type reversal/correction rows.
4. **Audit visibility:** audit mode shows JE-0168 type rows and full correction chains.
5. **Walk-in parsing:** `CUS-0000` transactions resolve correctly without corrupting general AR.
6. **Branch/date consistency:** branch and date filters return consistent results.
7. **Opening balance correctness:** opening rows are included once, not duplicated.
8. **Cash/bank correctness:** cash and bank running balances match posted GL.
9. **Export parity:** print, CSV/Excel, and WhatsApp share match screen balances.
10. **Rollback tested:** feature flag OFF returns to old engine instantly.
11. **Security tested:** no cross-company or cross-branch leakage.
12. **Performance acceptable:** common reports load without timeout.

---

## 13. Phase 4: Controlled Enablement

### 13.1 Developer/Admin Only

After tie-out success, enable unified engine only for developer/admin testing.

### 13.2 Limited Production Shadow Mode

Run in production shadow mode with:

- feature flag OFF for normal users,
- developer comparison enabled,
- no deletion of old engine,
- daily comparison reports.

### 13.3 2–4 Week Rule

Run old and new systems in parallel for **2 to 4 weeks**.

Only proceed if:

- no unexplained differences remain,
- audit reports match,
- exports match,
- rollback is tested,
- user approves the switch.

---

## 14. Phase 5: Deprecation and Cleanup

Do not delete old files immediately.

### 14.1 First Step: Deprecate

Move old files to a deprecated area or mark clearly:

```text
_deprecated/ledger_engines/
```

Examples:

- `customerLedgerApi.ts`
- old synthetic merge functions
- old effective party standalone logic

### 14.2 Final Delete Condition

Delete old engines only when:

- unified engine has run stable for 2–4 weeks,
- all reports match,
- audit mode is verified,
- rollback is no longer needed,
- branch/main backup tag exists,
- user gives final approval.

---

## 15. Suggested Commit Plan

Use small commits.

| Commit | Scope |
|---|---|
| Commit 1 | Mapping report + diagnostics only. |
| Commit 2 | Non-destructive indexes / SQL RPC draft. |
| Commit 3 | TypeScript unified service with flag default OFF. |
| Commit 4 | Developer tie-out UI. |
| Commit 5 | Golden contact regression tests. |
| Commit 6 | Shadow mode wiring for selected reports. |
| Commit 7 | Deprecation only after approval. |

---

## 16. Ready-to-Paste Cursor Agent Prompt

```text
You are working on the DIN Collection ERP ledger migration.

Goal:
Convert the fragmented ledger/report engines into one journal-line based core while preserving three lenses:
1. official_gl
2. effective_party
3. audit_full_history

Important:
Single core means one data source: journal_entries + journal_entry_lines.
It does NOT mean one reporting view.

Hard guardrails:
- Do not commit to main.
- Do not deploy to VPS or production.
- Do not mutate live data in Phase 0.
- Do not delete old ledger services.
- Feature flag must default OFF.
- Old engine must remain available for instant rollback.
- Every balance difference must be explainable row-by-row.
- Normal view must hide reversal/correction chains such as JE-0168.
- Audit view must show full correction/reversal history.
- Respect company_id, branch permissions, RLS, and user role permissions.
- Do not use service_role in frontend code.

First deliver only Phase 0 and Phase 1 preparation:

1. Create a current engine mapping report:
   reports/SINGLE_CORE_LEDGER_ENGINE_MAPPING_REPORT.md

   It must list all ledger/report balance engines, services, RPCs, screens, exports, print flows, and WhatsApp share flows that currently produce or consume ledger balances.

2. Create a read-only diagnostic report:
   reports/SINGLE_CORE_PHASE_0_DIAGNOSTIC_REPORT.md

   It must check:
   - sale-linked payments missing contact_id
   - entries directly hitting AR control 1100 incorrectly
   - unposted final documents
   - opening balance entries and duplication risk
   - JE-0168 type reversal/correction chains

   Do not apply any fix yet. Only report findings.

3. Draft the unified SQL RPC design without replacing old RPCs:
   - get_unified_party_ledger
   - get_unified_account_ledger
   - get_unified_trial_balance
   - get_unified_cash_bank_ledger

   Each must accept basis:
   official_gl | effective_party | audit_full_history

4. Create or draft a developer-only tie-out UI plan/page that compares:
   - old balance
   - new balance
   - difference
   - missing rows
   - extra rows
   - basis used
   - date range
   - branch
   - query duration

5. Use golden test set:
   - JALIL
   - Inayat
   - Saqib
   - Walk-in CUS-0000
   - one supplier
   - one worker
   - cash account
   - bank account
   - party with opening balance
   - party with reversal/correction rows

Do not switch production reports to unified engine yet.
Do not delete old services.
Do not apply data cleanup.
Return a final report with files changed, tests run, risks found, and next recommended step.
```

---

## 17. Final Rule

The migration is successful only when the ERP can prove this formula:

```text
Same journal-line core
+ explicit basis filter
+ row-by-row tie-out
+ instant rollback
= safe single core ledger
```
