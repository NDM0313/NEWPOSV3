# Stability window start

| Item | Value |
|------|-------|
| Status | **STARTED** |
| Start date | **2026-07-01** |
| Target duration | **2–4 weeks** |
| Earliest R8 review | 2026-07-15 |
| Latest R8 review | 2026-07-29 |

## Baseline scope (all live / complete)

- Three-company unified loaders (8 loaders × 3 companies)
- Cash Flow main loader live
- BS/P&L loader swap complete
- DIN BRIDAL monitoring golden refresh complete

## Day-0 verification

| Check | Result |
|-------|--------|
| Monitoring | **PASS** (all 3 companies) |
| Admin Compare | **9/9** (DIN CHINA) |
| Tests / build | **PASS** |
| Production mutation | **none** |

## Blocked during window

- R8 legacy engine retirement
- 4th company rollout (finance sign-off required)
- DB migrations / GL mutations / flag changes without approval

## Separate tracks (not part of stability gate)

- Mobile release — `BLOCKED_PARTIAL_DEVICE_QA_PENDING_ROLES`
- Supplier Party Discount PKR 1 — not approved

## Daily cadence (recommended)

Run `npm run monitor:three-company-unified-ledger` daily. Investigate any FAIL before continuing the window. Refresh monitoring goldens only after operator-approved audit if live business activity causes drift.
