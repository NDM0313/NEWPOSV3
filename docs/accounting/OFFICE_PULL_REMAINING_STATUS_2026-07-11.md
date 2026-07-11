# Office GitHub Pull + Remaining Tasks — 2026-07-11

**Scope:** OLD ERP / DIN Collection ERP only (not FX app)  
**Machine:** Office Windows  
**Production:** https://erp.dincouture.pk

## GitHub pull

| Item | Value |
|------|--------|
| Branch | `main` |
| Pull | `git pull --ff-only origin main` — **18 commits** fast-forward |
| HEAD / origin/main | `84eb1363` |
| Working tree (pre-commit) | monitoring artifacts from post-pull verify only |

## Post-pull verification (read-only)

| Check | Result |
|-------|--------|
| Three-company monitoring | **PASS** — `three-company-monitoring-2026-07-11T07-31-35-480Z` |
| Loader guard | **PASS** |
| DIN CHINA | PASS (16/19 checks; Admin Compare 9/9) |
| DIN BRIDAL | PASS (18/19 checks) |
| DIN COUTURE | PASS (18/19 checks) |
| `npm run test:unified-ledger` | **336/336 PASS** |
| `npm run test:unit` | **182/182 PASS** |
| `npm run build` | **PASS** (standalone; PS1 runner stderr flake on vite reporter only) |
| VPS HEAD | `84eb1363` — **no redeploy required** |
| Production HTTP | **200** |
| `erp-frontend` | healthy |

Evidence: [`reports/single-core-engine-calendar-stability-office-post-pull-verify-20260711/`](../reports/single-core-engine-calendar-stability-office-post-pull-verify-20260711/)

## Remaining tasks verdict

### Complete (no further action without new operator request)

| Track | Evidence |
|-------|----------|
| Official Calendar Days 7–15 | `reports/single-core-engine-calendar-stability-official-202607*` |
| R8-R1 operational retirement | `reports/r8-legacy-retirement-execution-20260710/` |
| Post-R8 watch | `reports/r8-r1-post-retirement-watch-20260710/` |
| Sales revenue 4000 canonical (sale + return) | `reports/sales-revenue-canonical-account-correction-20260710/closeout.md` |
| VPS production deploy | HEAD matches repo; HTTP 200 |
| Salesman mobile QA (login) | `reports/mobile-salesman-qa-readiness-after-day15-20260709/salesman-role-qa-pass.md` |
| Post-pull stability verify (Day 16 sample) | this session |

### Still blocked / approval-gated

| Item | Status | Gate |
|------|--------|------|
| Play Store release | **NOT RELEASED** | Separate operator approval |
| Supplier Party Discount PKR 1 QA | **NOT APPROVED** | Explicit approval |
| R8-R2 legacy code deletion | **Not started** | Soak + kill-switch drill + written approval |
| DIN CHINA 4100→4000 historical reclass (Phase 2) | **Blocked** | `APPROVE_SALES_REVENUE_4000_4100_RECLASS_PHASE2` |
| Full Salesman checklist rows 4–20 | **Optional** | Pixel 6 Pro not connected (`adb devices` empty) |
| Created-by on old JEs backfill | **Data gap** | Audit approval |
| Unified RPC field migration | **Optional future** | Migration approval |

## Safety

| Gate | Result |
|------|--------|
| DB migrations run | **no** |
| GL mutations / repairs | **no** |
| R8-R2 code deletion | **no** |
| Play Store upload | **no** |
| Passwords committed | **no** |
| `graphify-out/` staged | **no** |

## Device note

Pixel 6 Pro **not connected** on 2026-07-11 office session. Salesman login QA already **PASS** from 2026-07-09 office session (`24281FDEE0023P`). Extended on-device checklist remains optional when device is reconnected.
