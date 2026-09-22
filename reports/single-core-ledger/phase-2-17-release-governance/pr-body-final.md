## Summary

Single Core Ledger rollout for **DIN CHINA only** — governance merge to `main`. Production is already live and stable on https://erp.dincouture.pk.

| Phase | Status |
|-------|--------|
| Phase 2.16 | **PASS (A)** — `PHASE 2.16 MONITORING PASS — DIN CHINA UNIFIED LEDGER STABLE` |
| Phase 2.17 | **COMPLETE** — release governance @ `41dd467a` |
| Phase 2.17X | **COMPLETE** — PR/main merge preflight @ `d3d3173c` |
| Phase 2.17Y | **READY** — PR governance; operator merge approval required |

## Production scope (DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485`)

Five unified **main loaders live**:

1. Ledger V2
2. Account Statement
3. Trial Balance
4. Party Ledger
5. Roznamcha

**Golden values unchanged (Phase 2.16 verified):**

| Fixture | Value |
|---------|-------|
| MR JALIL (LV2 / AS / PL) | PKR 216,300 |
| Trial Balance debit = credit | PKR 407,957,271.02 |
| Roznamcha Cash In / Out / Closing | 136,158,012 / 67,042,426 / 69,115,586 |

## Repo gates (@ Phase 2.17Y)

- `npm run test:unified-ledger` — **240/240 PASS**
- `npm run build` — **PASS**

## Phase 2.17 / 2.17X / 2.17Y constraints

- **No new flags** enabled in governance phases
- **No migrations run** in governance phases
- **No GL mutations** in governance phases
- Merge to `main` is **branch hygiene / code integration only** — not a new accounting rollout

## Expansion

Other-company unified loader expansion **blocked** until separate finance sign-off per [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md).

## Rollback reminder

Use **per-loader L1 rollback SQL** only for a **real future production issue**. Do **not** rollback for historical Playwright flakes (fixed Phase 2.16).

| Loader | Rollback SQL |
|--------|--------------|
| Ledger V2 | `scripts/single-core-ledger/phase-210-rollback-loader-ledger-v2.sql` |
| Account Statement | `scripts/single-core-ledger/phase-211-rollback-account-statement-loader.sql` |
| Trial Balance | `scripts/single-core-ledger/phase-212-rollback-trial-balance-loader.sql` |
| Party Ledger | `scripts/single-core-ledger/phase-213-rollback-party-ledger-loader.sql` |
| Roznamcha | `scripts/single-core-ledger/phase-214-rollback-roznamcha-loader.sql` |

## PR diff note

This branch includes the full Single Core Ledger rollout (source, tests, scripts, docs, evidence). Flag-enable SQL scripts in `scripts/single-core-ledger/` are **documented rollout artifacts** — already applied in production for DIN CHINA. **Merging does not execute SQL.**

## Operator

- **Do not auto-merge** without explicit approval
- Review diff; confirm no unintended production mutation steps in merge workflow

## Test plan

- [ ] Review PR file list vs categories in [`pr-governance-final.md`](reports/single-core-ledger/phase-2-17-release-governance/pr-governance-final.md)
- [ ] Confirm CI / local tests pass
- [ ] Confirm Phase 2.16 production evidence still authoritative
- [ ] Approve merge manually
- [ ] Do **not** enable other company loaders after merge

## Evidence

- [`final-production-verify.md`](reports/single-core-ledger/phase-2-16-monitoring/final-production-verify.md)
- [`final-release-governance.md`](reports/single-core-ledger/phase-2-17-release-governance/final-release-governance.md)
- [`pr-main-merge-preflight.md`](reports/single-core-ledger/phase-2-17-release-governance/pr-main-merge-preflight.md)
- [`SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md)
