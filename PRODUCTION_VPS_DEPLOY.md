# Production VPS Deploy — Supabase ERP

**Important:** Yeh ERP **Supabase** use karta hai. DB aur saari RPCs **Supabase Cloud** par chalte hain. VPS par sirf **frontend** (dist/) serve hota hai — local PostgreSQL is app ke liye use nahi hota.

---

## 🎯 Architecture

```
Browser / PWA  →  VPS (Nginx, dist/)  →  Supabase Cloud (API, Auth, DB, RPCs)
```

- **VPS:** Sirf static files (React build). Port 8080 ya 80/443.
- **Supabase:** Production project (URL + anon key). Migrations bhi wahi run hoti hain.

---

## ✅ STEP 1 – Production Folder (VPS par SSH ke baad)

```bash
mkdir -p /root/erp-production/frontend
cd /root/erp-production
```

---

## ✅ STEP 2 – docker-compose.yml (Sirf Frontend)

VPS par **PostgreSQL zaroori nahi** — app Supabase se connect karti hai. Sirf frontend serve karo:

```bash
nano docker-compose.yml
```

**Yeh paste karo:**

```yaml
version: '3.9'

services:
  frontend:
    image: nginx:stable-alpine
    container_name: erp_frontend
    restart: always
    ports:
      - "8080:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
    networks:
      - erp_network

networks:
  erp_network:
```

Save (Ctrl+O, Enter, Ctrl+X).

**Agar 80/443 use karna ho** (Nginx host pe reverse proxy ke baad), port change karo, e.g. `"80:80"`.

---

## ✅ STEP 3 – Build Local PC Par (Production Env Ke Sath)

App **build time** par Supabase URL/key leeti hai. Production Supabase project use karo.

**Local / CI par:**

1. `.env.production` banao (ya production wale `.env`):
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your_production_anon_key
   ```

2. Build chalao:
   ```bash
   npm run build
   ```

3. `dist/` folder tayyar — isi ko VPS par upload karna hai.

⚠️ **Production DB accidentally connect mat karo** — URL/key production Supabase ki honi chahiye.

---

## ✅ STEP 4 – dist/ VPS Par Upload

Local `dist/` ko VPS ke **/root/erp-production/frontend/** mein daalo.

- WinSCP / FileZilla: `dist` ke andar ki **saari files** (index.html + assets/) ko `frontend/` mein upload karo taake path ho: `/root/erp-production/frontend/index.html`, `frontend/assets/...`
- Ya local se: `scp -r dist/* root@72.62.254.176:/root/erp-production/frontend/`

---

## ✅ STEP 5 – Frontend Container Start

```bash
cd /root/erp-production
docker compose up -d
```

Check: `docker ps` — `erp_frontend` running dikhna chahiye.

Browser: **http://72.62.254.176:8080** — ERP open honi chahiye (Supabase production se connect).

---

## 📱 PWA / Mobile

Agar `manifest.json` aur service worker configured hain:

- Chrome (mobile) → 3 dots → **Install app** — app install ho jayegi.

HTTPS recommend hai PWA ke liye (baad mein reverse proxy + SSL add kar sakte ho).

---

## 🔒 Security

- **5432 VPS par expose mat karo** — is setup mein postgres hai hi nahi, to koi risk nahi.
- **Supabase keys** `.env.production` mein rahen; repo mein commit mat karo.
- HTTPS ke liye host pe Nginx/Caddy reverse proxy use karo, container 8080 internal rakh sakte ho.

---

## 🗄 Database / Migrations

- **DB:** Supabase Dashboard ya `DATABASE_URL` se run (e.g. `node scripts/run-migrations.js`).
- **VPS par migrations run karne ki zaroorat nahi** — Supabase hi source of truth hai.

---

## 🛡 Backup (Supabase)

Production DB backup Supabase se lo (Dashboard → Backups, ya `pg_dump` via Supabase DB connection string). VPS par alag postgres optional hai agar aap local backup copy rakhna chahte ho — us case mein alag backup script use karo; app phir bhi Supabase se hi chalegi.

---

## 📋 Summary

| Item | Kahan |
|------|--------|
| Frontend | VPS – `/root/erp-production/frontend/dist` |
| DB + RPCs | Supabase Cloud |
| Build env | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (production) |
| Migrations | Supabase par (script ya Dashboard) |

---

## Optional: Agar VPS Par PostgreSQL Backup Copy Chahiye

Agar aap chahte ho ke VPS par bhi postgres chale (sirf backup/restore ke liye), alag `docker-compose.override.yml` ya second compose file bana sakte ho — lekin **ERP app us local postgres se connect nahi karegi**; app hamesha Supabase se chalegi.
