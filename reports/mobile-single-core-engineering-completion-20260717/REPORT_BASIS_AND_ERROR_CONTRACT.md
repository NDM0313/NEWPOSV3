# REPORT_BASIS_AND_ERROR_CONTRACT.md

| Screen | Loader | Basis | Error policy | Empty | Fallback | Cache |
|--------|--------|-------|--------------|-------|----------|-------|
| Customer Ledger | singleCore `loadPartyLedger` | official_gl | Fail-loud | Period empty card | Labelled amber | reportRefreshEpoch |
| Supplier Ledger | same | official_gl | Fail-loud | Period empty card | Labelled amber | epoch |
| Worker Ledger | singleCore → GL → operational | GL; operational labelled non-official | Fail-loud / labelled fallback | Period empty | Explicit non-GL banner | epoch |
| Account Ledger | unified RPC → legacy lines | official_gl | Fail-loud notice on unified fail | Period empty | **Labelled** legacy after unified error | epoch + visibility |
| Ledger V2 | unified or flagged legacy | official_gl | Fail-loud (no silent legacy on unified fail) | Empty rows | Flags-off legacy only | epoch |
| Roznamcha | singleCore `loadRoznamcha` | official_gl | Fail-loud | ReportShell empty | Labelled legacy | epoch |
| Cash Flow | `loadMobileCashFlow` | official_gl | Fail-loud; no silent fallback | Empty shell | Labelled + retry | epoch |
| Trial Balance | unified only | official_gl | Fail-loud | Empty rows OK | None | epoch |
| Balance Sheet | unified TB mapper | official_gl | Fail-loud | Explicit empty | None | epoch |
| Profit & Loss | unified TB mapper | official_gl | Fail-loud | Empty shell | None | epoch |
| Aging | operational `due_amount` queries | **operational** (labelled) | **Fail-loud** (query error surfaced) | No outstanding | None | epoch |
| Dashboard totals | `get_dashboard_metrics` | Mixed | Residual silent enrich | Zeros possible | DOCUMENTED_RESIDUAL | invalidation bus |
| Contact-list balances | GL map → operational → opening | GL primary | Residual silent downgrade | 0 / opening | DOCUMENTED_RESIDUAL | listCache |

## Rules confirmed

- RPC failure must not become zero → Aging + Account Ledger fixed this phase; Cash Flow / Party / TB already compliant.
- Permission denial must not become empty success → Aging now errors; role client gates remain.
- Operational ≠ official GL → Aging / Worker / contact residuals labelled or documented.
- Cash Flow no silent fallback → prior fix retained.
- Roznamcha no client double-count on unified path → trusts RPC (residual documented).
- No sign inversion / forced parity.
