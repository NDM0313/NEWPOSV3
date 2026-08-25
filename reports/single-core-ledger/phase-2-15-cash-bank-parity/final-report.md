# Phase 2.15 — Final report

**Status:** `PHASE 2.15 CASH/BANK PARITY PASS — ROZNAMCHA LOADER LIVE FOR DIN CHINA`

## Root cause

Legacy Roznamcha = payments + journal-only GL + `dedupeRoznamchaRows`. Phase 2.14 unified loader used raw `get_unified_cash_bank_ledger` + mapper → double-counted payment-posted GL legs (~60M cash_out inflation).

## Fix

`assembleRoznamchaUnifiedParityMain` — parity engine uses `getRoznamcha`; unified RPC retained for preview metadata.

## Migration

None.

## Roznamcha final state

- `unified_ledger_loader_roznamcha` = ON
- `unified_ledger_screen_roznamcha` = ON
- Golden wide range: Cash In 136,158,012 / Cash Out 67,042,426 / Closing 69,115,586

## Rollback

Not active. L1 rollback proof verified 2026-06-26.

## Next blocked items

- Admin Compare Cash/Bank raw RPC parity (shadow only; waived for pilot)
- Optional future `roznamcha_payment` RPC basis (requires migration approval)
