# ERP Frontend Deploy on VPS (Dokploy/Swarm)

**Current state:** `din-erp-production` = Postgres DB. ERP **frontend** (React app) is NOT deployed.

---

## Step 1: Get project on VPS

```bash
# Option A: Clone from Git (if you have a repo)
cd /root  # or /opt
git clone https://github.com/YOUR_ORG/NEWPOSV3.git
cd NEWPOSV3

# Option B: SCP from your Mac
# On your Mac:
# scp -r /path/to/NEWPOSV3 root@154.192.0.160:/root/
# Then on VPS: cd /root/NEWPOSV3
```

---

## Step 2: Find Traefik network

```bash
docker network ls | grep -E overlay
# Note the network name (e.g. dokploy_default, traefik-public, ingress)
```

---

## Step 3: Build ERP image

```bash
cd /root/NEWPOSV3   # or wherever you cloned

# Set Supabase vars (get from Supabase dashboard)
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_ANON_KEY="your-anon-key"

docker build -t erp-frontend:latest \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -f deploy/Dockerfile .
```

---

## Step 4: Create ERP frontend service

```bash
# Replace NETWORK_NAME with output from Step 2 (e.g. dokploy_default)
docker service create \
  --name erp-frontend \
  --replicas 1 \
  --network dokploy_default \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.erp.rule=Host(\`erp.dincouture.pk\`)" \
  --label "traefik.http.routers.erp.entrypoints=websecure" \
  --label "traefik.http.routers.erp.tls=true" \
  --label "traefik.http.services.erp.loadbalancer.server.port=80" \
  erp-frontend:latest
```

---

## Step 5: Verify

```bash
docker service ls
curl -I https://erp.dincouture.pk
```

---

## If Traefik network not found

Dokploy may use a different Traefik setup. Check:

```bash
docker ps | grep traefik
docker network inspect $(docker ps -q --filter name=traefik) 2>/dev/null | grep -A2 Networks
```
