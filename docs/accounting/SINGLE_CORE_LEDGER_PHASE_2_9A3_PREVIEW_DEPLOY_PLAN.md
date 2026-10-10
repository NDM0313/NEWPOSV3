# Single Core Ledger Phase 2.9A-3 — Preview-Capable Build Deploy for Browser Waiver Closure

**Status:** `PHASE 2.9A-3 DEPLOY PLAN READY — waiting for ops approval to deploy preview-capable build`  
**Mode:** PLAN ONLY — no deploy execution in this doc commit; no flag writes; no DB mutation  
**Branch:** `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`  
**Deploy commit:** `ae646222` on `feature/single-core-ledger-phase-2-9-pilot-enablement-plan`  
**Last updated:** 2026-06-25  

**Prerequisite:** Phase 2.9A-2 @ `ae646222` — `PASS WITH LIMITED WAIVERS`; production `erp.dincouture.pk` lacks preview UI in bundle; DB flags OFF; MR JALIL RPC **216,300** PASS.

**Deploy target:** Parallel container `erp-frontend-preview` on VPS port **3002** + SSH tunnel — **does not** replace `erp-frontend` / `erp.dincouture.pk`.

---

## 1. Branch / stack merge order

| Item | Value |
|------|-------|
| **Deploy commit** | `ae646222` |
| **Branch** | `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` |
| **Contains** | Phases 2.1–2.7 preview UI + 2.8/2.9/2.9A docs |
| **Merge to `main`** | **Not required** for 2.9A-3 |

---

## 2. Target environment

**Parallel preview slot (port 3002 + SSH tunnel)**

```bash
ssh -N -L 3002:127.0.0.1:3002 dincouture-vps
# Browser: http://localhost:3002 → login DIN CHINA
```

Uses production Supabase (`https://supabase.dincouture.pk`). **Flags remain OFF.**

---

## 3. Pre-deploy checks

| # | Check | Pass criterion |
|---|-------|----------------|
| 1 | Commit `ae646222` | Exact |
| 2 | `npm run test:unified-ledger` | 112/112 |
| 3 | `npm run build` | Exit 0 |
| 4 | DIN CHINA flags read-only SQL | 0 rows `unified_ledger%` |
| 5 | MR JALIL RPC baseline | 216,300 ±0.01 |
| 6 | Production `erp.dincouture.pk` | Baseline commit recorded |
| 7 | Rollback tag planned | `erp-frontend-preview:rollback-before-29a3-*` |
| 8 | Stage 1/2 SQL | **NOT RUN** |

**Do not use** full [`deploy/deploy.sh`](../../deploy/deploy.sh) — it runs migrations and RLS fixes.

---

## 4. Build and deploy

**Scaffold files:**

- [`deploy/docker-compose.preview.yml`](../../deploy/docker-compose.preview.yml)
- [`scripts/single-core-ledger/deploy-phase-29a3-preview-frontend-vps.sh`](../../scripts/single-core-ledger/deploy-phase-29a3-preview-frontend-vps.sh)

**One-shot VPS (after ops approval):**

```bash
ssh dincouture-vps "bash -s" < scripts/single-core-ledger/deploy-phase-29a3-preview-frontend-vps.sh
```

Or manual steps in script: worktree `/root/NEWPOSV3-preview-qa` → build → `up -d` on port 3002.

**Explicitly NOT run:** `run-migrations-vps.sh`, RLS fixes, edge functions, any `feature_flags` SQL.

---

## 5. Post-deploy bundle verification

Grep **all** `assets/*.js` in preview container (not index-only):

```bash
docker exec erp-frontend-preview sh -c '
  cd /usr/share/nginx/html/assets &&
  for s in "Unified engine preview" "Load MR JALIL" "phase2-compare-ledger-v2" "unified-ledger-tieout"; do
    if grep -rl "$s" . >/dev/null 2>&1; then echo "FOUND:$s"; else echo "MISSING:$s"; fi
  done
'
```

Save to [`post-deploy-browser-qa/bundle-verify.txt`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa/bundle-verify.txt).

---

## 6. Post-deploy browser waiver checklist

Via **http://localhost:3002** on DIN CHINA:

| # | Check |
|---|-------|
| 1 | Admin/developer login |
| 2 | Ledger V2 loads |
| 3 | Preview toggle visible |
| 4 | Toggle default OFF |
| 5 | Banner `legacy` |
| 6 | No unified RPC with toggle OFF |
| 7 | Toggle ON + MR JALIL → **216,300** |
| 8 | Preview JSON download |
| 9 | Export parity (legacy totals) |
| 10 | Staff: no toggles |
| 11 | Admin Compare Center loads |
| 12 | Kill switch (optional / waiver) |

Re-run read-only flags SQL after session — expect 0 rows.

---

## 7. Rollback

| Level | Action |
|-------|--------|
| 1 | `docker rm -f erp-frontend-preview` |
| 2 | Run `erp-frontend-preview:rollback-before-29a3-*` image |
| 3 | Stop SSH tunnel |
| 4 | `erp.dincouture.pk` — **untouched** |

---

## 8. No-flag guarantee

No `unified_ledger_pilot`, `unified_ledger_engine`, or `unified_ledger_screen_ledger_v2` writes. No default loader switch. Stage 1/2 SQL **blocked** until browser waivers PASS.

---

## 9. Evidence

[`reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa/`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/post-deploy-browser-qa/)

After browser QA: update [`live-waiver-checks.md`](../../reports/single-core-ledger/phase-2-9-pilot-enablement/pre-flag/live-waiver-checks.md) → **CLEARED**.

---

## 10. Final status

**`PHASE 2.9A-3 DEPLOY PLAN READY — waiting for ops approval to deploy preview-capable build`**

---

## Execution sequence (ops — not automated in plan PR)

1. Merge plan PR
2. Ops approves deploy ticket
3. Run `deploy-phase-29a3-preview-frontend-vps.sh` on VPS
4. Bundle verify → browser checklist
5. Sign **PHASE 2.9A LIVE WAIVER CHECKS PASS**
6. **Stop** before Stage 1 SQL
