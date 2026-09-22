# R8 Execution — Operator Prompt (use only after approval)

**Do not paste or run this until:**

1. Operator message contains **exact** phrase: `NADEEM_APPROVES_R8_LEGACY_RETIREMENT`
2. Fresh `npm run monitor:three-company-unified-ledger` **PASS** with per-company credentials
3. Operator gives **final go-ahead** in the same session

---

## Prompt to give the agent (copy after gates above)

```text
OLD ERP / DIN Collection ERP only. NOT the FX app.

R8 LEGACY RETIREMENT — EXECUTION AUTHORIZED

Approval phrase present: NADEEM_APPROVES_R8_LEGACY_RETIREMENT
Final operator go-ahead: YES

Baseline:
- Repo NEWPOSV3 branch main
- Pre-execution pack: reports/r8-legacy-retirement-final-preexecution-20260710/
- Production: https://erp.dincouture.pk
- Fresh monitoring: PASS (attach artifact path)

Hard safety:
- Follow docs/accounting/R8_LEGACY_RETIREMENT_PREFLIGHT_AFTER_DAY15_2026-07-09.md sequence
- Follow docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md retirement order
- NO DB migrations unless explicitly listed in approved runbook step
- NO GL repairs / Supplier Party Discount QA / Play Store
- NO password commit
- Git tag before retirement code commit
- Deploy only via deploy/vps-build-erp-only.sh after build PASS
- Post-run: monitor:three-company-unified-ledger + smoke Ledger V2 / Party Ledger / Account Statement
- Evidence folder: reports/r8-legacy-retirement-execution-YYYYMMDD/

Execute only runbook steps. Stop on any monitoring/build failure.
```

---

## Expected execution sequence (high level)

1. Re-verify HEAD, tests, build
2. Run fresh monitoring → must PASS
3. Snapshot flags + record VPS `erp-frontend` image digest
4. `git tag` pre-R8 baseline
5. Code retirement per Phase 8 map (incremental PR/commits — no big-bang without review)
6. `npm run test:unified-ledger` + `npm run build`
7. Deploy frontend only
8. Post-deploy monitoring + manual smoke
9. Evidence commit under `reports/r8-legacy-retirement-execution-*`

## Rollback if anything fails

1. `unified_ledger_kill_switch` ON (company-scoped) **or** L1 loader flags OFF via rollback SQL
2. Redeploy previous `erp-frontend` image / git revert
3. Re-run monitoring to confirm legacy effective loaders

**No GL data rollback** if execution remains code/flag-only.
