# Supabase + ERP Deployment Guide (Roman Urdu)

## Deployment Status (15 Feb 2026) ✅

- **Supabase:** Chal raha hai (`/root/supabase/docker`)
- **ERP Frontend:** Deploy ho chuka (Supabase keys ke sath)
- **Traefik:** erp.dincouture.pk + supabase.dincouture.pk configured

## Zaroori: DNS Record

Hostinger mein **supabase.dincouture.pk** ka A record add karein:
- Type: A | Name: supabase | Value: 72.62.254.176

Bina iske ERP Supabase se connect nahi kar payega.

---

## VPS Readiness Check ✅

```
RAM: 8GB total, ~6GB available
Swap: 4GB already configured
Disk: 78GB free
```

**Swap zaroorat:** Nahi – pehle se 4GB swap mojud hai. Agar installation fail ho to `swap-create.sh` chala dein.

---

## Step 1: Supabase Self-Hosted Setup

### Option A: Full Stack (Recommended – simpler)

Supabase apna Postgres le kar aata hai. Existing `dincouture-postgres` ko alag rehne dein.

```bash
# VPS par
cd /root
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker

# .env copy karein
cp .env.example .env

# CRITICAL - ye values change karein:
# POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
# SUPABASE_PUBLIC_URL=https://supabase.dincouture.pk
# SITE_URL=https://erp.dincouture.pk
# API_EXTERNAL_URL=https://supabase.dincouture.pk
```

### Option B: Existing PostgreSQL Use (Advanced)

Agar `dincouture-postgres` use karna hai to:
- Supabase migrations manually run karni hongi
- Roles (supabase_admin, authenticator) create karne honge
- Complex – pehle Option A try karein

---

## Step 2: ERP Frontend Deployment

```bash
cd /root/NEWPOSV3
git pull origin main

# Supabase keys (local Supabase se)
export VITE_SUPABASE_URL="https://supabase.dincouture.pk"   # Kong API URL
export VITE_SUPABASE_ANON_KEY="<your-anon-key-from-supabase>"

# Build
docker build -f deploy/Dockerfile \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  -t erp-frontend:latest .

# Run + dokploy-network
docker run -d --name erp-frontend-new \
  --network dokploy-network \
  --restart unless-stopped \
  erp-frontend:latest
```

---

## Step 3: Traefik Routing

`/etc/dokploy/traefik/dynamic/erp.yml` already hai – agar naya container `erp-frontend-new` hai to:

```yaml
# url: "http://erp-frontend-new:80"
```

Traefik restart: `docker restart $(docker ps -q --filter name=traefik)`

---

## Step 4: Health Check

- https://erp.dincouture.pk → Login screen
- Login karke Supabase connection verify

---

## Swap Create (Agar zaroorat ho)

```bash
# swap-create.sh
sudo fallocate -l 4G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
echo '/swapfile2 none swap sw 0 0' | sudo tee -a /etc/fstab
free -m
```
