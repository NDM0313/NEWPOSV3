# Financial Truth Basis — Official Contract

**Code:** [`src/app/lib/financialTruthBasis.ts`](../../src/app/lib/financialTruthBasis.ts)  
**Related:** [`BALANCE_SOURCE_POLICY.md`](./BALANCE_SOURCE_POLICY.md), [`DASHBOARD_BASIS_MAP.md`](./DASHBOARD_BASIS_MAP.md)

---

## Three bases (never mix silently)

| Basis | Code | Use for |
|-------|------|---------|
| **Official Posted GL** | `official_gl` | Trial Balance, Balance Sheet, P&L, Chart of Accounts, Cash Flow GL (official) |
| **Effective operational** | `effective_party` | Customer/supplier ledger effective view, AR/AP effective variance cards |
| **Audit full history** | `audit_full` | Party statement audit mode, Day Book audit, full trace |

---

## 1. Official Posted GL basis

**Source:** `journal_entries` + `journal_entry_lines` (void excluded).

**Includes:**

- All valid posted journal entries
- `gl_correction` additive corrections (e.g. JV-000203)
- `correction_reversal` rows (e.g. JE-0168) — they are posted GL

**Excludes:**

- Voided journal entries only

**Does NOT apply:**

- Customer effective hiding rules
- Cancelled sale / void payment filters

**Must balance:** Trial Balance total Debit = total Credit (when data is double-entry correct). Balance Sheet ties to Trial Balance account balances.

---

## 2. Effective operational party basis

**Source:** Same journal lines as GL, filtered by [`shouldIncludePartyEffectiveRow`](../../src/app/lib/reportVisibilityContract.ts).

**May hide:**

- Cancelled sale / sale_reversal / sale_return trails
- Voided payment trails
- Orphan `-orphan-ar` gl_correction chains tied to cancelled sales
- `correction_reversal` audit-only rows (in party effective UI)

**Label required:** *"Effective operational basis — hides cancelled/voided/audit-only rows"*

**Not for:** Trial Balance, Balance Sheet, P&L totals.

---

## 3. Audit basis

**Source:** Full posted history (same lines as official GL for party accounts).

**Shows:** Original rows, cancellations, reversals, gl_correction, void trails.

**Label required:** *"Audit basis — full history"*

**Not for:** Business closing balance or TB/BS/P&L.

---

## Screen map

| Screen | Basis |
|--------|-------|
| Trial Balance | `official_gl` |
| Balance Sheet | `official_gl` |
| Profit & Loss | `official_gl` |
| Chart of Accounts balances | `official_gl` |
| Cash Flow — GL summary (official) | `official_gl` |
| Cash Flow — operational / normal | `effective_party` |
| Account Statements — Effective | `effective_party` |
| Account Statements — Audit | `audit_full` |
| AR/AP Reconciliation — GL cards | `official_gl` |
| AR/AP Reconciliation — effective variance | `effective_party` |
| Financial Truth Center — Tie-out | All three side-by-side |

---

## Difference reason categories

When two surfaces differ, classify using `DifferenceReasonCategory` in code:

- `valid_timing_classification` — expected scope/timing
- `cancelled_audit_hidden_from_effective` — effective hides audit/cancelled chains
- `missing_contact_mapping` — unmapped JE / Fix Link needed
- `missing_branch` — branch filter mismatch
- `payment_source_mismatch` — payment vs JE metadata
- `gl_correction_needed` — orphan AR/AP requiring additive correction
- `source_document_required` — non-final or missing posting
- `unknown` — escalate to Financial Truth Center

---

*This document supersedes ad-hoc per-screen basis wording. Update code contract first, then this doc.*
