# Production deploy notes — Phase 3B-PROD

**Generated:** 2026-06-29

## Deploy summary

| Field | Value |
|-------|-------|
| **Command** | `ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch origin main && git pull origin main && bash deploy/vps-build-erp-only.sh"` |
| **Script** | `deploy/vps-build-erp-only.sh` |
| **Host** | `dincouture-vps` (`/root/NEWPOSV3`) |
| **Target** | `erp-frontend` → https://erp.dincouture.pk |
| **Deployed commit** | `99f2e3b3` |
| **Start** | ~2026-06-29T11:47:00Z (office PC SSH session) |
| **End** | ~2026-06-29T11:49:00Z (~2 min build + recreate) |
| **Container** | `erp-frontend` force-recreated, **healthy** |
| **Bundle marker** | `CashFlowReportPage-BK2pqTBs.js` — `cash-flow-preview-compare` present (grep count 1) |

## What ran

- `git fetch origin main` + `git pull origin main` (HEAD `99f2e3b3`)
- `docker compose -f deploy/docker-compose.prod.yml build --no-cache erp`
- `docker compose up -d --force-recreate erp`

## What did NOT run

- No `supabase migration` / `psql` apply
- No database container restart for migrations
- No feature flag writes
- No Cash Flow loader flags created
- No FX app deploy
- No full `deploy/deploy.sh` (ERP-only path)

## Warnings

- Standard Vite chunk size warnings during Docker build (non-blocking)
- PWA precache generated successfully

## Operator follow-up

Hard refresh https://erp.dincouture.pk (Ctrl+Shift+R) after deploy to bypass service worker cache when validating Cash Flow preview UI.
