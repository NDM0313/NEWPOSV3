# Branch Audit Report – SAFE AUDIT MODE

**Date:** 2026-02-16  
**Mode:** Audit only. No merge. No destructive operations.

---

## STEP 1 – Branch Analysis

### Commits only in `before-mobile-replace` (19)

```
2cb1042 Add mobile app (erp-mobile-app), task status doc, deploy scripts; fix products guard
08737fd Fix nginx: remove proxy_ssl (not allowed in Alpine), keep proxy_ssl_verify off
10cb94f Deploy: retry build up to 3x on Docker Hub TLS timeout
923a931 Deploy: retry up if container not running, show logs; add vps-ensure-erp-up.sh for cron
ea75078 Fix container crash: nginx upstream use IP only; deploy show logs if container not running
e95f83d dockerignore: exclude .env so build uses only erp.dincouture.pk from build-args
b676792 Proxy: use host.docker.internal for Kong, extra_hosts; doc Local/GitHub/VPS vs Supabase link
43561f9 Same-origin API: nginx proxy /auth /rest /realtime /storage to Kong, build with erp.dincouture.pk
36088bc Fix: vps-supabase-fix-fetch syncs repo first (fetch+reset), one-liner when pull blocks
6467830 Fix Failed to fetch: VPS script for Supabase SITE_URL/redirect, doc, login error message
080fb15 Windows: hosts fix PowerShell script + Chrome Secure DNS note
ebf80f5 DNS fix: hosts workaround to use app now, vps-dns-verify script, FIX_ERP_DOMAIN_NOW doc
f09eb90 Deploy: auto-attach Traefik to dokploy-network; diagnose fix; DNS NXDOMAIN note
2e32ceb erp.dincouture.pk: Traefik network label, diagnose script, deploy auto-creates network + runs diagnose
45154ec deploy script: use fetch+reset instead of pull to avoid divergent-branch error
f461062 VPS: bootstrap + one-line deploy when script missing (fetch/reset branch then deploy)
5bbdab5 ERP VPS: deploy script, nginx SPA, favicon, Supabase placeholder, erp.dincouture.pk routing + docs
7a76661 docs: TASKS_STATUS.md - add GitHub section, complete vs remaining tasks
89891e5 Release v1.0.0: QA docs, VPS hardening, Supabase self-host plan, TASKS_STATUS.md
```

**Summary:** VPS deploy (Docker, nginx, Traefik, erp.dincouture.pk), Supabase “Failed to fetch” fix, Windows hosts/DNS workaround, **erp-mobile-app** (full standalone app), task status docs, deploy-via-ssh scripts.

### Commits only in `main` (4)

```
408b435 feat: Figma-style mobile design - MobileNavDrawer, compact header, improved BottomNav
04e97be Add fix-n8n-504.sh, ssl-n8n-activation.sh, SSH_QUICK_GUIDE.md
cb44412 Add TASKS_STATUS.md, deploy scripts, responsive fixes, test pages
55a336d Phase 3 complete: backupService fix, lazy loading, .env.example, build verified
```

**Summary:** Web-app mobile UX (MobileNavDrawer, BottomNav, header), deploy/SSL/n8n scripts in `deploy/`, TASKS_STATUS, responsive/test pages (CutoverPrep, Day4, RLSValidation, ResponsiveTest, ERPIntegration), Phase 3 hardening.

### Counts

| Branch | Unique commits (not in other) |
|--------|-------------------------------|
| **before-mobile-replace** | 19 |
| **main** | 4 |

---

## STEP 2 – Code-Level Difference (git diff main..before-mobile-replace --stat)

**Total:** 390 files changed, **+82,548** / **-5,038** lines (diff is “what before-mobile-replace has vs main”).

### Key areas

