# Orphan cleanup verification (read-only)

**Verified:** 2026-07-01T15:45:27Z via `diagnose-orphan-receipts-readonly.mjs`

| Ref | Normal list | voided_at | JE is_void | JE lines | Allocations |
|-----|-------------|-----------|------------|----------|-------------|
| RCV-0081 | hidden (void) | set | true | 0 | 0 |
| RCV-0082 | hidden (void) | set | true | 0 | 0 |
| JE-0209 | hidden | — | true | 0 | — |
| JE-0210 | hidden | — | true | 0 | — |

- Audit history preserved (void_reason recorded)
- No new debit/credit lines created
- Trial Balance unchanged (still balanced 22,390,400)
- Roznamcha Cash In reduced by 90,000 PKR (orphan payment rows no longer counted — correct; goldens pre-cleanup included phantom cash)

Raw: `orphan-cleanup-verification.json`
