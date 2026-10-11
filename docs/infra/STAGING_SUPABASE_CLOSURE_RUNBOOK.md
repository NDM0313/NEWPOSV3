# Staging Supabase — Closure Runbook

**Status:** CLOSED — migration complete.  
**Verified:** 2026-10-11T13:38:42Z via [CI run 38143962108](https://github.com/NDM0313/NEWPOSV3/actions/runs/38143962108)  
**Host:** VPS `72.62.254.176` (`/opt/supabase-stage`)  
**PR:** [#28](https://github.com/NDM0313/NEWPOSV3/pull/28)

## Surfaces

| Role | URL / port | Notes |
|---|---|---|
| Production ERP | `:3001` / `https://erp.dincouture.pk` | UNTOUCHED |
| Production API | `https://supabase.dincouture.pk` / `https://api.ndmcore.com` | UNTOUCHED |
| Staging Kong | `http://127.0.0.1:8010` / `https://api-stage.ndmcore.com` | HTTP 401 local / 200 public |
| Staging Studio | `http://127.0.0.1:3010` / `https://db-stage.ndmcore.com` | Local 307; public DNS A record still pending |
| Staging Postgres | `127.0.0.1:5433` | Container `stage-supabase-db` |
| Preview ERP | `http://127.0.0.1:3002` | HTTP 200; staging URL + anon baked in |
| Staging Anon Key | see `.stage_anon_key` / below | Distinct from production |

## Operator commands

```bash
# Health
curl -sI http://127.0.0.1:8010/rest/v1/ | head -1   # 401
curl -sI http://127.0.0.1:3010/ | head -1           # 200/307
curl -sI http://127.0.0.1:3002/ | head -1           # 200

# Full isolation verify (canary STG-VERIFY-999)
bash /root/NEWPOSV3/scripts/verify-staging-isolation-vps.sh

# Re-wire preview to staging
bash /root/NEWPOSV3/scripts/wire-staging-preview-vps.sh
```

## Key files

- `/opt/supabase-stage` — staging compose + `.env` + `.stage_anon_key`
- `/etc/dokploy/traefik/dynamic/supabase-stage.yml` — Traefik routes
- `scripts/deploy-supabase-stage-minipc.sh` — create/migrate staging stack
- `scripts/wire-staging-preview-vps.sh` — Traefik + preview rebuild
- `scripts/verify-staging-isolation-vps.sh` — final health + isolation proof

## Isolation proof (PASS)

Canary `STG-VERIFY-999` inserted into **staging** `public.expenses` only.

| DB | Canary count |
|---|---|
| Staging (`stage-supabase-db`) | **1** |
| Production (`supabase-db`) | **0** |

```text
ISOLATION VERIFIED: Record exists in Staging only, 0 leakage to Production.
```

## Staging Anon Key (preview bake)

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.OHbNef2x7CVNAPLi302ouCz3UN1sG1TK_uVFOivGM90
```

## Preview tunnel

```bash
ssh -N -L 3002:127.0.0.1:3002 root@72.62.254.176
# open http://localhost:3002
```