| Area | In before-mobile-replace (vs main) |
|------|-------------------------------------|
| **erp-mobile-app/** | **Present** – full Vite+React app (auth, branches, Products, Contacts, Sales, POS, Purchase, Reports, Settings). **Absent on main.** |
| **mobile-design/** | **Present** – Figma-style docs, UI kit, design imports. **Absent on main.** |
| **deploy/** | **Removed** on before-mobile-replace – main has deploy/ (Caddy, DNS, Docker, RLS, backup, etc.). before-mobile-replace uses **root-level** Dockerfile, docker-compose.prod.yml, nginx.conf. |
| **Backend / core logic** | ProductsPage guard (undefined map), SalesPage getSaleStatusBadge fallback, purchaseService users FK hint – **only on main** (recent fixes). before-mobile-replace has older SalesPage/ProductsPage/purchaseService. |
| **Cancel-related** | No dedicated cancellationService on either branch. DB cancel RPCs in migrations; void sale/purchase return in services. **No branch-specific cancel logic** in this diff. |
| **Sales/Purchase** | main: SalesPage + purchaseService fixes (badge, PGRST201). before-mobile-replace: no these fixes; has erp-mobile-app Sales/POS/Contacts. |
| **Migrations** | main: deploy/ and app code only, no extra migrations in diff. before-mobile-replace: **adds** supabase-extract/migrations 43, 44, 45 (companies_finalization, rental_status_enum, get_customer_ledger_rentals_rpc). main may already have same or different migration set. |
| **Layout / UI** | main: MobileNavDrawer, compact header, BottomNav. before-mobile-replace: **removes** MobileNavDrawer; different Layout/BottomNav/App. |
| **Test pages** | main: CutoverPrepPage, Day4FullFlowCertificationPage, ERPIntegrationTestBlockPage, RLSValidationPage, ResponsiveTestPage. before-mobile-replace: **removes** these. |
| **Scripts** | before-mobile-replace: scripts/deploy-via-ssh.ps1|sh, deploy-erp-vps.sh, vps-*, windows-hosts-fix.ps1, erp-traefik-register. main: deploy/ scripts (different set). |
| **Docs** | before-mobile-replace: many root + docs/ (VPS_SSH, FIX_FAILED_TO_FETCH, TASK_MOBILE_AND_PRODUCTION, PROJECT_DELIVERY_SUMMARY, etc.). main: deploy/*.md, docs/RESPONSIVE_CHECKLIST, TASKS_STATUS. |

### Backend logic differences

- **ProductsPage:** main has guard for undefined data/overviewRows; before-mobile-replace may not.
- **SalesPage:** main has getSaleStatusBadge fallback for unknown status; before-mobile-replace does not (causes runtime error).
- **purchaseService:** main has `users!purchases_created_by_fkey` to fix PGRST201; before-mobile-replace does not (purchases load can fail).
- **Supabase/config:** before-mobile-replace has supabase.ts and config tuned for VPS/erp.dincouture.pk; main may differ.

### Mobile folder

- **before-mobile-replace:** `erp-mobile-app/` (real app) + `mobile-design/` (design/docs).
- **main:** Neither folder; mobile UX is inside main app (MobileNavDrawer, BottomNav).

### Migrations

- before-mobile-replace **adds** (vs main in this diff): `43_companies_finalization.sql`, `44_rental_status_enum_alignment.sql`, `45_get_customer_ledger_rentals_rpc.sql`. Whether main already has these in its tree depends on merge history; diff shows them as “in before-mobile-replace”.

---

## STEP 3 – Risk Classification

| Category | Contents | Risk |
|----------|----------|------|
| **A) Critical business logic** | SalesPage badge (crash), purchaseService embed (load fail), ProductsPage guard. **main has fixes; before-mobile-replace does not.** Merging main → before-mobile-replace would bring fixes; merging before-mobile-replace → main without bringing main’s fixes would regress. | **High** if main is overwritten by before-mobile-replace without incorporating main’s fixes. |
| **B) UI only** | MobileNavDrawer, BottomNav, Layout, test pages. main has newer web mobile UI; before-mobile-replace has different layout and no MobileNavDrawer. | **Medium** – different UX and test coverage. |
| **C) Deployment / infra** | before-mobile-replace: root Dockerfile, nginx.conf, docker-compose.prod.yml, deploy-erp-vps.sh, deploy-via-ssh, vps-* scripts. main: deploy/ folder (Caddy, n8n, swarm, etc.). Different deployment paths. | **High** – two different deploy models; merging blindly can break one or the other. |
| **D) Obsolete / experimental** | mobile-design/ (large Figma/design artifact set). erp-mobile-app is a real app but separate from main web app. | **Low** for audit; **medium** for merge (large surface, possible duplication with main’s mobile UX). |

---

## STEP 4 – Merge Feasibility

### Recommendation: **NEED MANUAL REVIEW** (do not auto-merge)

**Reasons:**

1. **Divergent structure**  
   - main = single web app + mobile UX inside app + deploy/ folder.  
   - before-mobile-replace = same web app + **separate** erp-mobile-app + **different** deploy (root Dockerfile/nginx) and **no** deploy/ folder.  
   Full merge in either direction would overwrite one structure with the other unless carefully reconciled.

2. **Critical fixes only on main**  
   SalesPage getSaleStatusBadge and purchaseService users FK (and ProductsPage guard) exist on main. Merging before-mobile-replace into main without bringing these into the merged result would reintroduce crashes and purchase load failure.

3. **Two deployment models**  
   main’s deploy/ vs before-mobile-replace’s root-level deploy. Merging one into the other without a clear “production” choice can break VPS or local expectations.

4. **Mobile strategy**  
   - main: mobile inside main app (MobileNavDrawer, etc.).  
   - before-mobile-replace: standalone erp-mobile-app + mobile-design.  
   Decision needed: keep both, or choose one and migrate features.

### Alternative: **CHERRY-PICK RECOMMENDED**

- To bring **VPS/deploy + erp-mobile-app** into main: cherry-pick or apply selected commits from before-mobile-replace (e.g. erp-mobile-app add, deploy scripts, nginx/Dockerfile), then **re-apply** main’s SalesPage, purchaseService, and ProductsPage fixes on top.
- To bring **main’s fixes** into before-mobile-replace: cherry-pick or apply only the commits that add SalesPage badge fallback, purchaseService FK, and ProductsPage guard.

### Do not

- **DO NOT** run a full merge (main ↔ before-mobile-replace) without a written plan and manual conflict resolution.
- **DO NOT** delete either branch until the chosen strategy (merge vs cherry-pick, which deploy, which mobile) is decided and applied.

---

## STEP 5 – Protection Layer

### Safety tag (recommended)

Create a tag on **main** so you can always return to this state:

```bash
git checkout main
git tag audit-safe-point
git push origin audit-safe-point
```

- **No destructive operation** is performed by this audit.
- **No merge** has been run.
- Tag is optional; create only if you want a named restore point.

### Rules followed

- No destructive merge.
- No auto-merge.
- No branch deletion.
- Report only; all operations are read-only except the optional tag above (and that only if you run it).

---

## Final Structured Audit Summary

| Item | Value |
|------|--------|
| **Current default branch** | main (production-like) |
| **before-mobile-replace** | 19 commits ahead, 4 behind main |
| **Unique commits in before-mobile-replace** | 19 |
| **Unique commits in main** | 4 |
| **Files changed (diff stat)** | 390 (+82,548 / -5,038) |
| **Critical logic** | main has SalesPage/purchaseService/ProductsPage fixes; before-mobile-replace does not |
| **Mobile** | main = in-app mobile UX; before-mobile-replace = erp-mobile-app + mobile-design |
| **Deploy** | main = deploy/ folder; before-mobile-replace = root Dockerfile + nginx + scripts |
| **Merge recommendation** | **NEED MANUAL REVIEW** – do not auto-merge; consider cherry-pick for selected changes |
| **Safety tag** | Optional: `git tag audit-safe-point` on main, then `git push origin audit-safe-point` |

**Conclusion:** Treat branches as **divergent**. Decide target (main vs before-mobile-replace or a new branch), then either cherry-pick specific commits or perform a planned merge with full conflict resolution and re-application of main’s critical fixes. No automatic merge or destructive action has been or will be taken in this audit.
