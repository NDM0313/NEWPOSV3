# Live Regression Fix – Supabase Root 502 + Auth 502 + Studio Blank

**Date:** 2026-03-18  
**Context:** User reported browser seeing: supabase.dincouture.pk Bad Gateway, auth/v1/token 502, Studio still blank. This doc records the re-baseline and recovery path.

---

## 1. Re-baseline result (from VPS)

At time of investigation, **from the VPS** all endpoints passed:

| Check | Result (VPS curl) |
|-------|-------------------|
| https://supabase.dincouture.pk/ | **200** (JSON body) |
| https://supabase.dincouture.pk/auth/v1/health (with apikey) | **200** |
| https://supabase.dincouture.pk/auth/v1/token (POST) | **400** (invalid credentials – auth reachable) |
| https://studio.dincouture.pk/project/default | **200** |
| https://erp.dincouture.pk/ | **200** |

Containers: Kong (healthy), auth (healthy), rest, studio (healthy), Traefik, erp-frontend (healthy).  
Traefik dynamic config: supabase.yml with supabase-dincouture → Kong, studio-dincouture → supabase-studio:3000, middlewares (cors, studio-storage-policy, redirect-to-https) present.  
Networks: Traefik on dokploy-network + supabase_default; Kong on both; Studio reachable from supabase_default.

**Conclusion:** Platform is healthy from the server. Browser 502 can be due to transient Kong/auth restart, network path, or cached response.

---

## 2. Why old summary no longer matched live state

- Previous fixes (Studio network, Traefik config, ERP auth guard) were applied and verified at that time.
- **Regression** can happen when: (1) Kong or auth restarts and is briefly unavailable, (2) Traefik config was overwritten by another deploy and not re-applied, (3) browser or CDN caches a 502, (4) user’s network path differs from VPS.
- We do **not** assume “fixed” without re-verifying; we re-baseline with curl from VPS and document recovery steps.

---

## 3. Recovery when browser shows 502

1. **Run live diagnostic on VPS**
   ```bash
   ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/diagnose-live-platform.sh"
   ```
   - If all checks **PASS**: platform is up; in browser try hard refresh (Ctrl+Shift+R), incognito, or different network.
   - If any check **FAIL**: run with auto-restart:
     ```bash
     ssh dincouture-vps "cd /root/NEWPOSV3 && RESTART_IF_FAIL=1 bash deploy/diagnose-live-platform.sh"
     ```
     Or manually restart Kong and auth:
     ```bash
     ssh dincouture-vps "cd /root/supabase/docker && docker compose restart kong auth"
     ```
     Wait ~30s, then run `diagnose-live-platform.sh` again.

2. **Re-apply Studio/Traefik (if Studio 502 or blank)**
   ```bash
   ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/ensure-studio-traefik-network.sh && bash deploy/apply-studio-traefik-config.sh"
   ```

3. **Studio still blank (localStorage SecurityError)**  
   See **docs/STUDIO_502_AND_ERP_AUTOLOGOUT_RUNBOOK.md** section 2b: allow site data for studio.dincouture.pk; try clean profile / different browser.

---

## 4. Files / scripts changed (this regression pass)

| Item | Purpose |
|------|--------|
| **deploy/diagnose-live-platform.sh** | Single script to curl supabase root, auth health, auth token, studio, erp from VPS; reports pass/fail; optional `RESTART_IF_FAIL=1` to restart Kong+auth and re-check. |
| **docs/LIVE_REGRESSION_FIX_RESULT.md** | This doc: baseline result, recovery steps, why summaries can diverge from live state. |

No Traefik or Kong config was changed in this pass; config on VPS was verified correct.

---

## 5. Containers restarted

None during this investigation (all checks passed from VPS). Use `diagnose-live-platform.sh` with `RESTART_IF_FAIL=1` or manual `docker compose restart kong auth` when health checks fail.

---

## 6. Verification

- **VPS:** All five curl checks passed (root, auth health, auth token, studio, erp).
- **Browser:** User should re-test after running diagnostic and any restart; hard refresh if VPS passes but browser still showed 502.

---

## 7. Git

- **Commit:** a6497c1
- **Branch:** main
