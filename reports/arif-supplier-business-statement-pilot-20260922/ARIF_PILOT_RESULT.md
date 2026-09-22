# ARIF Supplier Business Statement Pilot — Result

**Verdict: `ARIF_SUPPLIER_BUSINESS_STATEMENT_PILOT_READY_FOR_OWNER_REVIEW`**

**Date:** 2026-09-22  
**Branch:** `feat/arif-supplier-business-statement-pilot`  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`

## Scope

Web-only Account Statements pilot for **ARIF LHR** (`SUP-ZHD-0017` / `21e1ac76-b911-44a1-87dd-6283969efa4c`).

| Surface | Behavior |
|---------|----------|
| Supplier → ARIF → **Business History** (default) | Attributed linked-leaf history (legacy `210017`) + Source Account column |
| Supplier → ARIF → **Official AP** | Unchanged 2000-subtree supplier loader (empty today) |
| CoA Account Ledger `210017` | Unchanged |
| Other suppliers | Unchanged |

## Opening balance safety

`loadPartyAttributedGlLedger` drops `entry_date < startDate` when `startDate` is passed.

Wrapper [`loadArifBusinessHistory`](../../src/app/lib/arifSupplierBusinessStatementPilot.ts):

1. Calls attributed history with **`startDate: null`**, `endDate` = selected end
2. Dedupes by `journal_line_id`
3. Splits `openingRows` (`date < start`) vs `periodRows` (`start…end`)
4. Liability totals: `opening = Σ(credit − debit)`; `closing = opening + periodCredit − periodDebit`

Unit test proves: `opening + periodCredit − periodDebit = closing`.

## Live RO parity (prod, SELECT-only)

| Check | Result |
|-------|--------|
| Linked ARIF leaves | `210017` only — **24** lines |
| Liability net (credit − debit) | **39,937.00** |
| AP-SUP lines for ARIF | **0** |
| JE / account / contact mutations | **0** |
| TB / BS code paths | **unchanged** |
| Graphify | **not run / not committed** |

## Files shipped

- `src/app/lib/arifSupplierBusinessStatementPilot.ts`
- `src/app/lib/arifSupplierBusinessStatementPilot.node.test.ts`
- `src/app/components/reports/AccountLedgerReportPage.tsx` (ARIF-gated UI only)

## Owner visual check

1. Account Statements → Statement Type **Supplier** → Party **ARIF LHR**
2. Confirm banner **ARIF LHR — Business History** and ~24 rows with Source Account `210017`
3. Toggle **Official AP** → empty (current)
4. Open CoA account `210017` → same historical rows as before
5. Pick another supplier → no Business History toggle

## Locked non-goals

No AP-SUP create, no 210017 deactivate, no JE rewrite, no system-wide 85-supplier rollout, no migrations.
