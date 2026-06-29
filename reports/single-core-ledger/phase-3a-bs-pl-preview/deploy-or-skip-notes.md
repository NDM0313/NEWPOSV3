# Deploy decision — Phase 3A

**Decision:** DEPLOY NOT RUN — requires operator approval because runtime UI preview code changed.

## Rationale

- New admin/developer-only preview panels on Balance Sheet and P&L pages
- No change to default staff view or legacy totals
- Safe to deploy when operator approves VPS/web deploy
- Not auto-deployed per production ops mode

## Pre-deploy checklist

- [ ] `npm run test:unified-ledger` PASS
- [ ] `npm run build` PASS
- [ ] Operator approves deploy
- [ ] Post-deploy: verify preview toggle visible only for admin/developer
- [ ] Post-deploy: verify staff BS/P&L unchanged

## Monitoring

Continue `npm run monitor:three-company-unified-ledger` — five live loaders unchanged.
