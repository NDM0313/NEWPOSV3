# Rollback plan

## Backup paths

- `/root/supabase/docker/.env.bak.auth-hostinger-smtp-20260630T114645Z`
- `/root/supabase/docker/docker-compose.yml.bak.auth-hostinger-smtp-20260630T114645Z`

## Restore

```bash
ssh dincouture-vps
cp /root/supabase/docker/.env.bak.auth-hostinger-smtp-20260630T114645Z /root/supabase/docker/.env
cd /root/supabase/docker
docker compose up -d auth
```

## Rollback target (masked)

Restores `ENABLE_EMAIL_AUTOCONFIRM=true`, `supabase-mail` / `fake_sender` SMTP.

## Validate after rollback

1. `supabase-auth` healthy
2. `GOTRUE_MAILER_AUTOCONFIRM=true`
3. Three-company monitoring PASS

**Note:** Rollback restores immediate signup auto-confirm and non-deliverable fake SMTP.
