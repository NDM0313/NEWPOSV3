# 502 Bad Gateway when running app on localhost

When you run the ERP app at **localhost:5173** and see "Service temporarily unavailable" / "Bad Gateway", the frontend is calling your **production backend** (supabase.dincouture.pk). The 502 means that backend is not responding correctly.

## What’s happening

- **Local dev** uses `VITE_SUPABASE_URL` from your `.env` (often `https://supabase.dincouture.pk`).
- On sign-in, the app calls:
  - **Auth:** `https://supabase.dincouture.pk/auth/v1/...`
  - **Data:** `https://supabase.dincouture.pk/rest/v1/users` (and other tables)
- If **Kong** (gateway) or **PostgREST** / **GoTrue** behind it is down or misconfigured, you get **502 Bad Gateway**.

## Quick fix: check backend on VPS

Run this from your machine (uses SSH config host `dincouture-vps`):

```bash
ssh dincouture-vps "docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'kong|auth|rest|postgres'"
```

- **Kong** or **Rest** or **Auth** in `Exited` or `Restarting` → that’s the cause.

Restart Kong (often fixes transient 502):

```bash
ssh dincouture-vps "cd /root/supabase/docker && docker compose restart kong"
```

Wait ~20 seconds, then reload the app at localhost:5173 and try again.

## If Kong is in a restart loop

Kong may be crashing due to invalid `kong.yml`. See **deploy/diagnose-502-auth.md** and run:

```bash
ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/fix-kong-502-auth.sh"
```

## Test backend from your machine

After fixing, test that the API is reachable (replace `YOUR_ANON_KEY` with your real anon key, or use the one from .env):

```bash
curl -sS -o /dev/null -w "%{http_code}" -H "apikey: YOUR_ANON_KEY" "https://supabase.dincouture.pk/rest/v1/users?select=id&limit=1"
```

- **200** → backend is up; if the app still shows 502, hard-refresh (Ctrl+Shift+R) or clear site data.
- **502** → Kong or Rest is still down; check containers and Kong logs as above.

## Optional: develop without VPS

To avoid depending on the production backend while developing, you can:

- Run **Supabase locally** (Docker) and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to your local instance, or
- Use a **separate Supabase project** (e.g. Cloud or another self-hosted) and point `.env` to that.

Then localhost will talk to that backend instead of supabase.dincouture.pk.
