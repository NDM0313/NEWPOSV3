# Deploy or skip — Phase 3B-F

| Item | Decision |
|------|----------|
| Runtime preview diagnostic UI | **CHANGED** |
| Deploy | **NOT RUN — operator approval required** |
| Reason | `CashFlowUnifiedPreviewPanel` export wiring + row-keyed JSON |

## Operator action

Approve deploy of Phase 3B-F to production, then:

1. Smoke: Cash Flow page loads; preview OFF by default; export only when preview ON + role allowed.
2. Export row-keyed JSON for DIN CHINA and DIN BRIDAL.
3. Update finance rule confirmation pack with bucket evidence.

## Skip deploy if

Operator chooses to validate on staging/local only first.
