# Environment Standardization — Single Backend (VPS Supabase)

Web ERP aur mobile ERP **dono same Supabase** use karte hain.

## Required Values

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://supabase.dincouture.pk` | VPS Kong API (HTTPS) |
| `VITE_SUPABASE_ANON_KEY` | Kong anon key | VPS se get karo |

## Where to Set

### Web ERP (root)

- `.env.production` — production build
- `.env.local` — local dev

### Mobile ERP (erp-mobile-app)

- `erp-mobile-app/.env` — local dev + build
- Copy `.env.example` → `.env` and fill values

### VPS Supabase

Anon key VPS par:

```bash
ssh dincouture-vps "docker exec supabase-kong env | grep KONG_ANON_KEY"
```

Ya Kong dashboard se.

## Verification

1. **Connection Debug** (Settings → dev only) — shows:
   - Connected Supabase URL
   - Company ID / Branch ID
   - User email

2. **Same login** — web aur mobile par same email/password se login hona chahiye.

## Example

```bash
# erp-mobile-app/.env
VITE_SUPABASE_URL=https://supabase.dincouture.pk
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
