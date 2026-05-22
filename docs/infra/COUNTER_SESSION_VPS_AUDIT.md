# Counter tablet session — VPS GoTrue audit

Counter PIN sign-in on the mobile app stores a **Supabase refresh token** in an encrypted device vault. The red message *"This device's saved session expired"* appears when **GoTrue rejects** that token—not because of a short in-app timer.

Use this checklist on the DIN COUTURE VPS before changing auth env. Changes require explicit approval per [`AUTH_PRODUCTION_LOCKED.md`](AUTH_PRODUCTION_LOCKED.md).

## Run the audit script

```bash
ssh dincouture-vps "bash -s" < deploy/audit-gotrue-session-env.sh
```

Or on the VPS:

```bash
cd /root/NEWPOSV3 && bash deploy/audit-gotrue-session-env.sh
```

## Variables that affect counter tablets

| Variable | Typical default | Impact |
|----------|-----------------|--------|
| `GOTRUE_JWT_EXP` | `3600` (1 hour) | Short access JWT → more refresh rotations → vault must stay synced (app does this every 20 min while logged in) |
| `GOTRUE_SESSION_TIME_BOX` | unset | If set too low, refresh tokens stop working after max session lifetime |
| `GOTRUE_SESSION_INACTIVITY_TIMEOUT` | unset | If set too low, idle tablets lose refresh tokens |
| Refresh token rotation | enabled | Old vault copy fails until email login re-syncs |

Supabase Auth refresh tokens are generally **long-lived**; failures are usually **rotation desync**, **global sign-out**, or **aggressive session timebox/inactivity** on the server.

## Recommended targets (counter shop)

| Setting | Recommendation |
|---------|----------------|
| Access JWT (`GOTRUE_JWT_EXP`) | Keep `3600` for security, or `86400` (24h) only if you accept a larger leaked-token window |
| Session timebox | **Unset**, or ≥ **7 days** (`604800` seconds if your GoTrue version uses seconds) |
| Inactivity timeout | **Unset**, or ≥ **7 days** |
| Below 24 hours | **Do not** use for counter tablets without a strong reason |

## After changing `.env`

1. Edit `/root/supabase/docker/.env` (or the auth service env block in `docker-compose.yml`).
2. Restart auth only: `cd /root/supabase/docker && docker compose restart auth`
3. Confirm health: `curl -s -o /dev/null -w "%{http_code}" -H "apikey: $ANON_KEY" https://supabase.dincouture.pk/auth/v1/health`
4. On each counter tablet: one **email/password** login per enrolled user (or any manager login once) to refresh vault tokens.

## Client-side (no VPS change)

The mobile app now:

- Syncs vault tokens on resume, every 20 minutes while logged in, and on the login screen if a session still exists
- Offers **Settings → Counter PIN session freshness** (24h / 7d / 30d / unlimited) for advisory warnings and device PIN max age

See [`erp-mobile-app/src/lib/counterVaultMaintenance.ts`](../../erp-mobile-app/src/lib/counterVaultMaintenance.ts) and [`counterSessionPolicy.ts`](../../erp-mobile-app/src/lib/counterSessionPolicy.ts).
