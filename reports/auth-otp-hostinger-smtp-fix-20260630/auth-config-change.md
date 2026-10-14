# Auth config change — Hostinger SMTP

**Generated:** 2026-06-30  
**Edited:** `/root/supabase/docker/.env` only

## Changes applied

| Variable | Old | New |
|----------|-----|-----|
| `ENABLE_EMAIL_AUTOCONFIRM` | `true` | **`false`** |
| `SMTP_HOST` | `supabase-mail` | **`smtp.hostinger.com`** |
| `SMTP_PORT` | `2500` | **`587`** |
| `SMTP_USER` | `fake_mail_user` | **`noreply@dincouture.pk`** |
| `SMTP_PASS` | masked fake | masked Hostinger |
| `SMTP_ADMIN_EMAIL` | `admin@example.com` | **`noreply@dincouture.pk`** |
| `SMTP_SENDER_NAME` | `fake_sender` | **`DIN Collection ERP`** |

## Unchanged

- `SITE_URL=https://erp.dincouture.pk`
- `API_EXTERNAL_URL=https://supabase.dincouture.pk`
- `ADDITIONAL_REDIRECT_URLS` (existing ERP redirect list)

`docker-compose.yml` not edited — auth service already maps `SMTP_*` → `GOTRUE_SMTP_*`.

## Effective running config (`supabase-auth`)

`GOTRUE_MAILER_AUTOCONFIRM=false`, Hostinger SMTP on port **587**.
