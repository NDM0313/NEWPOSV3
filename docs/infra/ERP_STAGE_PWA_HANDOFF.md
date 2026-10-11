# erp-stage + Mobile PWA staging handoff

**Host:** VPS `72.62.254.176`  
**Safety:** Production `:3001`, `api.ndmcore.com`, and `erp-mobile-app/` remain untouched.

## Surfaces

| Surface | URL | Backend |
|---|---|---|
| Staging web ERP | https://erp-stage.ndmcore.com | Preview `:3002` → `api-stage.ndmcore.com` |
| Staging API | https://api-stage.ndmcore.com | `/opt/supabase-stage` Kong `:8010` |
| Staging Studio | https://db-stage.ndmcore.com | Studio `:3010` |
| Staging PWA clone | `erp-mobile-app-stage/` (local serve) | `api-stage.ndmcore.com` |

## Wire Traefik (VPS)

```bash
bash /root/NEWPOSV3/scripts/wire-erp-stage-vps.sh
```

Traefik dynamic file: `/etc/dokploy/traefik/dynamic/supabase-stage.yml`  
Router `erp-stage.ndmcore.com` → Docker service `erp-frontend-preview:80`  
(Traefik is attached to `erp-preview_net`; host bind remains `127.0.0.1:3002`.)

## Verify

```bash
curl -skI https://erp-stage.ndmcore.com/          # expect 200
# Origin (bypass CF) should match preview index + serve staging chunk:
curl -sk --resolve erp-stage.ndmcore.com:443:72.62.254.176 \
  https://erp-stage.ndmcore.com/assets/paymentAttachmentUrl-WR-rBwYF.js \
  | grep -o api-stage.ndmcore.com
# If Cloudflare HTML index differs from origin, purge CF cache for erp-stage.
```

## Mobile PWA test steps

1. On a laptop with LAN access:
   ```bash
   cd erp-mobile-app-stage
   npm install
   npm run serve:pwa
   ```
2. Note the printed URL, e.g. `http://192.168.x.x:4175`.
3. On phone (same Wi‑Fi): open that URL → **Add to Home Screen**.
4. Sign in — network tab / app traffic should hit **`https://api-stage.ndmcore.com`**.

Alternatively, for the staging **web** ERP (not the Capacitor PWA clone), open **https://erp-stage.ndmcore.com** on the phone.

## Staging anon key

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.OHbNef2x7CVNAPLi302ouCz3UN1sG1TK_uVFOivGM90
```
