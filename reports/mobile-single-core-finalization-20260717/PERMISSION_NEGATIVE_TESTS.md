# PERMISSION_NEGATIVE_TESTS.md

## Automated (client)
`finalization.test.ts` + existing `reportsHubCatalog` / `permissions` helpers:

- Salesman/limited (`fullAccounting: false`): no Trial Balance, Account Ledger, Cash Flow, Purchase report, Supplier ledger
- Full-accounting required tiles blocked without permission
- Easy hub hides advanced statements even for admin
- Company-wide branch `null` via Single Core scope (`all` → null)

## Server / RLS
`NOT_RUN_CREDENTIAL_GATED` — no live authenticated negative session in this phase.
