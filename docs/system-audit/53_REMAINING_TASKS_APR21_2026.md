# Remaining tasks (21 Apr 2026)

Short follow-ups after mobile ERP + Supabase VPS work. Push this file with the repo so the team has a single checklist.

## ERP Mobile (`erp-mobile-app/`)

| Task | Action |
|------|--------|
| Local Supabase keys | Copy real `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` from root [`.env.local`](../.env.local) / [`.env.production`](../.env.production) into [`erp-mobile-app/.env`](../../erp-mobile-app/.env). Do **not** use the public `supabase-demo` JWT. Restart `npm run dev` after edits. |
| Typecheck | From `erp-mobile-app`: `npm run typecheck` (not `npx tsc -b in ...` — extra words are parsed as project paths). |

## Supabase / VPS

| Task | Action |
|------|--------|
| Studio `502` after Docker churn | On VPS: `cd /root/NEWPOSV3 && bash deploy/ensure-studio-traefik-network.sh && bash deploy/apply-studio-traefik-config.sh`. Then `bash deploy/diagnose-live-platform.sh`. |
| SQL migrations from repo | `bash deploy/run-migrations-vps.sh` (uses `supabase_admin` by default; override with `SUPABASE_DB_MIGRATE_USER` if needed). |
| `realtime-dev.supabase-realtime` unhealthy | Seen on VPS `docker ps` — optional: inspect logs and Supabase compose health; may be dev-only container. |

## Optional product / UX

| Task | Notes |
|------|--------|
| Blocking banner for demo key | Already on Login + Pay Supplier when `iss=supabase-demo`; extend to other screens if desired. |
| Kong CORS for extra dev origins | If you add new local ports/domains, update [`deploy/supabase-traefik.yml`](../../deploy/supabase-traefik.yml) `supabase-cors` allow list. |

## Docs index

- Broader office checklist: [`docs/REMAINING_TASKS.md`](../REMAINING_TASKS.md)  
- Session-style summaries: [`docs/system-audit/`](./)
