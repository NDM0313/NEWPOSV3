# Single Core Ledger — Production Ready Pack

**Status:** `PRODUCTION OPS MODE` — three-company unified ledger baseline complete; final ops handoff archived  
**Program:** DIN CHINA, DIN BRIDAL, and DIN COUTURE unified loaders live and stable on `main`. Migration closure complete — **no pending approved migrations**. R7 design-only; R8 blocked. Next-company expansion requires separate finance sign-off — [`master-remaining-roadmap.md`](../reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md)  
**Branch:** `main` @ final production ops handoff (2026-06-29)  
**PR:** https://github.com/NDM0313/NEWPOSV3/pull/21  
**Last updated:** 2026-06-29  
**Archive:** Three-company baseline — [`final-program-archive-report.md`](../reports/single-core-ledger/final-program-archive/final-program-archive-report.md)  
**Ops handoff:** [`final-production-ops-handoff.md`](../reports/single-core-ledger/final-production-ops-handoff/final-production-ops-handoff.md)  
**Remaining tasks:** [`remaining-tasks-master-register.md`](../reports/single-core-ledger/final-production-ops-handoff/remaining-tasks-master-register.md) · [`seven-phase-remaining-plan.md`](../reports/single-core-ledger/final-production-ops-handoff/seven-phase-remaining-plan.md) · [`operator-decision-dashboard.md`](../reports/single-core-ledger/final-production-ops-handoff/operator-decision-dashboard.md)  
**Remaining optional screens audit (Phase 3):** [`remaining-optional-screens-audit/`](../reports/single-core-ledger/remaining-optional-screens-audit/) — completed @ 2026-06-29  
**Phase 3A BS/P&L preview-only:** [`phase-3a-bs-pl-preview/`](../reports/single-core-ledger/phase-3a-bs-pl-preview/) — **deployed to production** @ 2026-06-29 (`4a5dc304`); legacy BS/P&L default behavior unchanged; loader swap not approved; R7/R8/next company remain blocked  
**Phase 3D BS/P&L candidate golden capture:** [`phase-3d-bs-pl-golden-capture/`](../reports/single-core-ledger/phase-3d-bs-pl-golden-capture/) — **completed** @ 2026-06-29; values are **candidate-only, not finance approved**; no migrations, flags, or GL/data mutations; loader swap remains not approved  
**Phase 3D-SIGNOFF finance sign-off pack:** [`finance-signoff-pack.md`](../reports/single-core-ledger/phase-3d-bs-pl-golden-capture/finance-signoff-pack.md) — **prepared** @ 2026-06-29; finance status **PENDING**; BS/P&L loader swap **BLOCKED**  
**Phase 3B Cash Flow preview-only:** [`phase-3b-cash-flow-preview/`](../reports/single-core-ledger/phase-3b-cash-flow-preview/) — **deployed to production** @ 2026-06-29 (`99f2e3b3`); legacy Cash Flow default unchanged; loader swap not approved; BS/P&L finance status **PENDING**; R7/R8/next company remain blocked; no migrations, no flags, and no GL/data mutations  
**Phase 3B-D Cash Flow candidate golden capture:** [`phase-3b-d-cash-flow-golden-capture/`](../reports/single-core-ledger/phase-3b-d-cash-flow-golden-capture/) — **completed** @ 2026-06-29; values are **candidate-only, not finance approved**; Cash Flow loader swap remains not approved; no migrations, flags, or GL/data mutations  
**Phase 3B-E Cash Flow delta investigation:** [`phase-3b-e-cash-flow-delta-investigation/`](../reports/single-core-ledger/phase-3b-e-cash-flow-delta-investigation/) — **completed** @ 2026-06-29; DIN CHINA/DIN BRIDAL non-zero deltas require rule confirmation; no runtime behavior changes; R7/R8/next company remain blocked  
**Phase 3B-F Cash Flow row-keyed export / deeper diff tooling:** [`phase-3b-f-cash-flow-row-export/`](../reports/single-core-ledger/phase-3b-f-cash-flow-row-export/) — **deployed** @ 2026-06-29 (`5433ac2c`); diagnostic-only; row exports captured for DIN CHINA/DIN BRIDAL; no official totals changed; Cash Flow loader swap remains blocked; finance rule confirmation still required  
**Phase 3B-G Cash Flow finance rule decision pack:** [`phase-3b-g-cash-flow-finance-rule-decision/`](../reports/single-core-ledger/phase-3b-g-cash-flow-finance-rule-decision/) — Q4=A, Q5=C, Q7=B recorded @ 2026-06-29  
**Phase 3B-H Cash Flow preview alignment:** [`phase-3b-h-cash-flow-preview-alignment/`](../reports/single-core-ledger/phase-3b-h-cash-flow-preview-alignment/) — **deployed to production** @ 2026-06-29 (`d2401b1f`); preview follows Q4=A, Q5=C, Q7=B; official legacy unchanged; loader swap blocked; BS/P&L finance **PENDING**; R7/R8/next company remain blocked; no migrations, flags, or GL/data mutations  
**Phase 3B-I aligned Cash Flow candidate golden capture:** [`phase-3b-i-cash-flow-aligned-golden-capture/`](../reports/single-core-ledger/phase-3b-i-cash-flow-aligned-golden-capture/) — **completed** @ 2026-06-29; values are **candidate-only, not finance approved**; DIN COUTURE zero-diff · DIN CHINA/DIN BRIDAL non-zero-diff; Cash Flow loader swap remains not approved; no migrations, flags, or GL/data mutations  
**Phase 3B-J Cash Flow residual delta bridge:** [`phase-3b-j-cash-flow-residual-delta-bridge/`](../reports/single-core-ledger/phase-3b-j-cash-flow-residual-delta-bridge/) — **prepared** @ 2026-06-29; explains DIN CHINA/DIN BRIDAL non-zero residual after approved preview rules; finance basis decision required before sign-off; no deploy, migrations, flags, or GL/data mutations  
**Ops monitoring:** [`ops-schedule-closure-report.md`](../reports/single-core-ledger/operational-monitoring/ops-schedule-closure-report.md)  
**Commit reconciliation:** `0a818da2` baseline · `50547061` monitoring automation · `9586e611` credential hardening  
**Master checklist:** use this file as the single entry point for post-apply status.

