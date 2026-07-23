# Production deploy notes — Phase 3B-F

**Generated:** 2026-06-29

## Deploy summary

| Field | Value |
|-------|-------|
| **Command** | `ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch origin main && git pull origin main && bash deploy/vps-build-erp-only.sh"` |
| **Script** | `deploy/vps-build-erp-only.sh` |
| **Host** | `dincouture-vps` (`/root/NEWPOSV3`) |
| **Target** | `erp-frontend` → https://erp.dincouture.pk |
| **Deployed commit** | `5433ac2c` |
| **Container** | `erp-frontend` force-recreated, **healthy** |

## What ran

- `git pull origin main` (already at `5433ac2c`)
- `docker compose build --no-cache erp`
- `docker compose up -d --force-recreate erp`

## Post-deploy validation

| Step | Result |
|------|--------|
| Post-deploy smoke | **PASS** — Export row-keyed JSON visible |
| DIN CHINA row export | **CAPTURED** |
| DIN BRIDAL row export | **CAPTURED** |

## What did NOT run

- No migrations, flags, GL mutations, or loader swap

## Operator note

Hard refresh https://erp.dincouture.pk after deploy to bypass service worker cache.
