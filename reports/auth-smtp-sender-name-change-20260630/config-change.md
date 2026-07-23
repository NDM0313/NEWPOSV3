# Config change

**Edited:** `/root/supabase/docker/.env` only

| Variable | Old | New |
|----------|-----|-----|
| `SMTP_SENDER_NAME` | `DIN Collection ERP` | **`NDM ERP SYSTEM`** |

All other SMTP and auth variables unchanged.

Effective in `supabase-auth`: `GOTRUE_SMTP_SENDER_NAME=NDM ERP SYSTEM`
