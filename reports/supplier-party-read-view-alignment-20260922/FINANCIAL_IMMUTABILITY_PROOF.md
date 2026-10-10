# Financial Immutability Proof

**Policy:** This phase permits application code + additive read-only RPC only. No JE / account / contact mutations.

## Pre-alignment DIN COLLECTION fingerprint (live RO)

| Metric | Value |
|--------|------:|
| journal_entries | 5,062 |
| journal_entry_lines | 10,124 |
| SUM(debit) | 875,502,523.57 |
| SUM(credit) | 875,502,523.57 |
| GL difference | 0.00 |
| accounts | 247 |
| contacts | 138 |

## Mutations performed

| Kind | Count |
|------|------:|
| journal_entries UPDATE/INSERT/DELETE | **0** |
| journal_entry_lines UPDATE/INSERT/DELETE | **0** |
| accounts financial mutation | **0** |
| contacts role/data mutation | **0** |
| migrations applied | **0** |
| balancing / repair JEs | **0** |

## Accounting truth surfaces (unchanged by design)

- Trial Balance — account_id GL
- Balance Sheet — account_id GL
- Raw Account Ledger — account_id GL
- Official AP control (2000 subtree)

Post-deploy: re-run the same fingerprint; must match exactly.
