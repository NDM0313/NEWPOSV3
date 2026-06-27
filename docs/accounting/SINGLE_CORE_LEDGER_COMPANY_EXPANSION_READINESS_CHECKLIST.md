# Single Core Ledger — Company Expansion Readiness Checklist

**Purpose:** Gate future unified-ledger rollout to companies **other than** DIN CHINA.  
**Status:** Template only — **no company flags enabled by this document.**

DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`) is the only company with unified main loaders live as of Phase 2.16.

---

## Pre-expansion (per target company)

- [ ] **Finance sign-off** — signed CSV or approval record per company (same pattern as [`finance-signoff-production-remediation-2026-06-23.csv`](../../reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv))
- [ ] **Operator approval** — explicit written approval before each flag enable step
- [ ] **No cross-company flags** — verify no other company has `unified_ledger_loader_*` ON before enabling target company
- [ ] **Company-specific golden fixtures** documented in `reports/single-core-ledger/<company-slug>/golden-fixtures.json`

---

## Golden fixtures (required per company)

| Screen | Required fixture | DIN CHINA reference |
|--------|------------------|---------------------|
| Ledger V2 | Golden party closing balance | MR JALIL = PKR 216,300 |
| Account Statement | Golden party closing balance | MR JALIL = PKR 216,300 |
| Party Ledger | Golden party closing balance | MR JALIL = PKR 216,300 |
| Trial Balance | Total debit = total credit | PKR 407,957,271.02 |
| Roznamcha | Cash In / Cash Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

Each new company must define its own golden party and totals before loader enable.

---

## Staged enablement (per company, operator-controlled)

Enable in order; **stop and rollback** if any gate fails:

1. `unified_ledger_pilot` (company scope)
2. `unified_ledger_engine`
3. Screen flags (`unified_ledger_screen_*`) — preview/compare only first
4. Loader flags (`unified_ledger_loader_*`) — one screen at a time after preview QA PASS

**Do not** bulk-enable all loaders without per-screen golden verification.

---

## Monitoring window

- [ ] **24h monitoring window** after final loader enable, **or**
- [ ] **Signed accelerated waiver** (finance + operator) with documented risk acceptance

Use `scripts/single-core-ledger/run-phase-216-monitoring-verify.mjs` as the browser QA template (adjust company login and golden constants).

---

## Rollback scripts (per loader)

Keep L1 rollback SQL ready before each loader enable:

| Loader | Rollback SQL |
|--------|--------------|
| Ledger V2 | [`phase-210-rollback-loader-ledger-v2.sql`](../../scripts/single-core-ledger/phase-210-rollback-loader-ledger-v2.sql) |
| Account Statement | [`phase-211-rollback-account-statement-loader.sql`](../../scripts/single-core-ledger/phase-211-rollback-account-statement-loader.sql) |
| Trial Balance | [`phase-212-rollback-trial-balance-loader.sql`](../../scripts/single-core-ledger/phase-212-rollback-trial-balance-loader.sql) |
| Party Ledger | [`phase-213-rollback-party-ledger-loader.sql`](../../scripts/single-core-ledger/phase-213-rollback-party-ledger-loader.sql) |
| Roznamcha | [`phase-214-rollback-roznamcha-loader.sql`](../../scripts/single-core-ledger/phase-214-rollback-roznamcha-loader.sql) |

Screen rollback companions exist for each phase (`phase-21x-rollback-*-screen.sql`).

---

## Verification gates (must PASS before next loader)

- [ ] Admin Compare pilot batch 9/9 (or company-scoped equivalent)
- [ ] Golden party on Ledger V2, Account Statement, Party Ledger
- [ ] Trial Balance debit = credit at company golden total
- [ ] Roznamcha golden totals (if Roznamcha loader in scope)
- [ ] No material console/RPC errors on production URL
- [ ] `npm run test:unified-ledger` PASS on rollout branch
- [ ] Production flags read-only check: only target company loaders ON

---

## Explicit prohibitions

- Do **not** enable flags for multiple companies in one change set without separate sign-offs
- Do **not** copy DIN CHINA golden values to other companies
- Do **not** skip finance sign-off for “small” companies
- Do **not** run migrations or GL repairs as part of expansion unless separately approved

---

## References

- Master status: [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](SINGLE_CORE_LEDGER_PRODUCTION_READY.md)
- Phase 2.16 monitoring pack: [`phase-2-16-monitoring/`](../../reports/single-core-ledger/phase-2-16-monitoring/)
- Expansion summary: [`company-expansion-readiness.md`](../../reports/single-core-ledger/phase-2-16-monitoring/company-expansion-readiness.md)
