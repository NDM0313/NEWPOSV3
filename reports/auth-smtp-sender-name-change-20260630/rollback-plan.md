# Rollback plan

## Backups

- `/root/supabase/docker/.env.bak.sender-name-ndm-20260630T120945Z`
- `/root/supabase/docker/docker-compose.yml.bak.sender-name-ndm-20260630T120945Z`

## Restore

```bash
cp /root/supabase/docker/.env.bak.sender-name-ndm-20260630T120945Z /root/supabase/docker/.env
cd /root/supabase/docker && docker compose up -d auth
```

Restores `SMTP_SENDER_NAME=DIN Collection ERP`.

## Validate

- `GOTRUE_SMTP_SENDER_NAME=DIN Collection ERP`
- `supabase-auth` healthy
- Three-company monitoring PASS
