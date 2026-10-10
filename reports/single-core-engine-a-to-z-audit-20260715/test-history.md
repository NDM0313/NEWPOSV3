# Test and Validation History

**Audit date:** 2026-07-15

## Suite inventory

| Suite | Command | Latest count (this audit) | Latest PASS | Latest FAIL | Flakes | Relevance | Evidence |
|-------|---------|---------------------------|-------------|-------------|--------|-----------|----------|
| Unified ledger | `npm run test:unified-ledger` | **339/339** | 2026-07-15 | none this session | none observed | CORE | `validation-unified-tests.txt` |
| Unit | `npm run test:unit` | **183/183** | 2026-07-15 | none | none | CORE-adjacent | `validation-unit-tests.txt` |
| Build | `npm run build` | PASS | 2026-07-15 | none | n/a | CORE | `validation-build.txt` |
| Three-company monitoring | `npm run monitor:three-company-unified-ledger` | — | 2026-07-12 (docs) | 2026-07-15 **credential gate** | historical browser flakes hardened | CORE | `validation-monitoring.txt` |
| Loader guard | part of monitoring / `threeCompanyLoaderGuard` | unit-tested | embedded in 339 suite | — | — | CORE | tests in suite |
| Admin Compare | browser/monitoring | 9/9 din-china (R8 day) | 2026-07-10 | historical FAIL → golden refresh | — | CORE | R8 reports |
| AR/AP parity | `run-ar-ap-unified-party-parity-readonly.mjs` | N/A on Windows bash | SSH SQL 2026-07-15 | bridal effective_party | — | EXTENSION | `validation-arap-parity.txt` |
| Salesman QA | device | PASS | 2026-07-11 | device-blocked interim `511044a1` | device | OUT OF SCOPE | salesman reports |
| Kill-switch drill | ops | claimed PASS | 2026-07-12 (doc) | evidence folder missing | — | R8-R2 | **MISSING EVIDENCE** |
| Calendar stability | days 7–15 packs | PASS | 2026-07-08 window | — | — | CLOSED | calendar report folders |
| Golden fixture unit tests | inside unified suite | included in 339 | 2026-07-15 | — | — | CORE | suite |

## Count reconciliation

| Claimed | Where | Meaning |
|---------|-------|---------|
| **336/336** | Office pull 2026-07-11; R8-R1 watch | Unified suite before AR/AP + later tests |
| **339/339** | Closeout 2026-07-12; **confirmed 2026-07-15** | +3 tests (incl. `arApPartyGlParity.test.ts` / Phase 2b related growth) |
| **182/182** | Office pull 2026-07-11 | Unit suite earlier |
| **183/183** | **Confirmed 2026-07-15** on current `package.json` | +1 unit vs office pull |
| **187** (R8 watch narrative) | Post-R8 watch text | Intermediate unit count |
| **189/189** | Closeout 2026-07-12 | **Not reproduced** — current script = 183. Treat 189 as session-specific list or stale claim; do not inflate |

## Production dependency

Monitoring and Admin Compare depend on live QA credentials + production data goldens. Local unified/unit/build are credential-free and green on 2026-07-15.
