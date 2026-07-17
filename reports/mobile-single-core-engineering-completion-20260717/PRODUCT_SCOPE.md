# PRODUCT_SCOPE.md

## In scope

- Capacitor + Vite + React mobile ERP (`erp-mobile-app/`)
- Package `com.dincouture.erp`
- Unified / Single Core accounting report loaders and fail-loud contracts
- Client cache invalidation after accounting writes
- Role-based client report gates
- Debug APK + release-build configuration (unsigned when keystore absent)
- Documentation and PR preparation against `main`

## Out of scope

- FX / multi-currency app
- `POS/` Expo shell
- `erp-flutter-app/`, `erp-flutter-v2/`
- Database migrations
- Production GL mutation / financial repair
- 4100→4000 reclassification
- R8-R2 deletion
- Temporary production QA users
- Play Store upload / production signing without separate approval
- Merge to `main` without `APPROVE_MOBILE_SINGLE_CORE_FINALIZATION_MERGE`

## Production web reference

`https://erp.dincouture.pk` — contract parity target for mobile reports; not modified in this phase.
