# Phase 2.17 — Final PR / Merge / Release Governance

**Date:** 2026-06-27  
**Scope:** DIN CHINA Single Core Ledger rollout closure (OLD ERP / DIN Collection ERP — **not** FX / multi-currency app)  
**Production URL:** https://erp.dincouture.pk

---

## Repository verification

| Check | Result |
|-------|--------|
| Branch | `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` |
| Phase 2.16 commit in history | **YES** — `269830b5` (HEAD before Phase 2.17 doc commit) |
| Phase 2.16 evidence paths | **Present** — see links below |
| FX / multi-currency app touched | **NO** — Phase 2.17 is docs/governance only |
| Working tree before Phase 2.17 | Unrelated local modifications present; Phase 2.17 commit scoped to governance artifacts only |

---

## Accepted prior phase

**Phase 2.16 status = A**

`PHASE 2.16 MONITORING PASS — DIN CHINA UNIFIED LEDGER STABLE`

---

## Production scope

| Item | Value |
|------|-------|
| Company | DIN CHINA |
| Company ID | `30bd8592-3384-4f34-899a-f3907e336485` |
| Other companies | No unified loader flags enabled |

### Five live unified main loaders (DIN CHINA)

| Loader | Status |
|--------|--------|
| Ledger V2 | **ON** — unified main |
| Account Statement | **ON** — unified main |
| Trial Balance | **ON** — unified main |
| Party Ledger | **ON** — unified main |
| Roznamcha | **ON** — unified main |

---

## Golden values (must remain unchanged)

| Screen / fixture | Golden value |
|------------------|--------------|
| Ledger V2 — MR JALIL closing | PKR 216,300 |
| Account Statement — MR JALIL closing | PKR 216,300 |
| Party Ledger — MR JALIL closing | PKR 216,300 |
| Trial Balance — total debit = credit | PKR 407,957,271.02 |
| Roznamcha — Cash In | PKR 136,158,012 |
| Roznamcha — Cash Out | PKR 67,042,426 |
| Roznamcha — Closing | PKR 69,115,586 |

Verified in Phase 2.16 production monitoring — no re-run required for Phase 2.17 (governance-only).

---

## Phase 2.16 evidence

| Artifact | Path |
|----------|------|
| Production monitoring day 1 | [`phase-2-16-monitoring/production-monitoring-day1.md`](../phase-2-16-monitoring/production-monitoring-day1.md) |
| Production flags day 1 | [`phase-2-16-monitoring/production-flags-day1.json`](../phase-2-16-monitoring/production-flags-day1.json) |
| Automation hardening | [`phase-2-16-monitoring/automation-hardening-report.md`](../phase-2-16-monitoring/automation-hardening-report.md) |
| Final production verify | [`phase-2-16-monitoring/final-production-verify.md`](../phase-2-16-monitoring/final-production-verify.md) |
| Company expansion readiness | [`phase-2-16-monitoring/company-expansion-readiness.md`](../phase-2-16-monitoring/company-expansion-readiness.md) |
| Expansion checklist | [`docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) |
| Production ready pack | [`docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PRODUCTION_READY.md) |
| Phase 2.15 recovery plan | [`docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_15_CASH_BANK_PARITY_AND_ROZNAMCHA_RECOVERY_PLAN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_15_CASH_BANK_PARITY_AND_ROZNAMCHA_RECOVERY_PLAN.md) |

---

## Repo gates (Phase 2.17 pre-commit)

| Gate | Result |
|------|--------|
| `npm run test:unified-ledger` | **PASS** — 240/240 |
| `npm run build` | **PASS** |

---

## Phase 2.17 constraints (explicit)

- **No new flags** enabled
- **No migrations** run
- **No GL mutations** (journal entries, payments, balances, report totals unchanged)
- **No other company expansion**
- **No FX / multi-currency app** changes
- **No accounting logic** changes — governance documentation only

---

## Release decision

**READY FOR PR / MAIN MERGE GOVERNANCE**

DIN CHINA Single Core Ledger rollout is complete and stable. Phase 2.17 closes release governance; merging to main is a documentation/branch hygiene step — **not** a new accounting rollout or flag enablement.

Operator must approve merge after PR review. Do **not** auto-merge without explicit approval.

---

## Rollback reminder

Use **per-loader L1 rollback SQL** only if a future production issue appears:

| Loader | Script |
|--------|--------|
| Ledger V2 | `scripts/single-core-ledger/phase-210-rollback-loader-ledger-v2.sql` |
| Account Statement | `scripts/single-core-ledger/phase-211-rollback-account-statement-loader.sql` |
| Trial Balance | `scripts/single-core-ledger/phase-212-rollback-trial-balance-loader.sql` |
| Party Ledger | `scripts/single-core-ledger/phase-213-rollback-party-ledger-loader.sql` |
| Roznamcha | `scripts/single-core-ledger/phase-214-rollback-roznamcha-loader.sql` |

Do **not** rollback for historical Phase 2.15X Playwright flakes — those were fixed in Phase 2.16.

---

## PR readiness

GitHub CLI (`gh`) was **not available** in the execution environment. Operator action:

```bash
git push -u origin feature/single-core-ledger-phase-2-9a3-preview-deploy-plan

gh pr create \
  --base main \
  --head feature/single-core-ledger-phase-2-9a3-preview-deploy-plan \
  --title "accounting: finalize DIN CHINA single core ledger rollout governance" \
  --body "$(cat <<'EOF'
## Summary
- Phase 2.16 **PASS** — DIN CHINA unified ledger stable on https://erp.dincouture.pk
- Five unified main loaders live: Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha
- Golden values unchanged (MR JALIL 216,300; TB 407,957,271.02; Roznamcha totals exact)
- `npm run test:unified-ledger` 240 PASS; `npm run build` PASS
- Phase 2.17: release governance docs only — **no flags, migrations, or GL mutations**

## Expansion
Other company rollout **blocked** until separate finance sign-off per `SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`.

## Test plan
- [ ] Review Phase 2.16 monitoring evidence
- [ ] Confirm no production flag SQL in this PR
- [ ] Operator approves merge (not auto-merge)
EOF
)"
```

If a PR already exists for this branch, update its description with the Phase 2.17 governance summary instead of creating a duplicate.

---

## Future phases (optional, not started)

| Phase | Description |
|-------|-------------|
| 2.18 | Optional Admin Compare Cash/Bank raw RPC diagnostic cleanup |
| 2.19 | Optional other-company expansion planning (separate finance sign-off) |
| Future | Optional `roznamcha_payment` RPC mode — requires separate migration approval |

---

## Manifest

Machine-readable record: [`release-manifest.json`](release-manifest.json)
