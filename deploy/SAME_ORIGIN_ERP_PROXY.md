# Same-Origin API (erp.dincouture.pk) – No CORS

The ERP app is built with **VITE_SUPABASE_URL=https://erp.dincouture.pk**. The browser only talks to `erp.dincouture.pk`, so there is **no cross-origin request** and **no CORS** is needed.

## Flow

1. User opens **https://erp.dincouture.pk**
2. App calls **https://erp.dincouture.pk/auth/v1/token**, **/rest/v1/...**, etc. (same origin)
3. Your reverse proxy (Caddy, Traefik, Nginx) must send **all** requests for `erp.dincouture.pk` (including `/auth/`, `/rest/`) to the **ERP container**
4. The ERP container’s nginx proxies `/auth/` and `/rest/` to **Kong** (supabase-kong:8000) and returns the response

## Required: Proxy must route full host to ERP

The reverse proxy that serves **erp.dincouture.pk** must route the **entire** host to the ERP frontend service, not only path `/`.

- **Correct:** `erp.dincouture.pk` → ERP container (all paths, including `/auth/`, `/rest/`)
- **Wrong:** `erp.dincouture.pk/` → ERP, but `erp.dincouture.pk/auth/` → another service or 404

Example (Traefik/Dokploy): one router for `erp.dincouture.pk` with no path prefix, so all paths go to the ERP service.

## Verify

From your machine:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://erp.dincouture.pk/auth/v1/health" -H "apikey: YOUR_ANON_KEY"
```

You should get **200**. If you get **404** or **502**, the proxy is not forwarding `/auth/` to the ERP container.