---

## Live three-company unified ledger state (authoritative)

| Company | Flags | Loaders | Golden party | Monitoring baseline |
|---------|-------|---------|--------------|---------------------|
| DIN CHINA | 12/12 ON | 5/5 ON | MR JALIL — PKR 216,300 | PASS |
| DIN BRIDAL | 12/12 ON | 5/5 ON | MR REHAN ALI — PKR 530,000 | PASS |
| DIN COUTURE | 12/12 ON | 5/5 ON | DHARIA — PKR 4,488,088 | PASS |

- **Other company loaders (unapproved):** none  
- **Migration closure:** complete — no approved pending migrations  
- **R7 roznamcha_payment RPC:** design-only  
- **R8 legacy engine retirement:** blocked  
- **Three-company unified ledger baseline:** complete  
- **Monitoring credential hardening:** complete @ `9586e611`  
- **Ops schedule pack + incident runbook:** complete — [`ops-schedule-closure-report.md`](../reports/single-core-ledger/operational-monitoring/ops-schedule-closure-report.md)  
- **Final production ops handoff:** **COMPLETE** — program in production ops mode — [`final-production-ops-handoff-manifest.json`](../reports/single-core-ledger/final-production-ops-handoff/final-production-ops-handoff-manifest.json)
- **Password rotation:** **COMPLETE** — post-rotation monitoring **PASS** — per-company credentials verified; generic fallback disabled — [`password-rotation-final-closure-manifest.json`](../reports/single-core-ledger/operational-monitoring/password-rotation-final-closure-manifest.json)
- **Production ops mode continues.** Remaining phases are **classified, not automatically approved**. R7/R8/next company remain blocked until separate approval.
- **Phase 3A BS/P&L preview-only:** **DEPLOYED** — https://erp.dincouture.pk @ `4a5dc304` — legacy main unchanged — [`phase-3a-bs-pl-preview/`](../reports/single-core-ledger/phase-3a-bs-pl-preview/)
- **Phase 3D BS/P&L candidate golden capture:** **COMPLETE** — DIN CHINA · DIN BRIDAL · DIN COUTURE — all section totals zero-diff in preview compare; **CANDIDATE_ONLY — NOT FINANCE APPROVED** — [`phase-3d-bs-pl-golden-capture/`](../reports/single-core-ledger/phase-3d-bs-pl-golden-capture/)
- **Phase 3D-SIGNOFF finance pack:** **PREPARED** — [`finance-signoff-pack.md`](../reports/single-core-ledger/phase-3d-bs-pl-golden-capture/finance-signoff-pack.md) — finance status **PENDING**; loader swap **BLOCKED**; R7/R8/next company remain blocked
- **Phase 3B Cash Flow preview-only:** **DEPLOYED** — https://erp.dincouture.pk @ `99f2e3b3` — legacy Cash Flow default unchanged; loader swap not approved; BS/P&L finance status **PENDING**; R7/R8/next company remain blocked; no migrations, no flags, and no GL/data mutations — [`phase-3b-cash-flow-preview/`](../reports/single-core-ledger/phase-3b-cash-flow-preview/)
- **Phase 3B-D Cash Flow candidate golden capture:** **COMPLETE** — DIN CHINA · DIN BRIDAL · DIN COUTURE — **CANDIDATE_ONLY — NOT FINANCE APPROVED**; DIN COUTURE zero-diff · DIN CHINA/DIN BRIDAL non-zero-diff — [`phase-3b-d-cash-flow-golden-capture/`](../reports/single-core-ledger/phase-3b-d-cash-flow-golden-capture/)
- **Phase 3B-E Cash Flow delta investigation:** **COMPLETE** — rule confirmation required for DIN CHINA/DIN BRIDAL; values remain candidate-only; loader swap blocked; BS/P&L finance **PENDING**; no migrations/flags/GL mutations — [`phase-3b-e-cash-flow-delta-investigation/`](../reports/single-core-ledger/phase-3b-e-cash-flow-delta-investigation/)
- **Phase 3B-F Cash Flow row-keyed export / deeper diff tooling:** **DEPLOYED** — https://erp.dincouture.pk @ `5433ac2c` — diagnostic/export-only; DIN CHINA/DIN BRIDAL row exports captured; loader swap blocked; finance rule confirmation **PENDING** — [`phase-3b-f-cash-flow-row-export/`](../reports/single-core-ledger/phase-3b-f-cash-flow-row-export/)
- **Phase 3B-G Cash Flow finance rule decision pack:** **RECORDED** — Q4=A, Q5=C, Q7=B @ 2026-06-29 — [`phase-3b-g-cash-flow-finance-rule-decision/`](../reports/single-core-ledger/phase-3b-g-cash-flow-finance-rule-decision/)
- **Phase 3B-H Cash Flow preview alignment:** **DEPLOYED** — https://erp.dincouture.pk @ `d2401b1f` — preview follows Q4=A, Q5=C, Q7=B; legacy official unchanged; loader swap blocked; no migrations/flags/GL mutations — [`phase-3b-h-cash-flow-preview-alignment/`](../reports/single-core-ledger/phase-3b-h-cash-flow-preview-alignment/)
- **Phase 3B-I aligned Cash Flow candidate golden capture:** **COMPLETE** — DIN CHINA · DIN BRIDAL · DIN COUTURE — **CANDIDATE_ONLY — NOT FINANCE APPROVED**; DIN COUTURE zero-diff · DIN CHINA/DIN BRIDAL non-zero-diff — [`phase-3b-i-cash-flow-aligned-golden-capture/`](../reports/single-core-ledger/phase-3b-i-cash-flow-aligned-golden-capture/)
- **Phase 3B-J Cash Flow residual delta bridge:** **PREPARED** — finance basis decision required; official legacy unchanged; loader swap blocked — [`phase-3b-j-cash-flow-residual-delta-bridge/`](../reports/single-core-ledger/phase-3b-j-cash-flow-residual-delta-bridge/)
- **Ongoing command:** `npm run monitor:three-company-unified-ledger` with per-company `QA_BROWSER_PASSWORD_*` only — continue scheduled monitoring only
- Evidence: [`three-company-monitoring-baseline.md`](../reports/single-core-ledger/final-program-archive/three-company-monitoring-baseline.md)

