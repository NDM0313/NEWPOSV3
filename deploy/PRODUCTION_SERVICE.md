# ERP Production Service – Survives Reboot

**App:** Vite SPA (not Next.js). Build → static `dist/` → served by nginx (Docker) or `serve` (systemd).

---

## Detect Current Deployment

```bash
# Docker?
docker ps | grep -E 'erp|frontend'

# Systemd?
systemctl status erp-frontend 2>/dev/null || true

# What listens on 3000?
ss -lntp | grep 3000
```

---

## Recommended: Docker

### Config (already in repo)

- `deploy/Dockerfile` – multi-stage build + nginx
- `deploy/docker-compose.prod.yml` – `restart: always`, healthcheck

### Commands

```bash
# 1. Build + env (VITE_* baked in at build time)
cp deploy/.env.production.example .env.production
# Edit: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (self-hosted Supabase)

# 2. Build and start
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Enable on boot (Docker daemon)
sudo systemctl enable docker

# 4. Verify
docker ps
docker inspect erp-frontend --format '{{.State.Health.Status}}'
```

### Logs

```bash
docker logs -f erp-frontend
```

### Survives reboot

- `restart: always` – container restarts if it exits
- Docker daemon starts on boot → compose project auto-starts (if using `restart: always`)

---

## Alternative: Systemd (no Docker)

### 1. Build

```bash
sudo mkdir -p /opt/erp/app
sudo chown $USER:$USER /opt/erp/app
cd /opt/erp/app
git clone <repo> .   # or rsync/scp

# Env for build
cp deploy/.env.production.example .env.production
# Edit VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

export $(grep -v '^#' .env.production | xargs)
npm ci
npm run build
```

### 2. Install serve

```bash
sudo npm install -g serve
```

### 3. Service file

```bash
sudo cp deploy/erp-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable erp-frontend
sudo systemctl start erp-frontend
sudo systemctl status erp-frontend
```

### 4. Create user (optional)

```bash
sudo useradd -r -s /bin/false erp
sudo chown -R erp:erp /opt/erp/app
# Update service: User=erp, Group=erp
```

### Logs

```bash
journalctl -u erp-frontend -f
```

---

## Environment Variables

| Variable | When | Purpose |
|----------|------|---------|
| VITE_SUPABASE_URL | Build | Supabase API URL (baked into bundle) |
| VITE_SUPABASE_ANON_KEY | Build | Anon key (baked into bundle) |

Self-hosted Supabase: use your Kong URL, e.g. `https://supabase.dincouture.pk` or `https://api.dincouture.pk`.

---

## Verify After Reboot

```bash
# Docker
docker ps | grep erp-frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Systemd
systemctl is-active erp-frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

---

## Summary

| Method | Start | Logs | Reboot |
|--------|-------|------|--------|
| Docker | `docker compose up -d --build` | `docker logs -f erp-frontend` | Auto (restart: always) |
| Systemd | `systemctl start erp-frontend` | `journalctl -u erp-frontend -f` | Auto (enable) |

**Recommended:** Docker – isolated, healthcheck, same config across environments.
