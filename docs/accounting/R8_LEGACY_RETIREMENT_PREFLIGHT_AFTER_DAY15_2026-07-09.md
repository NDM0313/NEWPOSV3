# R8 Legacy Retirement Preflight — After Day 15

**Date:** 2026-07-09  
**Project:** OLD ERP / DIN Collection ERP Single Core Engine  
**R8 run:** **NOT RUN**

## Calendar evidence summary

| Window | Status | Primary docs |
|--------|--------|----------------|
| Days 7–12 | COMPLETE / PASS (6/6) | [`OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_7_12_SUMMARY_2026-07-07.md) |
| Days 13–15 | COMPLETE / PASS | [`OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md`](OFFICIAL_CALENDAR_STABILITY_DAYS_13_15_R8_READINESS_2026-07-07.md) |
| Day 15 commit | `4665334b` | R8 readiness pack |
| Execution plan | Updated | [`FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md`](FULL_SINGLE_CORE_LEDGER_REMAINING_EXECUTION_PLAN_2026-06-30.md) § 2026-07-15 |

## Deploy status

- Ledger V2 frontend deployed at `3e9c8b19` via `deploy/vps-build-erp-only.sh`
- Production https://erp.dincouture.pk — HTTP 200; `erp-frontend` healthy
- Evidence: [`2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md`](../2026-07-09-LEDGER-V2-PRODUCTION-DEPLOY.md)

## Remaining blockers (pre-R8)

1. **Written approval** — phrase `NADEEM_APPROVES_R8_LEGACY_RETIREMENT` **not present** in operator request
2. **Salesman mobile QA** — **PASS** (login) — `SALESMAN_QA_PASS_PLAY_STORE_STILL_NOT_RELEASED` — evidence `reports/mobile-salesman-qa-readiness-after-day15-20260709/`
3. **Supplier Party Discount PKR 1 QA** — NOT APPROVED
4. **Play Store** — NOT RELEASED (separate track)
5. **Fresh monitoring at execution time** — re-run `npm run monitor:three-company-unified-ledger` with per-company credentials before R8 day (latest archived PASS: 2026-07-08)

## Rollback requirements (before any future R8 execution)

1. Document current feature-flag snapshot per company (`unified_ledger_engine`, loader flags, screen flags, kill switch)
2. Confirm VPS `erp-frontend` image tag / digest before retirement
3. Confirm ability to re-enable legacy loaders via flags without DB migration
4. pg_dump or operator-approved backup window if R8 runbook requires schema/policy touch (not applicable to this preflight session)
5. Post-R8 smoke: Admin Compare pilot batch, three-company monitoring, Ledger V2 main table, Party Ledger, Account Statement

## Approval gate

**Required exact phrase:**

```text
NADEEM_APPROVES_R8_LEGACY_RETIREMENT
```

**Status today:** NOT PRESENT → **R8 NOT AUTHORIZED**

## If approval is granted later

Do **not** run immediately. Required sequence:

1. Locate canonical R8 runbook in repo (`docs/accounting/` / execution plan R8 section)
2. Produce R8 **pre-execution** report: backup state, rollback plan, scripts, flags, legacy paths affected
3. Operator final go-ahead on runbook steps
4. Execute only steps explicitly listed in approved runbook
5. Post-run monitoring + evidence folder under `reports/`

## Legacy paths (high level — retirement scope TBD by runbook)

- Legacy party/account ledger loaders when unified loader flags ON
- Shadow compare panels (may remain for diagnostics until runbook says remove)
- Hybrid `getCustomerLedger` merge paths (if flagged for retirement)

**No paths were retired in this session.**

## Safety attestation

| Item | This session |
|------|----------------|
| R8 executed | no |
| DB migrations | no |
| Repairs | no |
| Production GL mutation | no |
| Passwords in docs | no |
