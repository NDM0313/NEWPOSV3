# TEST_RESULTS.md

Generated: 2026-07-17

| Suite | Command | Result |
|-------|---------|--------|
| Mobile unit | `cd erp-mobile-app && npm run test:run` | **89 PASS / 0 FAIL** |
| Unified ledger | `npm run test:unified-ledger` | **350 PASS / 0 FAIL** |
| Typecheck | `cd erp-mobile-app && npm run typecheck` | **PASS** |
| Web production spotcheck | `node scripts/single-core-ledger/run-r8-r2-six-screen-spotcheck.mjs` | **OVERALL PASS** (6/6 unified) |
| Live RPC parity | `node scripts/mobile-single-core-acceptance-parity-readonly.mjs` | **0 FAIL** across 3 companies |
| Live admin RLS | `node scripts/mobile-single-core-acceptance-rls-readonly.mjs` | Cross-company **PASS**; salesman **NOT_RUN** |
| Mobile web QA | `node scripts/mobile-single-core-mobile-web-qa.mjs` | **9/9 PASS** (same bundle as APK) |
