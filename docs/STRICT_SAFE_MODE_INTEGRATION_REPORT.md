# STRICT SAFE MODE – Integration Planning Report

**Date:** 2026-02-16  
**Mode:** ANALYSIS + SAFE INTEGRATION PLANNING ONLY  
**Rules:** No merge. No delete. No overwrite. No structure modification. No automatic or destructive actions.

---

## STEP 1 – PROTECTION LAYER ✅ CONFIRMED

| Action | Status |
|--------|--------|
| `git checkout main` | ✅ Already on main |
| `git tag pre-integration-safe-point` | ✅ Created |
| `git push origin pre-integration-safe-point` | ✅ Pushed to origin |
| Tag exists locally | ✅ `git tag -l "pre-integration*"` → `pre-integration-safe-point` |
| Tag exists on remote | ✅ `git ls-remote origin tag pre-integration-safe-point` → ref present |

**Safe point:** You can restore main to this state with:
`git checkout main && git reset --hard pre-integration-safe-point`

---

## STEP 2 – STRUCTURE AUDIT

### 2.1 Unique commits

**Commits only in `before-mobile-replace` (19):**
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

**Commits only in `main` (4):**
```
408b435 feat: Figma-style mobile design - MobileNavDrawer, compact header, improved BottomNav
04e97be Add fix-n8n-504.sh, ssl-n8n-activation.sh, SSH_QUICK_GUIDE.md
cb44412 Add TASKS_STATUS.md, deploy scripts, responsive fixes, test pages
55a336d Phase 3 complete: backupService fix, lazy loading, .env.example, build verified
```

### 2.2 Folder-level differences

**Summary:** `git diff main before-mobile-replace --stat`  
**Total:** 390 files changed, **+82,548** / **-5,038** lines (diff = what before-mobile-replace has vs main).

### 2.3 Specific areas

| Area | Summary |
|------|--------|
| **Backend logic** | **main** has: SalesPage `getSaleStatusBadge` fallback (avoids crash on unknown status), purchaseService `users!purchases_created_by_fkey` (fixes PGRST201), ProductsPage guard for undefined data. **before-mobile-replace** has older versions without these fixes. |
| **Sales / Purchase** | 11 files differ (SalesPage, SaleForm, ViewPaymentsModal, ViewSaleDetailsDrawer; PurchasesPage, ViewPurchaseDetailsDrawer; accountingService, backupService, customerLedgerApi, ledgerDataAdapters, NavigationContext). Net: −47 lines on before-mobile-replace side (main has more logic/fixes). |
| **Cancel logic** | No dedicated cancel-service or branch-specific cancel flows. Cancel/void behaviour lives in sale/purchase/rental services and DB; both branches touch same files but no unique “cancel-only” feature on either branch. |
| **Mobile app folder** | **before-mobile-replace only:** `erp-mobile-app/` (full Vite+React app: auth, branches, Products, Contacts, Sales, POS, Purchase, Reports, Settings) and `mobile-design/` (Figma docs, UI kit, design imports). **main:** No these folders; mobile UX is inside main app (MobileNavDrawer, BottomNav, compact header). |
| **Deployment** | **before-mobile-replace:** Root-level Dockerfile, docker-compose.prod.yml, nginx.conf; scripts: deploy-erp-vps.sh, deploy-via-ssh.*, vps-*, windows-hosts-fix.ps1, erp-traefik-register.*; docs: VPS_SSH, FIX_FAILED_TO_FETCH, DOKPLOY_ERP_TRAEFIK_SETUP, etc. **main:** deploy/ folder (Caddy, n8n, swarm, backup, DNS, RLS, etc.). Two different deployment models. |
| **Migrations** | **before-mobile-replace adds** (vs main in this diff): `supabase-extract/migrations/43_companies_finalization.sql`, `44_rental_status_enum_alignment.sql`, `45_get_customer_ledger_rentals_rpc.sql`. Main may have a different migration history; these three are present on before-mobile-replace. |

---

## STEP 3 – CLASSIFY DIFFERENCES

