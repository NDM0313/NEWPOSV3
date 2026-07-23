# Rollback and safety notes — Phase 3B-F

## Scope

Preview-only diagnostic export. No database, flag, or GL changes.

## Rollback

1. Revert commit introducing Phase 3B-F runtime files if deploy causes issues.
2. Redeploy prior ERP build (`deploy/vps-build-erp-only.sh`).
3. Legacy Cash Flow continues unchanged regardless — export is preview-gated.

## Safety guarantees

- `compareCashFlowUnifiedPreview` summary totals unchanged
- Export button visible only to allowed preview roles
- Export JSON redacts credential-like keys
- No migrations, no loader flags

## If export totals differ from preview panel

Stop and file a bug — do not adopt unified totals as official without separate approved fix phase.
