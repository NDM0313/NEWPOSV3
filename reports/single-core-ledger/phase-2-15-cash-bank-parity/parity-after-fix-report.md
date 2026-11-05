# Phase 2.15 — Parity after fix

## Wide range (2000-01-01 → 2026-06-26)

| Metric | Legacy golden | Parity engine (post-fix) | Raw RPC (pre-fix) |
|--------|---------------|--------------------------|-------------------|
| Cash In | 136,158,012 | **136,158,012** | 135,736,321 |
| Cash Out | 67,042,426 | **67,042,426** | 126,854,008 |
| Closing | 69,115,586 | **69,115,586** | 8,882,313 |
| Difference | 0 | **0** | FAIL |

## Fix summary

- Replaced raw `mapUnifiedToRoznamchaResult` in unified main loader with `assembleRoznamchaUnifiedParityMain`.
- Parity engine = `getRoznamcha` (payment + journal-only + dedupe).
- Added `roznamchaUnifiedParityFilter.ts` for diagnostic classification of raw RPC rows.

## Migration

None.