| Class | Contents | Notes |
|-------|----------|--------|
| **A) Critical business logic** | SalesPage status badge (crash fix), purchaseService users embed (PGRST201 fix), ProductsPage guard. | Only on **main**. Bringing before-mobile-replace into main without keeping these would regress. |
| **B) UI / Design** | MobileNavDrawer, BottomNav, Layout, TopHeader; test pages (CutoverPrep, Day4, RLSValidation, ResponsiveTest, ERPIntegration); mobile-design/ and erp-mobile-app/ UI. | main = in-app mobile UX; before-mobile-replace = separate app + design kit. |
| **C) Deployment / Infra** | Root Dockerfile, nginx, docker-compose.prod, deploy-erp-vps.sh, deploy-via-ssh, vps-* scripts, Traefik/Dokploy docs (before-mobile-replace) vs deploy/ folder (main). | Two different production paths; merging blindly can break one. |
| **D) Experimental / Obsolete** | mobile-design/ (large Figma artifact set); erp-mobile-app as separate codebase; some duplicate/legacy docs. | Useful as reference or archive; not required for main app to run. |

---

## STEP 4 – SAFE INTEGRATION STRATEGY

### Option 1 – Selective folder import

**What:** Copy specific folders from before-mobile-replace into main (e.g. `erp-mobile-app/`, or selected scripts/docs) without merging history.

**Risks:**
- No commit history for imported code; harder to trace and revert.
- Must manually re-apply main’s fixes (SalesPage, purchaseService, ProductsPage) in any touched files.
- Deployment: mixing root Dockerfile with deploy/ can cause path/config conflicts unless you choose one model and document it.

**When to use:** When you want only erp-mobile-app or only VPS scripts on main, and are okay maintaining them manually.

---

### Option 2 – Cherry-pick specific commits

**What:** Stay on main; cherry-pick chosen commits from before-mobile-replace (e.g. “Add mobile app”, “VPS deploy script”, “migrations 43–45”).

**Risks:**
- Conflicts likely on SalesPage, purchaseService, ProductsPage, Layout, deploy files; each conflict must be resolved keeping **main’s** fixes.
- Order matters: migrations before code that uses them; deploy scripts may assume branch structure.

**When to use:** When you want discrete features (e.g. migrations, one script set) with traceable history.

---

### Option 3 – Keep branch as archive

**What:** Leave before-mobile-replace as-is. Do not merge. Use it only as reference or for copying specific files/commits when needed.

**Risks:**
- before-mobile-replace will drift further from main over time.
- Any fix or feature you want from it must be manually ported (copy or cherry-pick).

**When to use:** When main is the single source of truth and VPS/mobile-app work is not immediately needed on main.

---

### Option 4 – Controlled merge in temporary integration branch

**What:** Create a new branch from main (e.g. `integration/main-and-before-mobile`), merge before-mobile-replace into it, resolve all conflicts manually (keeping main’s logic and choosing deploy/mobile strategy), then only after review consider merging that integration branch into main.

**Risks:**
- Large conflict set (390 files); high chance of accidentally accepting wrong version (e.g. old SalesPage without badge fix).
- Two deploy models and two mobile approaches must be explicitly decided (keep one, or keep both and document).

**When to use:** When you need both branch histories combined and are ready for a long, careful conflict pass.

---

## STEP 5 – FINAL RECOMMENDATION

- **KEEP MAIN AS BASE.** Main is the current stable branch with critical fixes (SalesPage, purchaseService, ProductsPage) and the in-app mobile UX.
- **INTEGRATE SELECTIVELY.** If you need VPS deploy or erp-mobile-app on main, use **Option 1 (selective folder)** or **Option 2 (cherry-pick)**. Do not full-merge without a written plan.
- **DO NOT MERGE FULL BRANCH** of before-mobile-replace into main. A full merge would overwrite main’s fixes and deploy structure without careful resolution.
- **SAFE TO ARCHIVE** before-mobile-replace. Keep the branch; do not delete. Use as reference or source for selective integration. The tag `pre-integration-safe-point` on main is your restore point.

**No automatic action has been taken.** No merge, delete, overwrite, or structure change. This document is analysis and planning only.
