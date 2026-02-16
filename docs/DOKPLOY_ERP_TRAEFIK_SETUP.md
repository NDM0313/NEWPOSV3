# Dokploy + Traefik — Register ERP at erp.dincouture.pk

**VPS:** 72.62.254.176  
**Domain:** erp.dincouture.pk (DNS resolving)  
**Issue:** Traefik returns 404 — ERP container not registered. SSL self-signed without proper router.

**Containers:** dokploy-traefik, dokploy (3000), **din-erp-production** (ERP), dincouture-n8n, postgres.

---

## Automated (recommended): Run script on VPS

1. Copy `scripts/erp-traefik-register.sh` to the VPS (e.g. `/root/erp-traefik-register.sh`).
2. Run:
   ```bash
   chmod +x /root/erp-traefik-register.sh
   bash /root/erp-traefik-register.sh
   ```
3. Script will: find **din-erp-production**, resolve compose dir, create `docker-compose.traefik-override.yml` with Traefik labels + **dokploy-network**, redeploy only the ERP service, then `curl -I https://erp.dincouture.pk`.

**Optional:** If the app inside the container listens on port 80 (e.g. nginx), run:
```bash
ERP_PORT=80 bash /root/erp-traefik-register.sh
```

**Do NOT** restart dokploy-traefik. Script only redeploys the ERP service.

---

## Manual steps (if script cannot find compose)

### 1. Identify ERP container (port 3000)

On VPS run:

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Image}}" | grep -E "3000|NAMES"
```

Or list all and find the one with `3000/tcp` or `0.0.0.0:3000`:

```bash
docker ps -a --format "table {{.Names}}\t{{.Ports}}\t{{.Image}}"
```

Note the **service/container name** and the **compose project** (folder or stack name) so you can edit the right compose file.

---

## 2. Add Traefik labels to ERP service

Add these labels to the ERP service (in its `docker-compose.yml` or in Dokploy app settings):

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.erp.rule=Host(`erp.dincouture.pk`)
  - traefik.http.routers.erp.entrypoints=websecure
  - traefik.http.routers.erp.tls.certresolver=letsencrypt
  - traefik.http.services.erp.loadbalancer.server.port=3000
```

**If using Docker Compose file:** open the compose file for the ERP app and add the `labels` block under the ERP service. Ensure the service has:

```yaml
services:
  erp:   # or your actual service name
    image: ...
    labels:
      - traefik.enable=true
      - traefik.http.routers.erp.rule=Host(`erp.dincouture.pk`)
      - traefik.http.routers.erp.entrypoints=websecure
      - traefik.http.routers.erp.tls.certresolver=letsencrypt
      - traefik.http.services.erp.loadbalancer.server.port=3000
    networks:
      - dokploy-network
    # ... rest of config

networks:
  dokploy-network:
    external: true
```

**If using Dokploy UI:** In the application settings, add the same labels in the “Labels” or “Docker labels” section, and attach the network `dokploy-network`.

---

## 3. Attach ERP to dokploy-network

Ensure the ERP service is on the same network as Traefik so it can be discovered.

**Compose:** add to ERP service:

```yaml
networks:
  - dokploy-network
```

And at bottom of compose:

```yaml
networks:
  dokploy-network:
    external: true
```

**If network does not exist**, create it (once):

```bash
docker network create dokploy-network
```

Then connect the running ERP container (temporary until recreated with compose):

```bash
docker network connect dokploy-network <ERP_CONTAINER_NAME>
```

Permanent way: add `dokploy-network` to the compose file and recreate the service (step 4).

---

## 4. Restart only ERP service

From the directory that contains the ERP `docker-compose.yml`:

```bash
docker compose up -d erp
```

Replace `erp` with the actual service name if different (e.g. `app`, `frontend`).

If you use Dokploy, use “Redeploy” or “Restart” for the ERP application only.

**Do NOT** restart or remove `dokploy-traefik`. Do NOT expose new public ports.

---

## 5. Verify

```bash
curl -I https://erp.dincouture.pk
```

**Expected:** `HTTP/2 200` (or at least no 404).

If you get certificate errors at first, wait 1–2 minutes for Let’s Encrypt (certresolver=letsencrypt) to issue the cert.

---

## Checklist

| Step | Action |
|------|--------|
| 1 | Find ERP container (port 3000) and its compose/service name |
| 2 | Add the 5 Traefik labels to ERP service |
| 3 | Add/attach `dokploy-network` to ERP service |
| 4 | Restart only ERP: `docker compose up -d <erp_service>` |
| 5 | Run `curl -I https://erp.dincouture.pk` → expect HTTP/2 200 |

---

## Note on certresolver name

If Traefik was configured with a different resolver name (e.g. `le` instead of `letsencrypt`), use that in the label:

```text
traefik.http.routers.erp.tls.certresolver=le
```

Check Traefik static config or Dokploy Traefik settings for the actual cert resolver name.
