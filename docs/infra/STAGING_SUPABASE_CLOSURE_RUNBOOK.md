# Staging Supabase — Closure Runbook

**Status:** Closed after final isolation verification (VPS `72.62.254.176`).  
**PR:** staging stack + Traefik + preview `:3002` wiring.

## Surfaces

| Role | URL / port | Notes |
|---|---|---|
| Production ERP | `:3001` / `https://erp.dincouture.pk` | Untouched |
| Production API | `https://supabase.dincouture.pk` / `https://api.ndmcore.com` | Untouched |
| Staging Kong | `http://127.0.0.1:8010` / `https://api-stage.ndmcore.com` | `/opt/supabase-stage` |
| Staging Studio | `http://127.0.0.1:3010` / `https://db-stage.ndmcore.com` | DNS for `db-stage` may need A record |
| Staging Postgres | `127.0.0.1:5433` | Container `stage-supabase-db` |
| Preview ERP | `http://127.0.0.1:3002` | Built with staging URL + anon key |

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

## Isolation proof

Script inserts canary `STG-VERIFY-999` into **staging** `public.expenses`, then asserts **production** count is `0`.

Expected line:

```text
ISOLATION VERIFIED: Record exists in Staging only, 0 leakage to Production.
```

## Preview tunnel

```bash
ssh -N -L 3002:127.0.0.1:3002 root@72.62.254.176
# open http://localhost:3002
```
