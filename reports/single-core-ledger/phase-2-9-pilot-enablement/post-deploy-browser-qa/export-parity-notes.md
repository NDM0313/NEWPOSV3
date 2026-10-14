# Phase 2.9A-4 — Export parity notes

**Status:** NOT LIVE-VERIFIED (no authenticated browser session in agent run)

## Expected behavior (Phase 2.8 static + unit evidence)

| Export | Toggle OFF | Toggle ON (preview panel) |
|--------|------------|---------------------------|
| PDF / Excel main table | Legacy `getLedgerStatementV2` totals | Same — preview does not replace export source |
| Preview JSON | N/A | `phase2-compare-ledger-v2-*.json`, non-official label |

## Operator spot-check (pending)

1. Ledger V2 → MR JALIL → note closing with toggle **OFF**
2. Export PDF or Excel
3. Confirm closing matches toggle-OFF baseline
4. Toggle ON → preview panel only; re-export main PDF — totals unchanged
