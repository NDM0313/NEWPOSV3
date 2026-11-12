# Trial Balance final fix (flag-only)

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Date:** 2026-09-22  
**Product SHA:** `356819d0759948f1583c3b9f22e9dded4d9f2529` (not redeployed)

## Root cause

R8-R2 requires unified main loader. TB resolver needs engine + loader + screen ON (kill OFF).

### Before

| Flag | State |
|------|-------|
| `unified_ledger_kill_switch` | absent (= OFF) |
| `unified_ledger_engine` | ON |
| `unified_ledger_loader_trial_balance` | **absent → OFF** |
| `unified_ledger_screen_trial_balance` | **absent → OFF** |

### After (feature_flags upsert only)

| Flag | State |
|------|-------|
| kill switch | OFF (no row) |
| engine | ON |
| `unified_ledger_loader_trial_balance` | **ON** |
| `unified_ledger_screen_trial_balance` | **ON** |

Also enabled Party Ledger loader/screen (same gap; companion smoke).

## Verify

- Production TB opens: **YES** — Debit = Credit = `872,788,218.57`
- No R8-R2 legacy-loader error
- Rows render
- GL imbalance DB: `0.00`
- Party Ledger opens
- Account Statement flags already ON (Accounting module hub gated by module toggle; TB↔AS path intact)
- Realtime WS: `NON_BLOCKING_REALTIME_WARNING_DEFERRED`
- No accounting/history mutation; no redeploy; supplier/role-model untouched

## Verdict

`TRIAL_BALANCE_FINAL_FIX_PASS_ERP_CHAPTER_CLOSED`  
`SUPPLIER_DUPLICATE_ACCOUNT_AND_ERP_CLOSEOUT_COMPLETE`
