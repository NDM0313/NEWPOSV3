# R8-R2 Final Merge Checklist

Use before merging `rehearsal/r8-r2-legacy-deletion-20260715` (or its rebased successor) into `main` for production.

**Do not merge before 2026-08-09.**
**Do not merge without** `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.

---

## Pre-merge gates

- [ ] Calendar date ≥ **2026-08-09** (or newer written policy gate)
- [ ] Exact operator approval phrase recorded: `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
- [ ] Fresh **production** operator-attended kill-switch drill PASS (not the local static rehearsal)
- [ ] Fresh `npm run monitor:three-company-unified-ledger` PASS ×3 + loader guard PASS
- [ ] Rebase / merge-from latest `main` onto rehearsal branch
- [ ] Repeat: `npm run test:unified-ledger` · `npm run test:unit` · `npm run build` · `git diff --check`
- [ ] Inspect full diff vs `main` — only approved deletion + tests + docs
- [ ] Confirm BS/P&L fallback still deferred unless separately approved
- [ ] Confirm protected components retained (shadow, getCustomerLedger, Contacts, mobile, resolvers, flags, kill, L1 SQL, loader guard)
- [ ] Create **production** rollback tag on pre-merge commit: `r8-r2-pre-code-deletion-YYYYMMDD`

## Merge + deploy

- [ ] Merge rehearsal into `main` (PR or fast-forward after review)
- [ ] Push `main`
- [ ] Deploy **frontend only** (`deploy/vps-build-erp-only.sh` via `ssh dincouture-vps`)
- [ ] Verify HTTP 200 · erp-frontend healthy · `VITE_BUILD_COMMIT` matches
- [ ] Screen smoke: LV2, AS, TB, Party, Roznamcha, CF, BS, P&L, AR/AP Center
- [ ] Post-deploy monitoring PASS
- [ ] On failure: L2 rollback to pre-deletion tag + redeploy (do not mutate GL)

## Closeout

- [ ] Evidence pack for production execution
- [ ] Update SCE closeout: technically closed / fully retired for approved main-loader scope
- [ ] Document retained diagnostic/rollback components as intentional

## Must not combine

Contacts · mobile/Play Store · AR/AP basis · GL repairs · import-gap · graphify · unrelated WIP
