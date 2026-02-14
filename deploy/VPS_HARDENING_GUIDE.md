# VPS Hardening Guide – erp.dincouture.pk

**Environment:** Ubuntu 24.04, Docker Swarm, Traefik (dokploy-traefik), n8n, ERP  
**Rules:** Do NOT stop dokploy-traefik. Do NOT remove Dokploy services. Only harden and fix routing.

---

## Quick Run (on VPS via SSH)

```bash
cd /path/to/NEWPOSV3   # or your project root
chmod +x deploy/vps-harden-and-verify.sh
./deploy/vps-harden-and-verify.sh
```

---

## 1. Harden n8n (port 5678)

**Goal:** Bind n8n to `127.0.0.1:5678` only (no public access).

**Manual steps if script fails:**

```bash
# Inspect current container
docker inspect n8n-production

# Stop and remove
docker stop n8n-production
docker rm n8n-production

# Recreate with localhost-only binding
docker run -d \
  --name n8n-production \
  --restart unless-stopped \
  -p 127.0.0.1:5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_HOST=127.0.0.1 \
  n8nio/n8n:latest

# Verify
ss -lntp | grep 5678
# Must show: 127.0.0.1:5678
```

---

## 2. Harden Dokploy (port 3000)

Docker Swarm services typically publish to `0.0.0.0`. To restrict 3000:

**Option A: UFW block (if Traefik is the only consumer)**

```bash
# Allow 3000 only from localhost
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw deny 3000
sudo ufw reload
```

**Option B: Service update (if supported)**

```bash
docker service ls
docker service inspect <dokploy-service-name> --format '{{.Endpoint.Ports}}'
# If Swarm supports host mode + 127.0.0.1, update publish
```

---

## 3. Verify Traefik

```bash
# Ports 80/443
ss -lntp | grep -E ':80|:443'

# Traefik container
docker ps | grep traefik

# Routers (if API enabled on 8080)
curl -s http://127.0.0.1:8080/api/http/routers | jq '.[].rule' | grep erp
```

**If ERP route missing:** Add labels to ERP service:

```yaml
# In your stack/service definition
labels:
  - "traefik.http.routers.erp.rule=Host(`erp.dincouture.pk`)"
  - "traefik.http.routers.erp.entrypoints=websecure"
  - "traefik.http.services.erp.loadbalancer.server.port=80"
```

---

## 4. Verify HTTPS

```bash
curl -I https://erp.dincouture.pk
# Expect: HTTP/2 200 or HTTP/1.1 200
```

---

## 5. Firewall (UFW)

```bash
sudo ufw status verbose
# Must allow only: 22/tcp, 80/tcp, 443/tcp
```

---

## Final Checklist

| Check | Command | Expected |
|-------|---------|----------|
| 5678 localhost only | `ss -lntp \| grep 5678` | `127.0.0.1:5678` |
| 3000 not public | `ss -lntp \| grep 3000` | Or UFW blocks external |
| 80/443 Traefik | `ss -lntp \| grep -E ':80\|:443'` | Traefik process |
| HTTPS 200 | `curl -I https://erp.dincouture.pk` | `HTTP/2 200` |
| UFW | `sudo ufw status` | 22, 80, 443 only |
