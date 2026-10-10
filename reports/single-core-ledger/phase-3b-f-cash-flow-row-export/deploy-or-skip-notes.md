# Deploy or skip — Phase 3B-F

| Item | Decision |
|------|----------|
| Runtime preview diagnostic UI | **CHANGED** |
| Deploy | **COMPLETE** @ 2026-06-29 (`5433ac2c`) |
| Evidence | [`production-deploy-notes.md`](production-deploy-notes.md) · [`post-deploy-smoke.md`](post-deploy-smoke.md) · [`production-row-export-capture.md`](production-row-export-capture.md) |

## Completed post-deploy

1. Smoke: **PASS** — preview OFF by default; Export row-keyed JSON visible when preview ON
2. Row-keyed exports captured for **DIN CHINA** and **DIN BRIDAL**
3. Diff reports in `diff-reports/din-china/` and `diff-reports/din-bridal/`
4. Finance rule confirmation pack updated with bucket evidence

## Still blocked

- Cash Flow loader swap until finance approval
- BS/P&L finance **PENDING**; R7/R8/next company **BLOCKED**