---

## Live DIN CHINA unified ledger state (authoritative)

| Item | State |
|------|-------|
| `unified_ledger_pilot` | **ON** |
| `unified_ledger_engine` | **ON** (DIN CHINA) |
| Ledger V2 screen + loader | **ON** — unified main live @ 2026-06-26 |
| Account Statement screen + loader | **ON** — unified main live @ 2026-06-26 |
| Trial Balance screen + loader | **ON** — unified main live @ 2026-06-26 |
| Party Ledger screen + loader | **ON** — unified main live @ 2026-06-26 (`a7a4b727`) |
| Roznamcha screen + loader | **ON** — unified main live @ 2026-06-26 (Phase 2.15 parity fix) |
| Other company loaders | **none** (verified Phase 2.16 @ 2026-06-27) |
| MR JALIL golden (Ledger V2 + Account Statement + Party Ledger) | **PKR 216,300** |
| Trial Balance golden (All Branches) | **PKR 407,957,271.02** debit = credit |
| Roznamcha golden (Cash In / Out / Closing) | **136,158,012 / 67,042,426 / 69,115,586** |
| Phase 2.15X closeout | **COMPLETE** — Roznamcha parity fix live |
| Phase 2.16 monitoring + automation | **PASS** — [`phase-2-16-monitoring/`](../reports/single-core-ledger/phase-2-16-monitoring/) |
| Phase 2.17 release governance | **COMPLETE** — [`phase-2-17-release-governance/`](../reports/single-core-ledger/phase-2-17-release-governance/) |
| Phase 2.17X PR/main merge preflight | **COMPLETE** — [`pr-main-merge-preflight.md`](../reports/single-core-ledger/phase-2-17-release-governance/pr-main-merge-preflight.md) |
| Phase 2.17Y PR governance | **COMPLETE** — [`pr-governance-final.md`](../reports/single-core-ledger/phase-2-17-release-governance/pr-governance-final.md) |
| Phase 2.18 main merge closure | **COMPLETE** — [`main-merge-complete-report.md`](../reports/single-core-ledger/phase-2-18-main-merge-closure/main-merge-complete-report.md) |
| Phase 2.18 final archive | **COMPLETE** — [`final-archive-and-monitoring-report.md`](../reports/single-core-ledger/phase-2-18-main-merge-closure/final-archive-and-monitoring-report.md) |
| Master remaining roadmap | **ACTIVE** — [`master-remaining-roadmap.md`](../reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md) |
| R1B docs reconciliation | **COMPLETE** — stale phase headers clarified |
| R2 Cash/Bank Admin Compare diagnostic | **CLOSED** — safe UI labeling — [`r2-final-resolution-report.md`](../reports/single-core-ledger/r2-cash-bank-admin-compare-diagnostic/r2-final-resolution-report.md) |
| R6 monitoring hardening | **COMPLETE** — [`r6-completion-report.md`](../reports/single-core-ledger/r6-monitoring-hardening/r6-completion-report.md) |
| R4 per-company rollout runbook | **ACTIVE** — [`SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md`](SINGLE_CORE_LEDGER_PER_COMPANY_ROLLOUT_RUNBOOK.md) |
| R3 other-company pre-expansion audit | **AUDIT COMPLETE** — [`r3-audit-complete-report.md`](../reports/single-core-ledger/r3-pre-expansion-audit/r3-audit-complete-report.md) |
| R5 first non-DIN pilot preflight | **COMPLETE** — [`r5-preflight-status.md`](../reports/single-core-ledger/r5-pilot-preflight/r5-preflight-status.md) |
| R5 DIN BRIDAL controlled rollout execution | **COMPLETE — unified loaders live** @ 2026-06-27 — [`r5-soak-complete-report.md`](../reports/single-core-ledger/r5-din-bridal-execution/r5-soak-complete-report.md) |
| R5 DIN BRIDAL post-completion archive | **COMPLETE** @ 2026-06-27 — [`r5-post-completion-commit-reconciliation.md`](../reports/single-core-ledger/r5-din-bridal-execution/r5-post-completion-commit-reconciliation.md), [`production-monitoring-post-completion.md`](../reports/single-core-ledger/din-bridal-monitoring/production-monitoring-post-completion.md) |
| Migration closure + DB readiness | **COMPLETE** @ 2026-06-27 — no approved pending migrations; Phase 1.5 4/4 applied — [`migration-closure-final-report.md`](../reports/single-core-ledger/migration-closure/migration-closure-final-report.md) |
| Post-PR final closure | **COMPLETE** — [`final-post-pr-closure-report.md`](../reports/single-core-ledger/phase-2-18-main-merge-closure/final-post-pr-closure-report.md) |
| DIN COUTURE next-company rollout | **COMPLETE — unified loaders live** @ 2026-06-27 — [`final-execution-report.md`](../reports/single-core-ledger/next-company-rollout/din-couture/final-execution-report.md) |
| Three-company operational baseline | **COMPLETE** @ 2026-06-14 — [`final-program-archive-report.md`](../reports/single-core-ledger/final-program-archive/final-program-archive-report.md) |
| Post-baseline monitoring automation + runbook | **COMPLETE** @ 2026-06-14 — [`monitoring-runbook.md`](../reports/single-core-ledger/operational-monitoring/monitoring-runbook.md) |
| Monitoring credential hardening | **COMPLETE** @ 2026-06-14 — [`credential-hardening-report.md`](../reports/single-core-ledger/operational-monitoring/credential-hardening-report.md) |
| Operational monitoring ops schedule closure | **COMPLETE** — password rotation **COMPLETE** — [`ops-schedule-closure-report.md`](../reports/single-core-ledger/operational-monitoring/ops-schedule-closure-report.md) |
| Post-rotation monitoring verification | **PASS** @ 2026-06-29 — office PC per-company credentials — [`three-company-monitoring-2026-06-29T07-42-30-177Z.json`](../reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-06-29T07-42-30-177Z.json) |

| Post-baseline remaining phase audit | **COMPLETE** @ 2026-06-14 — [`post-baseline-remaining-phases/`](../reports/single-core-ledger/post-baseline-remaining-phases/) |

