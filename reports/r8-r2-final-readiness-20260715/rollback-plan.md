# R8-R2 Rollback Plan (future deletion)

**Do not create production pre-deletion tag on 2026-07-15.**
Real tag must point at the exact production-ready commit on execution day.

Suggested tag format: `r8-r2-pre-code-deletion-20260809`
(Adjust date suffix if execution slips; never backdate.)

---

## L0 — Kill switch

| Item | Detail |
|------|--------|
| Behavior | Kill ON → resolvers select `legacy` (or fail-closed post-deletion if page branches removed) |
| After R8-R2 deletion of page legacy branches | L0 alone may **not** restore prior UX — prefer **L1 flags** first; keep L0 for engine hard-stop |
| Activation | Approved DB toggle only; operator present |
| Data impact | None |

---

## L1 — Loader flag rollback SQL

| Item | Detail |
|------|--------|
| Purpose | Turn unified loader/screen flags OFF for three companies without touching GL |
| Scripts | Under `scripts/single-core-ledger/` (~36 rollback-related files), including phase-210…214, company `r5-`/`dc-`, CF phase-3b-m |
| Rules | Read script before apply; no JE/account mutations; service-role ops path only |
| Expected restore time | Minutes (SQL + cache refresh) |

Exact script choice on execution day: match the screens whose flags need OFF. Prefer existing named rollback SQL; do not invent ad-hoc UPDATE against accounts.

---

## L2 — Git + deploy

| Item | Detail |
|------|--------|
| Pre-deletion tag | `r8-r2-pre-code-deletion-20260809` (or actual exec date) on commit that is production-ready **before** deletion commit |
| Rollback commit | Checkout tag / revert deletion commit on `main` |
| Deploy | Frontend only: `deploy/vps-build-erp-only.sh` (or current approved ERP-only path) via `ssh dincouture-vps` |
| Health | HTTP 200; erp-frontend healthy; `VITE_BUILD_COMMIT` matches rollback commit |
| Monitoring | `npm run monitor:three-company-unified-ledger` PASS ×3 |
| Decision owner | Nadeem Khan / ERP ops owner |
| Expected restoration time | ~15–45 minutes (tag checkout + build + health + monitor) |

---

## Decision tree after bad R8-R2 deploy

1. Confirm frontend unhealthy or wrong commit → L2 rebuild prior tag
2. Flags wrong but app healthy → L1 SQL
3. Emergency stop unified engine → L0 kill (knowing post-deletion legacy page may be gone) → prioritize L2
4. Never run “GL repair” as R8-R2 rollback

---

## Not used for R8-R2 rollback

- Accounting data repairs
- Journal void/reverse
- Account chart changes
- Contacts rewrite
- Mobile store rollback (out of scope)
