# ARIF Pilot Runtime Fix — 2026-09-22

**Verdict: `ARIF_PILOT_RUNTIME_FIX_READY_FOR_OWNER_REVIEW`**

## 1. Git / runtime mismatch diagnosis

| Check | Result |
|-------|--------|
| Local branch | `feat/arif-supplier-business-statement-pilot` |
| Local HEAD (pre-fix tip) | `1cdc19c3` |
| `origin/main` | `554a12ca` |
| localhost:5173 process | Vite (`node …/vite/bin/vite.js`) PID owning port 5173 |
| Vite cwd | `C:\Users\ndm31\dev\Corusr\NEW POSV3` (same repo; **not** a branch mismatch) |
| Pilot product commit already in tree | `62d76a52` |

**Not A (wrong branch).** Local checkout and Vite were already on the feature branch.

**Not B alone (stale cache).** Vite was serving live `/src/…` modules from the feature tree.

## 2. Exact root cause

**E — UI path not using the modified `AccountLedgerReportPage`.**

Accounting → Account Statements defaults to:

- `accountStatementsViewMode = 'standard'`
- renders [`LedgerStatementCenterV2Page`](../../src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx)

The ARIF pilot from `62d76a52` was wired only into:

- **Advanced** → [`AccountLedgerReportPage`](../../src/app/components/reports/AccountLedgerReportPage.tsx)

Owner screenshot on `/?view=accounting` used **Standard (PDF / share)** → Official Supplier V2 loader → **0 rows** for ARIF → no Business History toggle.

Issue class: **wrong component path (Standard V2 vs Advanced legacy)**.

## 3. Production deployed SHA (pre-fix)

| Item | Value |
|------|--------|
| VPS branch | `feat/arif-supplier-business-statement-pilot` |
| VPS HEAD | `62d76a528180e92b13ea3503cba608fe662f208e` |
| Bundle proof | Web chunk `AccountLedgerReportPage-*.js` contained ARIF contact UUID `21e1ac76…` (Advanced path only). Standard V2 had no pilot UI. |

## 4. Files changed (this fix)

- `src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx` — wire existing `loadArifBusinessHistory` + toggle
- `src/app/features/ledger-statement-center-v2/LedgerTable.tsx` — Source Account column
- `src/app/features/ledger-statement-center-v2/types.ts` — optional `sourceAccountCode`
- `src/app/lib/arifSupplierBusinessStatementPilot.ts` — `mapArifBusinessHistoryToV2Rows`

No migrations. No JE/account/contact writes. Advanced path left intact.

## 5. ARIF runtime IDs (live RO)

| Field | Value |
|-------|--------|
| Company | `e08a04af-22a8-4869-9b4d-da31fce13158` (DIN COLLECTION) |
| Contact | `21e1ac76-b911-44a1-87dd-6283969efa4c` |
| Code | `SUP-ZHD-0017` |
| Name | `ARIF LHR` |
| Type | `supplier` |
| Legacy account | `210017` / `719c0bab-9484-4cff-84b8-8a0f0ffecffd` |

Gate: `isArifSupplierBusinessPilot(companyId, entityId)` — entityId in V2 **is** the contact UUID.

## 6–11. Counts / balances (live RO)

| Metric | Value |
|--------|--------|
| Raw `210017` lines | **24** |
| Liability net (credit − debit) | **39,937.00** |
| Official AP (AP-SUP / 2000 subtree) | **0** |
| Business History period source | same 24 attributed lines on `210017` (full history when range covers all) |
| Source Account | **210017** |
| Duplicate `journal_line_id` | prevented in wrapper before totals |
| Opening / period / closing | `opening + periodCredit − periodDebit = closing` (unit-tested) |

Sign note: Account Ledger Dr−Cr may show **−39,937**; supplier liability Business History shows **+39,937**. Expected.

## 12. Before / after UI

| Before | After |
|--------|--------|
| Standard Supplier → ARIF: empty Official AP, no toggle | Standard → ARIF: **Business History \| Official AP** (default Business History) |
| Source Account absent | Source Account column shows **210017** |
| Advanced still had pilot | Advanced unchanged (still works) |

## 13. Non-ARIF regression

Pilot gated on DIN COLLECTION company + ARIF contact UUID only. Other suppliers keep Official AP V2 path.

## 14. DB mutation proof

SELECT-only diagnostics. JEs / journal `account_id`s / accounts / contacts unmodified = **0**.

## 15. Issue classification

**wrong component** (Standard V2 active; pilot only on Advanced).  
Not branch mismatch, not stale Vite cwd, not gate UUID mismatch, not runtime exception on the Advanced path.

## Owner re-check

1. Hard refresh `localhost:5173` or production ERP  
2. Accounting → Account Statements → leave **Standard** selected  
3. Type = Supplier → Party = **ARIF LHR**  
4. Expect Business History rows + Source Account `210017`  
5. Toggle Official AP → empty  
6. Another supplier → no ARIF toggle
