# Auth config change

**Status:** NOT APPLIED  
**Reason:** `BLOCKED_MISSING_SMTP_CONFIG`

## Planned changes (not executed)

| Variable | Current | Planned |
|----------|---------|---------|
| `ENABLE_EMAIL_AUTOCONFIRM` | `true` | `false` |
| `SMTP_HOST` | `supabase-mail` | Real SMTP host (operator) |
| `SMTP_PORT` | `2500` | Real port (e.g. 587) |
| `SMTP_USER` | `fake_mail_user` | Real username |
| `SMTP_PASS` | masked fake | Real app password |
| `SMTP_ADMIN_EMAIL` | `admin@example.com` | Real sender email |
| `SMTP_SENDER_NAME` | `fake_sender` | Real display name |

`SITE_URL` / `GOTRUE_SITE_URL` would remain `https://erp.dincouture.pk`.

## Restart plan (deferred)

Only `supabase-auth` would be recreated after `.env` edit:

```bash
cd /root/supabase/docker
docker compose up -d auth
```

No database or `erp-frontend` restart was planned or performed.
