# R8-R2 Final Merge Checklist (production)

Use this **only** on/after **2026-08-09** with operator approval. Do not merge rehearsal runtime before gates pass.

## Pre-merge gates (all required)

- [ ] Calendar date ≥ **2026-08-09** (soak from R8-R1 start 2026-07-10)
- [ ] Exact operator approval phrase: **`R8_R2_CODE_DELETION_APPROVAL_REQUIRED`**
- [ ] Fresh **production** kill-switch operator drill PASS (not local static)
- [ ] Fresh three-company monitoring PASS
- [ ] Rebase `rehearsal/r8-r2-legacy-deletion-20260715` onto latest `main`
- [ ] Repeat `npm run test:unified-ledger` · `npm run test:unit` · `npm run build` · `git diff --check`
- [ ] Inspect `git diff main...HEAD` — only approved deletion + shadow retarget + tests/docs
- [ ] Create production rollback tag: `r8-r2-pre-code-deletion-YYYYMMDD` on pre-merge main tip
- [ ] Confirm BS/P&L still deferred unless separate mini-approval
- [ ] Confirm no migrations / Contacts / mobile / AR/AP basis / kill toggle / GL mutation in the PR

## Merge + deploy

- [ ] Merge rehearsal runtime into `main` (PR preferred)
- [ ] Deploy **frontend only** (`erp-frontend`) — no DB migration
- [ ] Post-deploy three-company monitoring PASS
- [ ] Spot-check AS / TB / Party / Roznamcha / LV2 / Cash Flow load unified
- [ ] Confirm kill still OFF in production

## Rollback on failure

- [ ] Do **not** rely on L1 flags alone to restore deleted page branches
- [ ] Checkout production pre-delete tag **or** revert merge commit
- [ ] Redeploy frontend
- [ ] Re-run monitoring
- [ ] Leave kill switch policy per runbook (fail-closed pages if kill ON after merge)

## Out of scope on merge day

- Physical deletion of retained shadow/hybrid/Contacts/mobile/resolvers/flags/kill/L1 SQL
- Play Store upload
- FX / multi-currency app
- Graphify