Closeout pack: [`phase-212-closeout-monitoring.md`](../reports/single-core-ledger/phase-2-12-trial-balance-loader/phase-212-closeout-monitoring.md)

> Phase 2.15X automation waivers (LV2 Playwright NaN, Admin Compare timing) were **resolved in Phase 2.16** via shared Playwright helpers. See [`automation-hardening-report.md`](../reports/single-core-ledger/phase-2-16-monitoring/automation-hardening-report.md).

> Historical phase completion reports (2.1–2.8) describe point-in-time ship state (“engine OFF at preview ship”). **This section is the live production truth** after 2.10G / 2.11 / 2.12.

---

## Executive summary

> **Historical timeline only.** Rows below record point-in-time gate status during rollout. **Live production truth is the top “Live DIN CHINA unified ledger state” section** and Phase 2.17 final status at the bottom. Do not treat “BLOCKED” or “await approval” rows here as current blockers unless the live section says otherwise.

| Gate | Status |
|------|--------|
| Fresh clone Gate A (`ledger_stage_20260625_prodcheck`) | **PASS** 3/3 |
| Tie-out (all companies) | **PASS** 9/9 |
| Baseline comparison | **APPROVE_MANIFEST** (0 delta) |
| Finance sign-off (82 rows) | **COMPLETE** — 82 approved, 0 rejected |
| Pre-remediation DB backup | **COMPLETE** |
| Production metadata apply | **EXECUTED** 2026-06-23T19:33:16Z — **82 rows** |
| DIN CHINA `unified_ledger_loader_ledger_v2` | **ON** @ 2026-06-26T13:56:26Z — Ledger V2 unified main live |
| DIN CHINA `unified_ledger_loader_account_statement` | **ON** @ 2026-06-26T14:59:46Z — Account Statement unified main live |
| Post-apply validation (fresh clone) | **PASS** — payment gaps 0, branch risk 0, Gate A 3/3, tie-out 9/9 |
| Production smoke test (1.7) | **PASS** 10/10 |
| `unified_ledger_engine` (DIN CHINA) | **ON** @ 2026-06-25T18:05:23Z |
| Phase 1.5 prod migration pack | **APPLIED on production** — 4/4 in `schema_migrations`, 5/5 RPCs @ 2026-06-23 — migration closure complete @ 2026-06-27 |
| Phase 1.5 post-migration Gate A (1.8) | **PASS** 3/3 on `ledger_stage_20260625_prodcheck` |
| Phase 2 rollout plan | **READY** — plan on rollout branch |
| Phase 2.1 flags + banners | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_1_FLAGS_BANNERS_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_1_FLAGS_BANNERS_REPORT.md) |
| Phase 2.2 admin compare | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_2_ADMIN_COMPARE_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_2_ADMIN_COMPARE_REPORT.md) |
| Phase 2.3 Ledger V2 preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_3_LEDGER_V2_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_3_LEDGER_V2_PREVIEW_REPORT.md) |
| Phase 2.4 Account Statement preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_4_ACCOUNT_STATEMENT_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_4_ACCOUNT_STATEMENT_PREVIEW_REPORT.md) |
| Phase 2.5 Trial Balance preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_5_TRIAL_BALANCE_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_5_TRIAL_BALANCE_PREVIEW_REPORT.md) |
| Phase 2.6 Roznamcha preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_6_ROZNAMCHA_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_6_ROZNAMCHA_PREVIEW_REPORT.md) |
| Phase 2.7 Party Ledger preview | **COMPLETE** — see [`SINGLE_CORE_LEDGER_PHASE_2_7_PARTY_LEDGER_PREVIEW_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_2_7_PARTY_LEDGER_PREVIEW_REPORT.md) |
| Phase 2.8 Preview QA sign-off | **SIGNED OFF WITH WAIVERS** — see [`SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md`](SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md) |
| Phase 2.9 DIN CHINA pilot plan | **PLAN READY** — see [`SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md) |
| Phase 2.9A live waiver ops check | **PASS WITH LIMITED WAIVERS** — see [`pre-flag/live-waiver-checks.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/live-waiver-checks.md) |
| Phase 2.9A-2 browser waiver closure | **COMPLETE (historical)** — was blocked pre-preview deploy; closed in 2.9A-3+ — see [`browser-waiver-closure/`](../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/browser-waiver-closure/) |
| Phase 2.9A-3 preview deploy | **REdeployed** @ `312716e7+` — `erp-frontend-preview` on VPS :3003 |
| Phase 2.9A-4 browser waiver QA | **COMPLETE (historical waivers closed)** — smoke + RPC PASS; superseded by Stage 1/2 pilot QA |
| Phase 2.9A Admin Compare delta | **FIXED** (Party/Pilot/TB compare); Cash/Bank **waived** for Stage 1 — see [`admin-compare-delta-investigation.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa/admin-compare-delta-investigation.md) |
| Phase 2.9A-CB Cash/Bank parity | **PLANNED** — not Stage 1 blocker — [`SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md) |
| Phase 2.9A Stage 1 gate | **PASS** — Gates 1–4 PASS on preview tunnel (2026-06-25) |
| Phase 2.9B Stage 1 pilot flag | **ENABLED** — `unified_ledger_pilot` only @ 2026-06-25T17:28:52Z |
| Phase 2.9B 24h soak | **ACCELERATED WAIVER** — T0 + accelerated final PASS @ 2026-06-25T17:54:04Z — [`stage-1-accelerated-soak-waiver.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-stage-1/stage-1-accelerated-soak-waiver.md) |
| Phase 2.9C Stage 2 engine + screen | **ENABLED** — pilot + engine + `screen_ledger_v2` @ 2026-06-25T18:05:23Z — [`stage-2-execution-notes.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-stage-2/stage-2-execution-notes.md) |
| Phase 2.9C Stage 2 soak | **ACCELERATED WAIVER PASS** @ 2026-06-25T18:39:31Z — [`stage-2-accelerated-soak-waiver.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-stage-2/stage-2-accelerated-soak-waiver.md) |
| Phase 2.10 Ledger V2 loader swap plan | **IMPLEMENTED (2.10A–C)** — [`SINGLE_CORE_LEDGER_PHASE_2_10_LEDGER_V2_LOADER_SWAP_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_10_LEDGER_V2_LOADER_SWAP_PLAN.md) |
| Phase 2.10A implementation pack | **READY** — code/tests/SQL artifacts |
| Phase 2.10B preview baseline QA | **PASS** — [`baseline-loader-qa.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/baseline-loader-qa.md) @ 2026-06-26 |
| Phase 2.10B export spot-check | **SIGNED** — [`export-spot-check-baseline.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/export-spot-check-baseline.md) |
| Phase 2.10 preview deploy | **DONE** — `erp-frontend-preview` :3003 only — [`preview-deploy-notes.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/preview-deploy-notes.md) |
| Phase 2.10C candidate loader QA | **PASS** (shadow waiver fixed in 2.10C-FIX) — [`candidate-loader-qa-rerun.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/candidate-loader-qa-rerun.md) |
| Phase 2.10C-FIX shadow invert | **PASS** — [`shadow-invert-fix-notes.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/shadow-invert-fix-notes.md) @ 2026-06-26 |
| Phase 2.10C-FIX candidate export rerun | **SIGNED** — [`candidate-export-spot-check-rerun.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/candidate-export-spot-check-rerun.md) |
| Phase 2.10C-FIX L1 rollback rerun | **PASS** — [`rollback-loader-qa-rerun.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/rollback-loader-qa-rerun.md) |
| Phase 2.10D controlled loader soak | **PASS WITH WAIVERS** — [`controlled-soak-final.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/controlled-soak-final.md) @ 2026-06-26 |
| Phase 2.10D soak export check | **SIGNED** — [`controlled-soak-export-check.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/controlled-soak-export-check.md) |
| Phase 2.10E production deploy plan | **DONE** — [`production-deploy-plan.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-deploy-plan.md) |
| Phase 2.10F production frontend deploy | **DONE** — [`production-deploy-notes.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-deploy-notes.md) @ `3e3f6190` |
| Phase 2.10F production bundle verify | **PASS** — [`production-bundle-verify.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-bundle-verify.md) |
| Phase 2.10F production baseline QA | **PASS** — [`production-baseline-qa.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-baseline-qa.md) |
| Phase 2.10F baseline export | **SIGNED** — [`production-baseline-export-check.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-baseline-export-check.md) |
| Phase 2.10F staff waiver | **RECORDED** — [`production-staff-waiver.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-staff-waiver.md) |
| Phase 2.10G production loader ON | **DONE** @ 2026-06-26T13:56:26Z — [`production-loader-on-flags-after.json`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-loader-on-flags-after.json) |
| Phase 2.10G production loader ON QA | **PASS** — [`production-loader-on-qa.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-loader-on-qa.md) |
| Phase 2.10G production export | **SIGNED** — [`production-loader-on-export-check.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-loader-on-export-check.md) |
| Phase 2.10G production soak | **PASS** (accelerated waiver) — [`production-loader-soak-final.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-loader-soak-final.md) |
| Phase 2.10G staff visibility | **WAIVED** — [`production-staff-visibility-check.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-staff-visibility-check.md) |
| Phase 2.10G non-golden spot-check | **WAIVED** — [`production-non-golden-spot-check.md`](../reports/single-core-ledger/phase-2-10-ledger-v2-loader-swap/production-non-golden-spot-check.md) |
| Phase 2.10 loader flag SQL | **ON** (DIN CHINA Ledger V2) — `unified_ledger_loader_ledger_v2` |
| Phase 2.11 Account Statement loader plan | **LIVE** — [`SINGLE_CORE_LEDGER_PHASE_2_11_ACCOUNT_STATEMENT_LOADER_ROLLOUT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_11_ACCOUNT_STATEMENT_LOADER_ROLLOUT_PLAN.md) |
| Phase 2.11 production loader ON | **DONE** @ 2026-06-26T14:59:46Z — Account Statement unified main |
| Phase 2.11 production QA | **PASS** — [`phase-2-11-account-statement-loader/`](../reports/single-core-ledger/phase-2-11-account-statement-loader/) |
| Phase 2.12 Trial Balance loader plan | **LIVE** — [`SINGLE_CORE_LEDGER_PHASE_2_12_TRIAL_BALANCE_LOADER_ROLLOUT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_12_TRIAL_BALANCE_LOADER_ROLLOUT_PLAN.md) |
| Phase 2.12 production loader ON | **DONE** @ 2026-06-26T16:27:00Z — Trial Balance unified main |
| Phase 2.12 production QA | **PASS WITH WAIVERS** — [`phase-2-12-trial-balance-loader/`](../reports/single-core-ledger/phase-2-12-trial-balance-loader/) |
| Phase 2.12X closeout | **PASS** — [`phase-212-closeout-monitoring.md`](../reports/single-core-ledger/phase-2-12-trial-balance-loader/phase-212-closeout-monitoring.md) @ 2026-06-26 |
| DIN CHINA `unified_ledger_loader_trial_balance` | **ON** @ 2026-06-26T16:27:00Z — Trial Balance unified main live |
| Phase 2.9A-6 gate confirmation | **Gate 4 PASS**; Gates 1–3 **PASS** (browser 2026-06-25) |
| Phase 2.9A-7 operator gate sign-off | **PASS** 2026-06-25T17:19:46Z — [`phase-2.9a-7-gate-signoff.json`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa/phase-2.9a-7-gate-signoff.json) |
| Phase 2 screen wiring | **COMPLETE** — all planned preview toggles shipped; engine enablement separate |

