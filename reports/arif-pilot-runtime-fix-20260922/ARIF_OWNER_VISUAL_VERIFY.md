# ARIF Standard Statement — Owner Visual Verify

**Verdict: `ARIF_STANDARD_STATEMENT_OWNER_VERIFY_PASS`**

**Date:** 2026-09-22  
**Verify method:** Live browser on `localhost:5173` (DIN COLLECTION) + production RO SQL + deployed bundle markers.

## Runtime SHAs

| Surface | SHA |
|---------|-----|
| Local checkout tip | `a701f3d2` (contains product fix `788b50a8`) |
| Production VPS `/root/NEWPOSV3` | `788b50a88371bfd4bb339c01857714452e0dd9c4` |
| Prod frontend | `erp-frontend` healthy; `/` + `/health` HTTP 200 |
| Bundle | `AccountingDashboard-*.js` contains `Business History` + ARIF UUID |

## Active UI path (confirmed)

Accounting → **Account Statements** → **Standard (PDF / share)** → Statement Type **Supplier** → Party **ARIF LHR**

Component: [`LedgerStatementCenterV2Page`](../../src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx)  
(not Advanced `AccountLedgerReportPage`)

## Visibility (browser)

| Control | Result |
|---------|--------|
| Business History toggle | YES |
| Official AP toggle | YES |
| Business History default | YES |
| Source Account column | YES — values **210017** on period rows |
| Banner | `ARIF LHR — Business History` |

## Counts / balances

### Deterministic full attributed history (RO SQL, no date cut)

| Metric | Value |
|--------|--------|
| Business History attributed lines | **24** (all on `210017`) |
| Distinct `journal_line_id` | **24** |
| Official AP (`AP-SUP%`) | **0** |
| Liability closing (Cr − Dr) | **39,937.00** |
| Raw Account `210017` Dr − Cr | **−39,937.00** |
| Raw Account `210017` Cr − Dr | **+39,937.00** |

Sign difference Account (Dr−Cr) vs Business History (Cr−Dr) is expected and reconciles exactly.

### UI session period (header From/To = 2025-10-01 → 2026-09-22)

| Metric | Value |
|--------|--------|
| Opening rows (`date < 2025-10-01`) | 21 |
| Opening (liability) | **371,937.00** |
| Period rows | **3** |
| Period Debit | **332,000.00** |
| Period Credit | **0.00** |
| Closing | **39,937.00** |
| Identity | `371937 + 0 − 332000 = 39937` **PASS** |

Full-history identity (start before first JE): `0 + 1,663,937 − 1,624,000 = 39,937` **PASS**.

## Official AP tab (browser)

Switched to **Official AP**: empty / “No party-linked transactions…” — **0 rows**. Does **not** pull `210017`.

## Raw Account Ledger

RO: account `719c0bab-9484-4cff-84b8-8a0f0ffecffd` / code `210017` still **24** lines, active, linked to ARIF. No account mutation.

## Non-ARIF regression (browser)

Selected **IBRAHIM BNRS** on same Standard Supplier screen:

- **No** Business History / Official AP toggle
- Normal Supplier Ledger path only

## DB mutation proof

This verify session was SELECT-only + UI read. No migrations applied.

| Object | Modified |
|--------|----------|
| journal_entries | **0** |
| journal_entry_lines / account_id | **0** |
| accounts / contacts / payments / purchases | **0** |
| TB / BS code | **NO** |
| Graphify | **NO** |
| main merge | **NO** |

## Screenshot references

Browser automation on `http://localhost:5173/?view=accounting` (DIN COLLECTION session). Key observed UI strings:

- `ARIF LHR — Business History`
- `Opening 371,937 · period Dr 332,000 / Cr 0 · closing 39,937 · 3 period line(s)`
- Table header includes **Source Account** with **210017**
- Official AP empty copy for ARIF
