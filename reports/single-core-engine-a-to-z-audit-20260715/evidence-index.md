# Evidence Index

**Audit date:** 2026-07-15

| Phase / track | Date | Report path | Doc path | Commit | Production proof | Validation |
|---------------|------|-------------|----------|--------|------------------|------------|
| R8-R1 | 2026-07-10 | `reports/r8-legacy-retirement-execution-20260710/` | closeout / R8 docs | `bc4528e5` | flags ON (reconfirmed) | COMPLETE |
| R8-R1 watch | 2026-07-10 | `reports/r8-r1-post-retirement-watch-20260710/` | — | `b7fa557d` era | flag snapshot | COMPLETE |
| Calendar Days 7–15 | 2026-07-06…08 | `reports/single-core-engine-calendar-stability-official-*` | Days 7–12 / 13–15 summaries | `6e179412`…`4665334b` | — | COMPLETE |
| Salesman extended QA | 2026-07-11 | `reports/salesman-extended-qa-pixel-rows-4-20-20260711/` | Play Store readiness | `74e357f6` | device | PASS |
| DIN CHINA Phase 2.16 | 2026-07-12 | `reports/din-china-phase-216-golden-refresh-20260712/` | gates/closeout | `8bbb01f0` | fixtures | PASS (dated) |
| AR/AP 2b wireup | 2026-07-12 | `reports/ar-ap-phase-2b-unified-wireup-20260712/` | AR_AP doc | `75c12cd7` | — | Dev complete |
| AR/AP 2b production | 2026-07-12 | `reports/ar-ap-phase-2b-production-rollout-20260712/` | closeout | `c20672c3` | RPC live; bridal FAIL live | NOT COMPLETE |
| Closeout final | 2026-07-12 | — | `SINGLE_CORE_ENGINE_CLOSEOUT_FINAL_2026-07-12.md` | `c20672c3` | — | PARTIAL (see flags) |
| Approval gates | 2026-07-11/12 | `reports/old-erp-remaining-readiness-closeout-20260711/` | `OLD_ERP_REMAINING_APPROVAL_GATES_2026-07-11.md` | `8bbb01f0` | — | Stale in places |
| A-to-Z audit (this) | 2026-07-15 | `reports/single-core-engine-a-to-z-audit-20260715/` | `SINGLE_CORE_ENGINE_A_TO_Z_AUDIT_2026-07-15.md` | pending | VPS=`5cf65f4c` | THIS PACK |

## Flags

| Issue | Detail |
|-------|--------|
| Missing evidence | `reports/r8-r2-kill-switch-drill-20260712/` |
| Missing evidence | `reports/sales-revenue-phase2-closeout-20260712/` |
| Missing evidence | `reports/supplier-party-discount-je-posting-qa-20260712/` |
| Duplicate / stale docs | Older masters still say R8/Salesman BLOCKED |
| Contradictory | Kill-switch drill PASS (closeout) vs NOT DONE (readiness plan) vs missing folder |
| Stale HEAD refs | Office VPS `84eb1363` superseded by live `5cf65f4c` |
| Outdated complete claims | Closeout unit 189 ≠ current 183 |
| Encoding | Some scripts show mojibake in comments; not blocking |

## Authority order for status

1. This A-to-Z pack (2026-07-15) + live VPS/RPC checks
2. Dated evidence folders that exist in git
3. Closeout 2026-07-12 (except claims lacking folders)
4. Older masters as history only
