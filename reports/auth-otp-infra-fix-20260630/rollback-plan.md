# Rollback plan

**Generated:** 2026-06-30

## Backup paths (VPS)

| Artifact | Path |
|----------|------|
| `.env` | `/root/supabase/docker/.env.bak.auth-otp-infra-20260630T112048Z` |
| `docker-compose.yml` | `/root/supabase/docker/docker-compose.yml.bak.auth-otp-infra-20260630T112048Z` |

## Variables that would change on successful fix

- `ENABLE_EMAIL_AUTOCONFIRM` (`true` → `false`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`

## Restore procedure

```bash
ssh dincouture-vps
cp /root/supabase/docker/.env.bak.auth-otp-infra-20260630T112048Z /root/supabase/docker/.env
cd /root/supabase/docker
docker compose up -d auth
```

## Rollback validation

1. `supabase-auth` healthy
2. `GOTRUE_MAILER_AUTOCONFIRM=true`
3. `GOTRUE_SMTP_HOST=supabase-mail`
4. Three-company monitoring PASS
5. Existing production logins work

## Note

Rollback restores **autoconfirm=true** and **fake internal SMTP** — Create Business signup will again skip OTP and not deliver to real inboxes.
