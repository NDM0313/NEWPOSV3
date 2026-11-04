# erp.ndmcore.com Traefik + Cloudflare

## What was fixed on the VPS (2026-11-04)

1. Backup: `/etc/dokploy/traefik/dynamic/erp.yml.bak-20261104-erp-ndmcore`
2. Added Traefik `Host(\`erp.ndmcore.com\`)` routers → `erp-frontend:80` (same as `erp.dincouture.pk`)
3. Origin cert files under `/etc/dokploy/traefik/dynamic/certificates/erp.ndmcore.com.{crt,key}`
4. TLS file: `/etc/dokploy/traefik/dynamic/erp-ndmcore-tls.yml`

## Verified

| Check | Result |
|-------|--------|
| `http://127.0.0.1:3001/` and `/m/` | 200 |
| Traefik `Host: erp.ndmcore.com` on `:443` | 200 for `/` and `/m/` |
| Direct `https://erp.ndmcore.com` via `--resolve ...:72.62.254.176` | 200 |
| Public `https://erp.ndmcore.com` (Cloudflare) | **502** until CF origin/tunnel fixed |
| `https://erp.dincouture.pk` | 200 (workaround) |
| `https://erp-stage.ndmcore.com` | 200 |

## Remaining Cloudflare step (required for public ndmcore hostname)

Cloudflare still returns **Host Error 502** for `erp.ndmcore.com`. Origin Traefik is healthy; CF is not successfully proxying to this VPS for that hostname (or SSL mode rejects the origin cert).

In Cloudflare dashboard for zone `ndmcore.com`:

1. **DNS → `erp` record**
   - Type **A** → `72.62.254.176` (this VPS), proxied (orange cloud), **or**
   - Fix **Cloudflare Tunnel** ingress so `erp.ndmcore.com` → `http://erp-frontend:80` (or `http://127.0.0.1:3001`) on this host — same pattern as a working host like `erp-stage.ndmcore.com` if that uses a tunnel.
2. **SSL/TLS**
   - Mode **Full** works with the current self-signed origin cert, **or**
   - Mode **Full (strict)** requires a **Cloudflare Origin CA** cert (SSL/TLS → Origin Server) installed as `erp.ndmcore.com.crt` / `.key` (replace self-signed).
3. After DNS/SSL change, wait 1–2 minutes, then:

```powershell
curl.exe -sS -o NUL -w "root=%{http_code}`n" https://erp.ndmcore.com/
curl.exe -sS -o NUL -w "m=%{http_code}`n" https://erp.ndmcore.com/m/
```

Expect **200**. `/m` is the same host — it recovers with the hostname, not a separate deploy.

## Sync this repo file to VPS

```bash
scp deploy/traefik/erp.yml dincouture-vps:/etc/dokploy/traefik/dynamic/erp.yml
scp deploy/traefik/erp-ndmcore-tls.yml dincouture-vps:/etc/dokploy/traefik/dynamic/erp-ndmcore-tls.yml
```

## Temporary user workaround

Use **`https://erp.dincouture.pk/`** and **`https://erp.dincouture.pk/m/`** (direct VPS, already 200).
