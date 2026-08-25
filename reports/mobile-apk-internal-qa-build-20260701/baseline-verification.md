# Baseline verification — MOBILE APK INTERNAL QA BUILD

**Generated:** 2026-07-01  
**Status:** PASS

## Monitoring (`npm run monitor:three-company-unified-ledger`)

| Check | Result |
|-------|--------|
| din-china | PASS |
| din-bridal | PASS |
| din-couture | PASS |
| Admin Compare (din-china) | 9/9 PASS |
| migrations_run | false |
| gl_mutations | false |

Evidence: `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-01T10-24-06-616Z.json`

## Tests

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | 328/328 PASS |
| `npm run test:unit` | 122/122 PASS |
| `npm run build` | PASS |
