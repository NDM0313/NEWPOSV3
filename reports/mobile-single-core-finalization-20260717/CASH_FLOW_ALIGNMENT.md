# CASH_FLOW_ALIGNMENT.md

## Previous
`loadMobileCashFlow` silent `catch { /* fall through to legacy roznamcha */ }` with `error: null`.

## Corrected
- Unified success → unified data + `fallbackReason: null`
- Unified fail → explicit legacy with `fallbackReason` set; CashFlowReport amber banner + Retry
- Both fail → hard error (`loaderSource: unavailable`)
- Flags off → legacy expected (`fallbackReason: null`)

Cash Flow may share cash/bank RPC with Roznamcha when unified, but UI/report purpose remains distinct.
