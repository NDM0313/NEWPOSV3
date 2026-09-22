# Phase 2.10A — SQL artifacts

**Status:** Created only — **NOT RUN**

| File | Purpose |
|------|---------|
| `scripts/single-core-ledger/phase-210-preflight-loader.sql` | Read-only flag inventory before enable |
| `scripts/single-core-ledger/phase-210-enable-loader-ledger-v2.sql` | Enable `unified_ledger_loader_ledger_v2` for DIN CHINA only |
| `scripts/single-core-ledger/phase-210-postverify-loader.sql` | Post-enable verify + cross-company guard |
| `scripts/single-core-ledger/phase-210-rollback-loader-ledger-v2.sql` | L1 rollback — loader flag OFF |

## DIN CHINA company id

`30bd8592-3384-4f34-899a-f3907e336485`

## Enable SQL scope

The enable script inserts/updates **only**:

- `feature_key = unified_ledger_loader_ledger_v2`
- `company_id = 30bd8592-3384-4f34-899a-f3907e336485`

No other flags or companies are modified.

## Execution order (ops — after approval)

1. Preflight
2. Deploy code containing Phase 2.10A implementation
3. Baseline browser QA (`baseline` mode)
4. Export spot-check sign-off
5. Enable loader SQL (preview/staging first)
6. Post-verify
7. Candidate browser QA
8. Production enable (separate ops approval)

## Rollback

Run `phase-210-rollback-loader-ledger-v2.sql` for instant L1 return to legacy main loader.
