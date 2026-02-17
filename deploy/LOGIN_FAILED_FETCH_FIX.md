# Login "Failed to fetch" / AuthRetryableFetchError Fix

## Problem

After logout (or on first load), Sign In shows **"Failed to fetch"** and the console shows:

- `POST https://supabase.dincouture.pk/auth/v1/token?... net::ERR_FAILED`
- `[AUTH ERROR] Sign in failed: { ..., name: 'AuthRetryableFetchError', message: 'Failed to fetch' }`

This happens when the **browser cannot reach** the Supabase auth URL. Often the app is built with:

- `VITE_SUPABASE_URL=https://supabase.dincouture.pk`

If that subdomain is down, not routed, or blocked, auth requests fail.

## Fix on production (VPS)

Use the **same origin** for the API so auth goes through the same domain as the app (erp.dincouture.pk). Nginx in the ERP container can proxy `/auth` and `/rest` to Kong.

### Step 1: Set env and rebuild

On the VPS (e.g. `/root/NEWPOSV3` or where the app is built):

1. Edit `.env.production`:

   ```bash
   VITE_SUPABASE_URL=https://erp.dincouture.pk
   VITE_SUPABASE_ANON_KEY=<your-existing-anon-key>
   ```

   Keep the same `VITE_SUPABASE_ANON_KEY` (Kong anon key). Only change the URL to `https://erp.dincouture.pk`.

2. Rebuild and restart the frontend:

   ```bash
   docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
   ```

3. Clear browser cache or do a hard refresh (Ctrl+Shift+R) on the login page.

### Step 2: Nginx proxy (if not already done)

The ERP container’s nginx must proxy Supabase paths to Kong, for example:

- `/auth/` → Kong auth (e.g. `http://supabase-kong:8000/auth/` or your Kong URL)
- `/rest/` → Kong rest
- `/realtime/` → Kong realtime

If your current setup already proxies these under `erp.dincouture.pk`, no change. If not, add the proxy rules for `/auth`, `/rest`, `/realtime` to the same host as the app.

## Summary

| Symptom              | Cause                          | Action                                                                 |
|----------------------|--------------------------------|------------------------------------------------------------------------|
| Failed to fetch      | supabase.dincouture.pk unreachable | Set `VITE_SUPABASE_URL=https://erp.dincouture.pk`, rebuild, hard refresh |
| 401 Invalid credentials | Wrong anon key                 | Use Kong’s anon key in `.env.production` (see FIX_LOGIN_AND_SUPABASE_DOMAIN.md) |

After this, both **ndm313@yahoo.com** and **Demo Login (demo@dincollection.com)** should work again from the same build.
