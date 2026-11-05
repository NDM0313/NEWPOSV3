# Phase 2.15 — Preflight production state

**Captured:** 2026-06-26 (post Phase 2.14 rollback)

## DIN CHINA flags (`30bd8592-3384-4f34-899a-f3907e336485`)

| Flag | State | Required |
|------|-------|----------|
| `unified_ledger_loader_roznamcha` | **OFF** | OFF before parity fix |
| `unified_ledger_screen_roznamcha` | **OFF** | OFF before parity fix |
| `unified_ledger_loader_ledger_v2` | ON | ON |
| `unified_ledger_loader_account_statement` | ON | ON |
| `unified_ledger_loader_trial_balance` | ON | ON |
| `unified_ledger_loader_party_ledger` | ON | ON |

## Golden gates (must remain stable)

| Gate | Value |
|------|-------|
| MR JALIL (LV2 / AS / Party Ledger) | PKR 216,300 |
| Trial Balance debit = credit | PKR 407,957,271.02 |
| Admin Compare Pilot Batch | 9/9 |

## Roznamcha legacy golden (wide range 2000-01-01 → 2026-06-26)

| Metric | Value |
|--------|-------|
| Cash In | 136,158,012 |
| Cash Out | 67,042,426 |
| Closing | 69,115,586 |

## Phase 2.14 failure (baseline)

Unified candidate (raw RPC + mapper) mismatched legacy golden — rolled back L1+L2.
