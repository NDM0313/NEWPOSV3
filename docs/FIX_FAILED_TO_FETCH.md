# Fix "Failed to fetch" on Sign In (erp.dincouture.pk)

The app loads but **Sign In** shows "Failed to fetch" because the browser cannot reach the Supabase API (Kong) or the server rejects the request (CORS / certificate).

**Preferred fix (no CORS/cert in browser):** The ERP container now proxies `/auth`, `/rest`, `/realtime`, `/storage` to Kong. The app is built with `VITE_SUPABASE_URL=https://erp.dincouture.pk`, so all API calls are same-origin. **Redeploy the ERP frontend** so the new nginx config and build are used:

```bash
cd /root/NEWPOSV3 && bash scripts/deploy-erp-vps.sh
```

Then try Sign In again. If it still fails, run the Supabase Auth fix below and ensure Kong is listening on 8443.

---

## Fix on VPS (one script)

From the server where Supabase is running (e.g. same VPS as ERP):

```bash
cd /root/NEWPOSV3
bash scripts/vps-supabase-fix-fetch.sh
```

The script **syncs the repo first** (fetch + reset), so local changes will not block it. Then it updates the Supabase Auth config and restarts the auth service so that `https://erp.dincouture.pk` is allowed.

If `git pull` was failing (e.g. "local changes would be overwritten"), use this one-liner once to sync and run the fix (resets local changes):

```bash
cd /root/NEWPOSV3 && git fetch origin && git checkout before-mobile-replace 2>/dev/null; git reset --hard origin/before-mobile-replace && bash scripts/vps-supabase-fix-fetch.sh
```

---

## Manual fix (if script is not used)

### 1) Supabase Auth (GoTrue) – SITE_URL and redirect URLs

Edit the Supabase Docker env file (usually `/root/supabase/docker/.env` or next to your `docker-compose` for Supabase):

- Set the main site URL:
  - **GOTRUE_SITE_URL** or **SITE_URL** = `https://erp.dincouture.pk`
- Allow redirects to your app:
  - **GOTRUE_URI_ALLOW_LIST** (or **ADDITIONAL_REDIRECT_URLS**) = include:
    - `https://erp.dincouture.pk`
    - `https://erp.dincouture.pk/`
    - (optional) `http://72.62.254.176`, `https://72.62.254.176` if you also open the app by IP

Example lines to have (names may vary by Supabase version):

```env
GOTRUE_SITE_URL=https://erp.dincouture.pk
GOTRUE_URI_ALLOW_LIST=https://erp.dincouture.pk,https://erp.dincouture.pk/
```

If your file uses **SITE_URL** instead of **GOTRUE_SITE_URL**, set:

```env
SITE_URL=https://erp.dincouture.pk
```

### 2) Restart Auth (and Kong if needed)

```bash
# Restart Auth so it reads the new .env
docker restart $(docker ps -q -f name=supabase-auth)

# If you use Kong in front of Auth, restart it too so CORS/headers are updated
docker restart $(docker ps -q -f name=kong) 2>/dev/null || true
```

### 3) Kong CORS (if still "Failed to fetch" or CORS error in browser)

If your stack uses Kong and the browser console shows a **CORS** error, Kong must allow the origin `https://erp.dincouture.pk`. That is usually done in Kong’s config or a CORS plugin (e.g. allow origin `https://erp.dincouture.pk` or `*` for the Auth and Rest routes). See your Supabase self-hosted / Kong docs for adding or editing the CORS plugin.

### 4) Firewall

From your PC, the app calls the **API** at `https://72.62.254.176:8443` (Kong). Ensure port **8443** is open on the VPS firewall for the internet (or for your IP). Example (UFW):

```bash
sudo ufw allow 8443/tcp
sudo ufw reload
```

---

## After the fix

1. Restart Auth (and Kong if applicable) as above.
2. Clear browser cache or use a private window.
3. Open **https://erp.dincouture.pk** and try **Sign In** again.

If it still fails, open DevTools (F12) → **Network** tab, try Sign In, and check the failing request: note the URL, status code, and any CORS error message. Use that to adjust SITE_URL, redirect list, or Kong CORS.
