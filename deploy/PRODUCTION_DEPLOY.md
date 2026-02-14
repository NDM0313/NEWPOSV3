# Production Deploy – erp.dincouture.pk

**VPS:** Ubuntu 24.04, Docker, UFW 22/80/443 only. Supabase self-host on same VPS.

---

## 1. Fix Domain – HTTPS on erp.dincouture.pk

### Prerequisites
- DNS A record: `erp.dincouture.pk` → VPS IP
- UFW: `sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable`

### Option A: Caddy (simplest – auto HTTPS)
```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Deploy ERP (from project root on VPS)
cd /path/to/NEWPOSV3
cp deploy/.env.production.example .env.production
# Edit .env.production: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
docker compose -f deploy/docker-compose.prod.yml build --build-arg VITE_SUPABASE_URL="$(grep VITE_SUPABASE_URL .env.production | cut -d= -f2)" --build-arg VITE_SUPABASE_ANON_KEY="$(grep VITE_SUPABASE_ANON_KEY .env.production | cut -d= -f2)"
docker compose -f deploy/docker-compose.prod.yml up -d

# Caddy reverse proxy
sudo tee /etc/caddy/Caddyfile << 'EOF'
erp.dincouture.pk {
    reverse_proxy localhost:3000
}
EOF
sudo systemctl restart caddy
```

### Option B: Nginx + Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot certonly --nginx -d erp.dincouture.pk
sudo cp deploy/nginx-ssl.conf /etc/nginx/sites-available/erp.dincouture.pk
# Edit paths if certbot used different dir
sudo ln -sf /etc/nginx/sites-available/erp.dincouture.pk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Verification
```bash
curl -sI https://erp.dincouture.pk | head -5
# Expect: HTTP/2 200
```

---

## 2. Safe Backup (even if demo data)

```bash
# Create backup dir
sudo mkdir -p /var/backups/erp
sudo chown $USER:$USER /var/backups/erp

# Get Supabase postgres credentials (from your Supabase self-host config)
# Typically in docker-compose or .env of Supabase install
export DB_HOST=localhost   # or supabase-db if in Docker network
export DB_PORT=5432
export DB_NAME=postgres
export DB_USER=postgres
export DB_PASSWORD="your-postgres-password"
export BACKUP_DIR=/var/backups/erp

chmod +x deploy/backup-supabase.sh
./deploy/backup-supabase.sh
ls -la /var/backups/erp/
```

### Cron (daily 2am)
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/NEWPOSV3/deploy/backup-supabase.sh") | crontab -
```

---

## 3. Final Validation + RLS Isolation Check

### 3.1 RLS + FORCE RLS
```sql
-- Run in Supabase SQL Editor (or psql)
SELECT relname, relforcerowsecurity
FROM pg_class
WHERE relname IN ('purchases', 'rentals', 'expenses');
-- Expect: relforcerowsecurity = true for all
```

### 3.2 Policies
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('purchases', 'rentals', 'expenses')
ORDER BY tablename, policyname;
-- Expect: 12 policies (4 per table)
```

### 3.3 Company Isolation (run while logged in as User A, then User B)
- **User A (Company X):** Test Pages → RLS Validation → Run Validation (with INSERT/UPDATE/DELETE tests)
- **User B (Company Y):** Same. Counts must differ; no cross-company data.

### 3.4 End-to-end
- Login → Dashboard loads
- Purchases: Create → Edit → Save
- Rentals: View → Edit → Save
- Expenses: Create → View → Edit → Delete
- No console errors, no 500s

---

## Checkpoints

| # | Check | Command / Action |
|---|-------|------------------|
| 1 | DNS resolves | `dig +short erp.dincouture.pk` |
| 2 | HTTPS works | `curl -sI https://erp.dincouture.pk` |
| 3 | ERP loads | Open https://erp.dincouture.pk in browser |
| 4 | Login works | Login with test user |
| 5 | Backup exists | `ls -la /var/backups/erp/` |
| 6 | RLS enforced | SQL + RLS Validation page |
| 7 | UFW strict | `sudo ufw status` → 22, 80, 443 only |

---

## Rollback
```bash
docker compose -f deploy/docker-compose.prod.yml down
# Restore from backup if needed:
# gunzip -c /var/backups/erp/supabase_YYYYMMDD_HHMMSS.sql.gz | psql -h localhost -U postgres -d postgres
```
