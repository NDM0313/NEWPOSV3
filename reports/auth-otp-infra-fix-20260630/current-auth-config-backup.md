# Current auth config backup (pre-change)

**Generated:** 2026-06-30  
**Status:** Backup taken; **no production auth config change applied** (blocked on SMTP).

## Config location

| File | Role |
|------|------|
| `/root/supabase/docker/.env` | Source values (`ENABLE_EMAIL_AUTOCONFIRM`, `SMTP_*`, `SITE_URL`) |
| `/root/supabase/docker/docker-compose.yml` | Maps `.env` → `GOTRUE_*` for `supabase-auth` |
| Container `supabase-auth` | Running GoTrue instance |

## VPS timestamped backups

| Backup | Path |
|--------|------|
| `.env` | `/root/supabase/docker/.env.bak.auth-otp-infra-20260630T112048Z` |
| `docker-compose.yml` | `/root/supabase/docker/docker-compose.yml.bak.auth-otp-infra-20260630T112048Z` |

## Current values (masked)

### `.env` (active source)

| Variable | Value |
|----------|-------|
| `ENABLE_EMAIL_AUTOCONFIRM` | `true` |
| `SMTP_HOST` | `supabase-mail` |
| `SMTP_PORT` | `2500` |
| `SMTP_USER` | `fake_mail_user` |
| `SMTP_PASS` | `***MASKED***` |
| `SMTP_ADMIN_EMAIL` | `admin@example.com` |
| `SMTP_SENDER_NAME` | `fake_sender` |
| `SITE_URL` | `https://erp.dincouture.pk` |
| `API_EXTERNAL_URL` | `https://supabase.dincouture.pk` |
| `ADDITIONAL_REDIRECT_URLS` | `https://erp.dincouture.pk,...` |

### Running `supabase-auth` (effective)

| Variable | Value |
|----------|-------|
| `GOTRUE_MAILER_AUTOCONFIRM` | `true` |
| `GOTRUE_SMTP_HOST` | `supabase-mail` |
| `GOTRUE_SMTP_PORT` | `2500` |
| `GOTRUE_SMTP_USER` | `fake_mail_user` |
| `GOTRUE_SMTP_ADMIN_EMAIL` | `admin@example.com` |
| `GOTRUE_SMTP_SENDER_NAME` | `fake_sender` |
| `GOTRUE_SITE_URL` | `https://erp.dincouture.pk` |

## Root cause confirmed

Fake internal mail (`supabase-mail` / `fake_sender`) plus `ENABLE_EMAIL_AUTOCONFIRM=true` causes immediate session on signup and no Gmail-deliverable verification email.
