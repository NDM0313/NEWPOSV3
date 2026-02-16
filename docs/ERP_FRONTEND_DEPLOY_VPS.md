# ERP Frontend — VPS Deploy (Docker Swarm + Traefik)

**Goal:** `erp.dincouture.pk` par ERP frontend HTTPS (Let's Encrypt) par chalayein.  
**Note:** `din-erp-production` = DB; us par Traefik labels mat lagana.

---

## STEP 1 — Confirm frontend folder on VPS

```bash
cd ~
ls
```

Agar **NEWPOSV3** folder nahi hai to Step 2 se GitHub pull karo.

---

## STEP 2 — GitHub se fresh code pull

```bash
cd /root
rm -rf NEWPOSV3
git clone https://github.com/NDM0313/NEWPOSV3.git
cd NEWPOSV3
```

(Branch chahiye ho to: `git checkout main` ya `git checkout before-mobile-replace`.)

---

## STEP 3 — Check frontend structure

```bash
ls
```

Confirm: **package.json**, **vite.config.js** (ya vite.config.ts), **src/** hon.  
Vite React project hai to ye structure hona chahiye.

---

## STEP 4 — Production Dockerfile (already in repo)

Repo root mein **Dockerfile** maujood hai:

- Build stage: Node 20 → `npm ci` → `npm run build`
- Production stage: nginx:alpine → `dist` copy → port 80

Agar VPS par Dockerfile nahi dikhe to manually banao:

```dockerfile
# Build stage
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

---

## STEP 5 — Image build

```bash
cd /root/NEWPOSV3
docker build -t erp-frontend .
```

---

## STEP 6 — Swarm service create (Traefik labels)

```bash
docker service create \
  --name erp-frontend \
  --network dokploy-network \
  --label traefik.enable=true \
  --label "traefik.http.routers.erp.rule=Host(\`erp.dincouture.pk\`)" \
  --label traefik.http.routers.erp.entrypoints=websecure \
  --label traefik.http.routers.erp.tls.certresolver=letsencrypt \
  --label traefik.http.services.erp.loadbalancer.server.port=80 \
  erp-frontend
```

**Important:** `din-erp-production` (DB) par ye labels mat lagana.

---

## STEP 7 — Check

```bash
docker service ls
curl -I https://erp.dincouture.pk
```

**Expected:** `HTTP/2 200` (ya 200).  
Pehle 1–2 min certificate issue hone ka wait kar sakte ho.

---

## Agar 502 aaye

```bash
docker service logs erp-frontend --tail 50
```

Check: nginx start hua, port 80 listen ho raha hai.

---

## Result

- ERP frontend HTTPS par (erp.dincouture.pk)
- Let's Encrypt certificate automatic
- 404/502 nahi (frontend alag service, DB alag)
