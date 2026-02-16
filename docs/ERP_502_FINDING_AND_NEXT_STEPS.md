# erp.dincouture.pk — 502 Finding & Next Steps

## What we found

| Service name           | Image       | Role              | Port  |
|-----------------------|------------|-------------------|-------|
| **din-erp-production** | postgres:16 | **ERP database**  | 5432  |
| dincouture-n8n        | n8nio/n8n  | n8n               | 5678  |
| dokploy               | dokploy/dokploy | Dokploy UI    | 3000  |
| dokploy-traefik       | traefik:v3.6.7 | Reverse proxy | 80, 443 |

- **din-erp-production** is **PostgreSQL** (ERP DB), not the web app.
- Traefik labels were applied to this DB service, so `erp.dincouture.pk` was routed to Postgres → **502 Bad Gateway**.
- There is **no separate ERP frontend service** in Swarm (no nginx/Node serving the React app).

## What we did

- Removed all Traefik labels from **din-erp-production** (so erp.dincouture.pk no longer points at Postgres).
- **Traefik was not restarted.**

## What you need to do

1. **Deploy the ERP frontend** as its own service:
   - Build: `npm run build` → `dist/`
   - Run a container that serves `dist/` (e.g. **nginx** on port 80, or any image that serves the app on one port).
   - Deploy via Dokploy or `docker service create`, and attach it to the same network as Traefik (e.g. **dokploy-network**).

2. **Add Traefik labels to the frontend service only** (not to din-erp-production):
   - `traefik.enable=true`
   - `traefik.http.routers.erp.rule=Host(\`erp.dincouture.pk\`)`
   - `traefik.http.routers.erp.entrypoints=websecure`
   - `traefik.http.routers.erp.tls.certresolver=letsencrypt`
   - `traefik.http.services.erp.loadbalancer.server.port=80` (or the port your app listens on inside the container)

3. **Do not** add Traefik HTTP labels to **din-erp-production** again; that service is the DB.

## Script change (for later)

`scripts/erp-traefik-register.sh` should target the **ERP frontend** service name (e.g. a new name like `din-erp-frontend` or the name Dokploy gives the web app), and skip any service whose image is `postgres:*` or similar.
