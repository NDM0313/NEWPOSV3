# Pre-swap baseline — BS/P&L controlled loader swap

**Date:** 2026-07-01  
**Status:** PASS

## Monitoring

```
npm run monitor:three-company-unified-ledger
```

| Company | Result |
|---------|--------|
| din-china | PASS |
| din-bridal | PASS |
| din-couture | PASS |

Report: `three-company-monitoring-2026-07-01T07-58-12-791Z`  
`migrations_run`: false · `gl_mutations`: false

## Tests / build

| Command | Result |
|---------|--------|
| `npm run test:unified-ledger` | 303/303 PASS |
| `npm run test:unit` | 122/122 PASS |
| `npm run build` | PASS |
