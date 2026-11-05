# Static kill-switch validation

## LOCAL STATIC DRILL — NOT PRODUCTION OPERATOR DRILL

No production kill switch was toggled.

## What was verified (local/unit)

Via `npm run test:unified-ledger` resolver + engine tests:

- Kill ON → resolver effective source `legacy` / killed mode
- Kill OFF + flags ON → unified main path
- Feature flags / engine gates still tested
- `assertUnifiedMainLoaderSource('legacy')` throws `R8_R2_LEGACY_MAIN_RETIRED_MESSAGE`
- Deleted wrappers not referenced by approved pages
- Shadow compare + BS/P&L fallback remain available

## Explicitly not done

- Production kill switch toggle
- Production operator drill attestation
- Production frontend deploy of rehearsal code
