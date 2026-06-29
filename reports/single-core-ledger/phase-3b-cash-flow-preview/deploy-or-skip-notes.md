# Deploy or skip notes — Phase 3B

**Decision:** DEPLOY NOT RUN — operator approval required

---

## Rationale

Runtime source files changed (Cash Flow page + preview panel). Per program rules, production deploy requires explicit operator approval after tests/build pass.

---

## Pre-deploy checklist (when approved)

- [ ] `npm run test:unified-ledger` PASS
- [ ] `npm run build` PASS
- [ ] `ssh dincouture-vps` + `deploy/vps-build-erp-only.sh`
- [ ] Verify preview toggle on https://erp.dincouture.pk Cash Flow tab
- [ ] Post-deploy `npm run monitor:three-company-unified-ledger` PASS
- [ ] No migrations, no flags

---

## Skip deploy (current)

Office PC implementation complete; evidence committed to `main`. Production unchanged until operator approves deploy.
