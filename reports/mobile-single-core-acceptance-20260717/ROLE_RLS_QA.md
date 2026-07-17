# ROLE_RLS_QA.md

## Client / hub gates
Automated `finalization.test.ts` + `reportsHubCatalog` / permissions helpers: **PASS**
(Salesman/limited cannot see Trial Balance, Account Ledger, Cash Flow, supplier tiles without permission.)

## Live server / RLS
| Scenario | UI gate | Client scope | RPC/RLS | Visible result | Status |
|----------|---------|--------------|---------|----------------|--------|
| Salesman unrestricted TB | client PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Salesman Account Ledger | client PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Salesman supplier/purchase | client PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Salesman account transfer | client PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Direct-route bypass | client catalog PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Other-company reject | — | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Unauthorized branch | — | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Company-wide null for unauthorized | — | — | — | — | `NOT_RUN_CREDENTIAL_GATED` |
| Denial ≠ zero | code policy PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` (live) |
| Logout clears rows | code PASS | — | — | — | `NOT_RUN_CREDENTIAL_GATED` (live) |

Only admin QA password profile available in this session; no salesman/branch-restricted live session executed.
