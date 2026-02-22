# supabase.dincouture.pk – "Kong Error / Invalid authentication credentials"

## Why you see 401 on the root URL

Opening **https://supabase.dincouture.pk** in the browser without an API key shows **"Kong Error – Invalid authentication credentials"**. That is **normal**: Kong expects the `apikey` header. The ERP app sends it; direct browser visit does not.

## What the app does automatically

On each deploy, the script **deploy/fix-supabase-kong-domain.sh** runs (from deploy.sh). It:

1. Sets **API_EXTERNAL_URL** and **SUPABASE_PUBLIC_URL** to `https://supabase.dincouture.pk` in `/root/supabase/docker/.env` so Kong accepts that host.
2. Syncs **Kong’s anon key** into ERP `.env.production` (same as use-kong-anon-key.sh) so the frontend and Kong use the same JWT.
3. Restarts **Kong** so it picks up the URL and key.
4. Sets **VITE_SUPABASE_URL** to `https://supabase.dincouture.pk` in `.env.production`.

So after a normal deploy, supabase.dincouture.pk is configured for the app. You do not need to open the root URL in the browser for the app to work.

## How to verify supabase.dincouture.pk is working

From the VPS or any machine with your anon key:

```bash
# Replace YOUR_ANON_KEY with the value from .env.production (VITE_SUPABASE_ANON_KEY)
curl -sI -H "apikey: YOUR_ANON_KEY" https://supabase.dincouture.pk/auth/v1/health
```

You should get **200 OK** (and JSON body). If you get 401, the anon key or Kong config is wrong; run on VPS:

```bash
cd /root/NEWPOSV3 && bash deploy/fix-supabase-kong-domain.sh
```

Then rebuild ERP and try again.

## Summary

| What you see | Meaning |
|--------------|--------|
| 401 on https://supabase.dincouture.pk in browser | Normal – no apikey sent. App uses the key and works. |
| 401 on ERP login | Anon key mismatch – run fix-supabase-kong-domain.sh, rebuild ERP. |
| Connection refused | DNS/firewall/Traefik – see SUPABASE_DNS_FIX.md. |