---

## Phase timeline (step by step)

### Phase 1.5 — Clone validation (complete)

| Step | What | Evidence |
|------|------|----------|
| 1.5.1 | Apply Phase 1.5 migrations on clone | `scripts/single-core-ledger/apply-phase-15-docker-exec.sh` |
| 1.5.2 | Unified diagnostics + tie-out on clone | [`SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_5_SYSTEMWIDE_VERIFICATION_REPORT.md) |

### Phase 1.6 — Clone remediation (complete)

| Step | What | Rows |
|------|------|-----:|
| 1.6.1 | Payment `contact_id` backfill on clone | 74 |
| 1.6.2 | Branch auto `branch_id` on clone | 2 |
| 1.6.3 | Inventory + dry-run reports | `reports/single-core-ledger/remediation-*` |

See: [`SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_1_6_REMEDIATION_PLAN.md)

### Phase 1.6.1 — Manual branch resolution (complete)

| Step | What | Rows |
|------|------|-----:|
| 1.6.1.1 | Operator branch decisions (6 JEs) | 6 |
| 1.6.1.2 | Gate A after manual apply | **PASS** |

See: [`SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md`](SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md)

### Phase 1.6.2 — Fresh clone + approval pack (complete)

| Step | What | Status |
|------|------|--------|
| 1.6.2.1 | Fresh prodcheck clone from live `postgres` | `ledger_stage_20260623_prodcheck` |
| 1.6.2.2 | Re-run 1.5 + 1.6 + 1.6.1 on fresh clone | Gate A **PASS** |
| 1.6.2.3 | Baseline comparison vs original snapshot | **APPROVE_MANIFEST** |
| 1.6.2.4 | Production approval manifest export | 82 rows |
| 1.6.2.5 | Apply stub + guards (no prod execution) | Scripts only |

