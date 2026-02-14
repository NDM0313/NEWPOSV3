# Domain Routing Fix: https://erp.dincouture.pk

**Goal:** ERP frontend visible at https://erp.dincouture.pk  
**VPS:** Ubuntu 24.04, Docker, UFW 22/80/443 only

---

## Step 1: Diagnose DNS

```bash
# Resolve domain → must return VPS public IP
dig +short erp.dincouture.pk
nslookup erp.dincouture.pk
ping -c 2 erp.dincouture.pk
```

**Checkpoint:** Output = your VPS public IP. If empty/wrong, add A record in DNS.

```bash
# Get your VPS public IP for comparison
curl -s ifconfig.me
```

---

## Step 2: Verify 80/443 Listeners

```bash
# What's listening on 80/443?
sudo ss -lntp | grep -E ':80|:443'

# UFW status
sudo ufw status verbose | grep -E "80|443|Status"
```

**Checkpoint:** Ports 80 and 443 should be allowed. If not:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## Step 3: Identify Current Web Server

```bash
# Is nginx/caddy/traefik running?
systemctl is-active nginx 2>/dev/null || echo "nginx not installed"
systemctl is-active caddy 2>/dev/null || echo "caddy not installed"
systemctl is-active traefik 2>/dev/null || echo "traefik not installed"

# Docker containers
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"

# What process owns 80/443?
sudo ss -lntp | grep -E ':80|:443'
```

**Decision:** Use Caddy (simplest, auto-HTTPS) or Nginx + Certbot. Below: both options.

---

## Step 4: TLS Certificate (Let's Encrypt)

### Option A: Caddy (auto, no certbot)
Caddy obtains and renews certs automatically. Skip to Step 5A.

### Option B: Certbot (with Nginx)
```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
# Cert obtained when we add Nginx config + run certbot
```

---

## Step 5: Reverse Proxy Config

### Option A: Caddy (recommended)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Config
sudo tee /etc/caddy/Caddyfile << 'EOF'
erp.dincouture.pk {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl enable caddy
sudo systemctl restart caddy
sudo systemctl status caddy
```

### Option B: Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# 1. HTTP-only config first (certbot needs 80 to validate)
sudo tee /etc/nginx/sites-available/erp.dincouture.pk << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name erp.dincouture.pk;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/erp.dincouture.pk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 2. Get certificate (certbot will modify config to add SSL)
sudo certbot --nginx -d erp.dincouture.pk --non-interactive --agree-tos -m admin@dincouture.pk

# 3. Verify certbot updated config
sudo nginx -t && sudo systemctl reload nginx

# 4. Auto-renew
sudo certbot renew --dry-run
```

---

## Step 6: Ensure ERP Is Running on 3000

```bash
# If using Docker (from project root)
docker compose -f deploy/docker-compose.prod.yml ps

# If not running, start:
# cp deploy/.env.production.example .env.production
# Edit .env.production with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build

# Verify something listens on 3000
ss -lntp | grep 3000
# or
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

---

## Step 7: Restart and Verify

```bash
# Caddy
sudo systemctl restart caddy

# OR Nginx
sudo systemctl restart nginx
```

### Checkpoints

```bash
# 1. HTTP → 301 redirect or 200
curl -I http://erp.dincouture.pk

# 2. HTTPS → 200
curl -I https://erp.dincouture.pk

# 3. No 502/504
curl -s -o /dev/null -w "%{http_code}" https://erp.dincouture.pk
# Expect: 200
```

---

## Final Working Configs

### Caddy (`/etc/caddy/Caddyfile`)

```
erp.dincouture.pk {
    reverse_proxy localhost:3000
}
```

### Nginx (`/etc/nginx/sites-available/erp.dincouture.pk`)

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name erp.dincouture.pk;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name erp.dincouture.pk;

    ssl_certificate /etc/letsencrypt/live/erp.dincouture.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.dincouture.pk/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Optional: Supabase API Route

If Supabase Kong is on localhost:8000 and you want `https://erp.dincouture.pk/supabase` → Kong:

### Caddy
```
erp.dincouture.pk {
    handle /supabase/* {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

### Nginx (inside the 443 server block)
```nginx
    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Then set `VITE_SUPABASE_URL=https://erp.dincouture.pk/supabase` and rebuild.

---

## Certbot Status (Nginx only)

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 502 Bad Gateway | ERP not running on 3000: `ss -lntp \| grep 3000` |
| 504 Timeout | Firewall blocking: `sudo ufw status` |
| No cert | DNS must resolve before certbot; wait 5 min after DNS change |
| Wrong page | Clear browser cache; verify proxy_pass port |
