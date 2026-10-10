# Frontend deploy notes

**Generated:** 2026-06-30  
**Type:** Frontend-only (`deploy/vps-build-erp-only.sh`)  
**Deployed commit:** `a83522f7` — TB golden + MR JALIL constant bundle

| Item | Value |
|------|--------|
| URL | https://erp.dincouture.pk |
| Container | `erp-frontend` — **healthy** |
| Migrations | **No** |
| Feature flags | **No change** |
| GL / data mutation | **No** |

**Note:** Deploy script exited 1 on a Docker container recreate race; VPS verified `erp-frontend` healthy at `a83522f7` immediately after.