See: [`SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md)

### Finance sign-off pack (complete)

| Step | What | Status |
|------|------|--------|
| F.1 | Finance review CSV created | [`finance-signoff-production-remediation-2026-06-23.csv`](../reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv) |
| F.2 | Finance pack document | [`SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md`](SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md) |
| F.3 | All 82 rows marked `APPROVED` | 2026-06-23 (operator bulk approval) |
| F.4 | Rejected rows | **0** |

### Pre-apply backup (complete)

| Step | What | Value |
|------|------|-------|
| B.1 | VPS `pg_dump` (read-only) | 2026-06-23T19:24:08Z |
| B.2 | `PRODUCTION_BACKUP_ID` | `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` |
| B.3 | Verified | `pg_restore --list` OK (3489 TOC entries) |

See: [`SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md`](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) § Backup record

### Production metadata apply (complete)

| Step | What | Result |
|------|------|--------|
| P.1 | Guarded apply on live `postgres` | **82 rows** updated |
| P.2 | Payment `contact_id` | **74** |
| P.3 | Branch `branch_id` (auto + manual) | **8** (2 + 6) |
| P.4 | GL amounts / journal lines | **Unchanged** |
| P.5 | Skipped rows | **0** |

| Artifact | Path |
|----------|------|
| Audit JSON | `reports/single-core-ledger/production-remediation-apply-audit-2026-06-23T19-33-16-625Z.json` |
| Before JSON | `reports/single-core-ledger/production-remediation-apply-before-2026-06-23T19-33-16-625Z.json` |
| After JSON | `reports/single-core-ledger/production-remediation-apply-after-2026-06-23T19-33-16-625Z.json` |
| Pre-apply backup | `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` |
| Apply timestamp (UTC) | `2026-06-23T19:33:16.625Z` |

### Post-apply validation (complete)

| Check | Result |
|-------|--------|
| Fresh clone from post-apply `postgres` | `ledger_stage_20260623_prodcheck` (recreated) |
| Payment contact gaps | **0** |
| Branch attribution risk | **0** |
| Gate A strict diagnostics | **PASS** 3/3 |
| Tie-out | **PASS** 9/9 |
| Post-apply inventory | `remediation-inventory-2026-06-23T19-33-37-224Z.json` |
| Post-apply diagnostics | `diagnostics-2026-06-23T19-33-37-532Z.json` |

---

## Production remediation manifest

| Field | Value |
|-------|-------|
| JSON | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.json` |
| CSV | `reports/single-core-ledger/production-remediation-approval-2026-06-23T18-13-59-582Z.csv` |
| Finance CSV | `reports/single-core-ledger/finance-signoff-production-remediation-2026-06-23.csv` |
| Manifest SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Payment contact backfill | **74** |
| Branch auto | **2** |
| Branch manual | **6** |
| **Total metadata rows** | **82** |
| Finance approved | **82** |
| Finance rejected | **0** |

**Metadata columns only:** `payments.contact_id`, `journal_entries.branch_id` — no GL amounts, no void/reverse.

---

## Phase 1.7 — Smoke test + Phase 1.5 migration approval pack (complete)

| Step | What | Status |
|------|------|--------|
| 1.7.1 | Production smoke test report | **PASS** 10/10 — [`SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md`](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) |
| 1.7.2 | Phase 1.5 production migration plan | [`SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md) |
| 1.7.3 | Production Phase 1.5 guards + apply script | `production-phase-15-env-guard.mjs`, `apply-phase-15-production-docker-exec.sh` |
| 1.7.4 | Post-metadata pre-migration backup | `/root/NEWPOSV3/backups/supabase_db_20260623_194317.dump` |
| 1.7.5 | Guarded Phase 1.5 apply on `postgres` | **NOT EXECUTED** — await operator approval |
| 1.7.6 | Post-migration Gate A + tie-out on prod/clone | **PASS** @ 1.8 — `ledger_stage_20260625_prodcheck` |

**Pre-flight note (2026-06-23):** Live `postgres` already has all 4 Phase 1.5 files in `schema_migrations` and **5/5** unified RPCs. Guarded apply is idempotent (`[SKIP]`).

**Branch:** `feature/single-core-ledger-phase-1-7-prod-migration-plan`

### Phase 1.8 — Formal post-migration revalidation (complete)

| Step | What | Status |
|------|------|--------|
| 1.8.1 | Production read-only verify | **PASS** — 4/4 migrations, 5/5 RPCs, engine OFF |
| 1.8.2 | Fresh clone from live `postgres` | `ledger_stage_20260625_prodcheck` |
| 1.8.3 | Read-only inventory | Payment gaps **0**, branch risk **0** |
| 1.8.4 | Gate A strict diagnostics | **PASS** 3/3 |
| 1.8.5 | Tie-out (pilot + all-company) | **PASS** 9/9 |
| 1.8.6 | MR JALIL balance | **PKR 216,300.00** |
| 1.8.7 | Production DB mutation | **None** |

See: [`SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md`](SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md)

**Branch:** `feature/single-core-ledger-phase-1-8-post-migration-validation`

### Phase 2 — Screen wiring + controlled rollout (complete — historical)

> Historical section retained for timeline only. Preview wiring shipped in Phases 2.1–2.7; DIN CHINA engine + all five unified loaders are **live** as of Phase 2.15–2.16.

| Step | What | Status |
|------|------|--------|
| 2.0.1 | Rollout plan document | [`SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md) |
| 2.0.2 | Screen inventory + wiring order | Defined — 15 screens, PRs 2.1–2.10 |
| 2.0.3 | Feature flag + pilot design | Documented — engine OFF by default at plan time |
| 2.1+ | Preview wiring implementation | **COMPLETE** — shipped Phases 2.1–2.7; DIN CHINA loaders live 2.10–2.15 |

**Branch (historical):** `feature/single-core-ledger-phase-2-rollout-plan`

---

## What remains blocked / optional next phases

> **DIN CHINA is closed.** Items below are **program-level** future work — not DIN CHINA rollout blockers.

| Action | Status |
|--------|--------|
| DIN CHINA unified rollout (five loaders) | **COMPLETE and stable** — Phase 2.16 PASS |
| Phase 2.17 release governance | **COMPLETE** |
| PR / merge to `main` (PR #21) | **COMPLETE** @ 2026-06-27 |
| Master remaining roadmap | **ACTIVE** — [`master-remaining-roadmap.md`](../reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md) |
| Other-company unified loader expansion | **Blocked** until separate finance sign-off — [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md) |
| Phase 2.9A-CB / Admin Compare Cash/Bank diagnostic cleanup | **CLOSED** — shadow compare semantics clarified; not a production blocker |
| `roznamcha_payment` RPC mode (R7) | **Design-only** — no migration applied; requires separate approval — [`SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md`](SINGLE_CORE_LEDGER_R7_ROZNAMCHA_PAYMENT_RPC_DESIGN.md) |
| Legacy engine retirement (R8) | **Blocked** until all approved companies stable on unified loaders |
| Remaining Phase 2 screens (BS, P&L, Cash Flow, mobile) | **Optional future** — see Phase 2 rollout plan |

**Not blocked (live production):** `unified_ledger_engine` and all five DIN CHINA unified main loaders are **ON** — see authoritative section at top.

---

## Rollback

Full restore from:

`/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump`

Or selective reverse using `production-remediation-apply-before-*.json` from apply script output.

---

## Approval record

| Field | Value |
|-------|-------|
| Finance approved by | Operations (bulk approve all 82 rows) |
| Finance approval date | 2026-06-23 |
| Approved rows | **82** |
| Rejected rows | **0** |
| Manifest SHA256 | `fee33637fb7b344dd45c307227398a4eaf37b03472813abe28f26f109d5acbbd` |
| Backup ID | `/root/NEWPOSV3/backups/supabase_db_20260623_192408.dump` |
| Production apply executed | **Yes** — 2026-06-23T19:33:16.625Z |
| Applied rows | **82** (74 payment + 8 branch) |
| `unified_ledger_engine` (at metadata apply) | was **OFF** — now **ON** for DIN CHINA only (Stage 2.9C) |

---

## Next recommended step

1. ~~Phase 2 preview wiring (2.1–2.7)~~ **Done** — all six preview surfaces shipped  
2. ~~Phase 2.8 full preview QA pack~~ **Done** — 112/112 tests, build PASS; live UI waivers documented  
3. ~~Phase 2.9 pilot enablement plan~~ **Done** — Ledger V2 / DIN CHINA staged flag plan + rollback runbook  
4. ~~Phase 2.9A ops check (read-only)~~ **Done** — flags OFF + MR JALIL 216,300 RPC PASS  
5. ~~Phase 2.9A-2 browser check~~ **Done** — prod ERP lacks preview UI; deploy required before live session  
6. ~~Phase 2.9A-3 preview deploy~~ **Done** — `erp-frontend-preview` on VPS :3003; Kong CORS for localhost:3002  
7. ~~Phase 2.9A-4 browser waiver QA~~ **Done (limited waivers)** — smoke PASS; operator login session + staff user pending  
8. ~~Ops: Run `run-phase-29a7-operator-gate-signoff.mjs`~~ **Done** — Gates 1–4 PASS @ 2026-06-25T17:19:46Z  
9. ~~Ops: Stage 1 `unified_ledger_pilot` SQL~~ **Done** @ 2026-06-25T17:28:52Z — see [`stage-1-execution-notes.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-stage-1/stage-1-execution-notes.md)  
10. ~~Soak: 24h DIN CHINA monitoring~~ **Accelerated waiver PASS** @ 2026-06-25T17:54:04Z — see [`stage-1-accelerated-soak-waiver.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-stage-1/stage-1-accelerated-soak-waiver.md)  
11. ~~Ops: Stage 2 flag SQL~~ **Done** @ 2026-06-25T18:05:23Z — `unified_ledger_engine` + `screen_ledger_v2` only — see [`stage-2-execution-notes.md`](../reports/single-core-ledger/phase-2-9-pilot-enablement/post-stage-2/stage-2-execution-notes.md)  
12. ~~Ops: Stage 2 soak monitoring~~ **Done (accelerated waiver)** @ 2026-06-25T18:39:31Z  
13. ~~Phase 2.10 loader swap planning~~ **Done** — plan Status A; see [`SINGLE_CORE_LEDGER_PHASE_2_10_LEDGER_V2_LOADER_SWAP_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_10_LEDGER_V2_LOADER_SWAP_PLAN.md)  
14. ~~Phase 2.10G production loader ON~~ **Done** @ 2026-06-26T13:56:26Z — unified main live for DIN CHINA Ledger V2 only  
15. ~~Phase 2.11 Account Statement loader ON~~ **Done** @ 2026-06-26T14:59:46Z — unified main live for DIN CHINA Account Statement only  
16. ~~Phase 2.13 Party Ledger loader ON~~ **Done** @ 2026-06-26 — `a7a4b727`
17. ~~Phase 2.15 Roznamcha parity + loader ON~~ **Done** @ 2026-06-26 — `b8b093f7` — see [`SINGLE_CORE_LEDGER_PHASE_2_15_CASH_BANK_PARITY_AND_ROZNAMCHA_RECOVERY_PLAN.md`](SINGLE_CORE_LEDGER_PHASE_2_15_CASH_BANK_PARITY_AND_ROZNAMCHA_RECOVERY_PLAN.md)
18. ~~Phase 2.15X closeout + 24h monitoring pack~~ **Done** @ 2026-06-26
19. ~~Phase 2.16 production monitoring + automation hardening~~ **Done** @ 2026-06-27 — see [`phase-2-16-monitoring/`](../reports/single-core-ledger/phase-2-16-monitoring/)
20. ~~Phase 2.17 release governance (PR/merge pack)~~ **Done** @ 2026-06-27 — see [`phase-2-17-release-governance/`](../reports/single-core-ledger/phase-2-17-release-governance/)
21. ~~Phase 2.17X PR/main merge preflight cleanup~~ **Done** @ 2026-06-27 — stale doc wording clarified
22. ~~Phase 2.17Y PR/main merge governance~~ **Done** @ 2026-06-27 — [`pr-governance-final.md`](../reports/single-core-ledger/phase-2-17-release-governance/pr-governance-final.md)
23. ~~Phase 2.18 main merge closure pack~~ **COMPLETE** @ 2026-06-27 — PR #21 merged; [`main-merge-complete-report.md`](../reports/single-core-ledger/phase-2-18-main-merge-closure/main-merge-complete-report.md)
24. ~~Phase 2.18 final archive~~ **COMPLETE** @ 2026-06-27 — [`final-archive-and-monitoring-report.md`](../reports/single-core-ledger/phase-2-18-main-merge-closure/final-archive-and-monitoring-report.md)
25. **Program next:** [`master-remaining-roadmap.md`](../reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md) — DIN CHINA + DIN BRIDAL complete; next company requires separate finance sign-off; R7 design-only; R8 legacy retirement blocked until all approved companies stable; periodic `MONITORING_PROFILE=din-bridal` golden verify recommended
26. Do **not** expand loader ON to other companies without separate finance sign-off — [`SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md`](SINGLE_CORE_LEDGER_COMPANY_EXPANSION_READINESS_CHECKLIST.md)
27. **Monitoring:** [`final-production-verify.md`](../reports/single-core-ledger/phase-2-16-monitoring/final-production-verify.md) (Phase 2.16 remains production truth until optional re-run)

**Final status:** `MAIN MERGE COMPLETE — DIN CHINA SINGLE CORE LEDGER CLOSED` (program continues — see master remaining roadmap)

### Accelerated soak waiver (Phase 2.9B-X — 2026-06-25) — historical

> Historical note only. Stage 2 SQL **was run** @ 2026-06-25 (engine + screen_ledger_v2). All five DIN CHINA loaders subsequently enabled 2026-06-26.

Stage 1 originally enabled only `unified_ledger_pilot`. Stage 2 subsequently enabled `unified_ledger_engine` + `screen_ledger_v2` (2026-06-25). Loaders for Ledger V2, Account Statement, Trial Balance, Party Ledger, and Roznamcha were enabled in 2.10G / 2.11 / 2.12 / 2.13 / 2.15 (2026-06-26).

| Check | Result |
|-------|--------|
| T0 soak (0h) | **PASS** @ 2026-06-25T17:42:10Z |
| Accelerated flags + browser | **PASS** @ 2026-06-25T17:54:04Z |
| Regressions | **None** |
| Stage 2 SQL | **RUN** @ 2026-06-25T18:05:23Z (historical row below referred to pre-Stage-2 checkpoint) |

## Related documents

| Document | Purpose |
|----------|---------|
| [Production remediation approval plan](SINGLE_CORE_LEDGER_PRODUCTION_REMEDIATION_APPROVAL_PLAN.md) | Full approval + backup + apply procedure |
| [Finance sign-off pack](SINGLE_CORE_LEDGER_FINANCE_SIGNOFF_PACK.md) | Finance-readable scope and checklist |
| [Fresh clone validation (1.6.2)](SINGLE_CORE_LEDGER_PHASE_1_6_2_FRESH_CLONE_VALIDATION_REPORT.md) | Prodcheck evidence |
| [Phase 1.6.1 branch manual](SINGLE_CORE_LEDGER_PHASE_1_6_1_BRANCH_MANUAL_REVIEW.md) | 6 manual branch JEs |
| [Smoke test report (1.7)](SINGLE_CORE_LEDGER_PRODUCTION_SMOKE_TEST_REPORT.md) | Production smoke 10/10 |
| [Phase 1.5 production migration plan](SINGLE_CORE_LEDGER_PHASE_1_5_PRODUCTION_MIGRATION_PLAN.md) | Migration approval pack |
| [Phase 1.8 post-migration validation](SINGLE_CORE_LEDGER_PHASE_1_8_POST_MIGRATION_VALIDATION_REPORT.md) | Gate A + tie-out PASS |
| [Phase 2 rollout plan](SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md) | Screen wiring + controlled engine rollout |
| [Phase 2.8 preview QA sign-off](SINGLE_CORE_LEDGER_PHASE_2_8_PREVIEW_QA_SIGNOFF.md) | Cross-screen QA + parity evidence |
| [Phase 2.9 pilot enablement plan](SINGLE_CORE_LEDGER_PHASE_2_9_PILOT_ENABLEMENT_PLAN.md) | DIN CHINA Ledger V2 staged flags + rollback |
| [Phase 2.10 Ledger V2 loader swap plan](SINGLE_CORE_LEDGER_PHASE_2_10_LEDGER_V2_LOADER_SWAP_PLAN.md) | Stage 3 default loader swap — **LIVE for DIN CHINA** |
| [Phase 2.9A-CB Cash/Bank parity plan](SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md) | Roznamcha vs unified GL — optional diagnostic track |
| [Master remaining roadmap](../reports/single-core-ledger/master-roadmap-after-din-china-closure/master-remaining-roadmap.md) | Post–DIN CHINA program phases (pending/optional/blocked) |
| [Phase 2.9A-3 preview deploy plan](SINGLE_CORE_LEDGER_PHASE_2_9A3_PREVIEW_DEPLOY_PLAN.md) | Parallel :3002 preview container for browser QA |
