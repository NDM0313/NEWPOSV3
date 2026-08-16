# Baseline monitoring

| Item | Value |
|------|-------|
| Command | `npm run monitor:three-company-unified-ledger` |
| Artifact | `three-company-monitoring-2026-07-01T15-03-08-265Z` |
| Overall | **PASS** |

## Company results

| Company | Result |
|---------|--------|
| DIN CHINA | PASS — Admin Compare **9/9** |
| DIN BRIDAL | PASS |
| DIN COUTURE | PASS |

## Guards

| Check | Result |
|-------|--------|
| migrations_run | false |
| gl_mutations | false |
| Flags | 8 loaders ON per company; 0 on other companies |
| Read-only loader guard | PASS |
