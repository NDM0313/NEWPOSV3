## Objective
Finalize Mobile Single Core reporting: Worker Ledger basis, Cash Flow fail-loud, write invalidation, role tests, and evidence.

## Starting point
- Branch: `feature/mobile-single-core-party-roznamcha`
- HEAD: `3c9dc4071082716ecd0fc397788567bff5913c38`

## Implementation summary
- Worker Ledger uses Single Core `loadPartyLedger(worker)` when flags ON; else GL 2010/1180; operational only as labelled fallback.
- Cash Flow no longer silently falls through to Roznamcha; amber banner + Retry when unified fails.
- `invalidateAfterAccountingWrite` enhanced + called from sale/purchase/expense/JE/payment success paths.
- Account Ledger silent catch now surfaces an error notice.

## Tests / build
- Mobile: 89 pass
- Unified-ledger: 350 pass
- Typecheck: PASS
- Production mobile build: PASS
- Debug APK produced

## Parity / device
- Live parity: NOT_RUN_CREDENTIAL_GATED
- Emulator/device: NOT_RUN_DEVICE_GATED

## Safety
- Production DB/GL mutations: NONE
- Migrations: NONE
- 4100 reclass: NONE
- R8-R2 deletion: NONE

## Rollback
Disable unified flags / kill switch; revert feature commits. No SQL rollback.

## Remaining gates
Live parity, device QA, merge approval, signed release/store.
