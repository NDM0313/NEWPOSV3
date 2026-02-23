# Deploy & Self-Hosted Supabase – Task Checklist

## Completed (auto-apply on deploy / fixes-only)

| Item | Script / Step | Status |
|------|----------------|--------|
| Studio storage JWT (Failed to retrieve buckets) | `fix-supabase-storage-jwt.sh` → recreate Kong, Studio, Storage | ✅ |
| Kong domain & anon key sync | `fix-supabase-kong-domain.sh` | ✅ |
| Expenses columns | `apply_expenses_columns` in deploy.sh | ✅ |
| Storage buckets + RLS | `apply-storage-rls-vps.sh` or `apply_rls` | ✅ |
| RLS performance (account_transactions) | `apply-rls-performance-vps.sh` / `rls-performance-fix.sql` | ✅ |
| Enable RLS on all public tables (Security Advisor) | `apply-enable-rls-public.sh` / `enable-rls-public-tables.sql` | ✅ |
| Studio settings API (Failed to update settings) | `fix-supabase-studio-settings-api.sh` (Kong dashboard basic-auth removed) | ✅ |
| Line endings (LF for VPS) | `.gitattributes` + optional `fix-line-endings.sh` | ✅ |

## Manual / Cron on VPS

| Item | Command | Frequency |
|------|---------|-----------|
| Database backup | `cd /root/NEWPOSV3 && bash deploy/backup-supabase-db.sh 7` | Daily via cron (e.g. `0 2 * * *`) |

## What’s different on self-hosted (not fixable in app)

- **Home page metrics** (Database/Auth/Storage/Realtime requests): No data unless you add your own metrics (e.g. Grafana).
- **Database backups UI**: No UI; use `deploy/backup-supabase-db.sh` (see above).
- **Auth config UI**: Many options are via env vars; see `deploy/SELF_HOSTED_STUDIO_GAPS.md`.

## One-time on VPS after git pull

```bash
cd /root/NEWPOSV3
git pull
# Fix CRLF if scripts were edited on Windows:
sed -i 's/\r$//' deploy/*.sh deploy/*.sql
# Apply all fixes (no build):
bash deploy/apply-fixes-now.sh
# Recreate Kong/Studio/Storage so new JWT keys load:
cd /root/supabase/docker && docker compose up -d kong studio storage --force-recreate
```

## Full deploy (build + up + fixes)

```bash
cd /root/NEWPOSV3
bash deploy/deploy.sh
```
