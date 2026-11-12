# Auth health check

**Generated:** 2026-06-30

## Restart

```bash
cd /root/supabase/docker && docker compose up -d auth
```

| Check | Result |
|-------|--------|
| `supabase-auth` | **running, healthy** |
| `GOTRUE_MAILER_AUTOCONFIRM` | **false** |
| Auth health endpoint | **401** (reachable) |
| `https://erp.dincouture.pk/` | **200** |
| `supabase-db` restarted | **No** |
| `erp-frontend` restarted | **No** |
| Migrations | **No** |
| Business data mutation | **No** |
