# CRITICAL: erp.dincouture.pk Not Loading – Root Cause

**Diagnosis (from your environment):** `erp.dincouture.pk` returns **NXDOMAIN** – no DNS A record exists.

---

## Immediate Fix: Add DNS A Record

### Step 1: Get Your VPS Public IP

On your VPS, run:
```bash
curl -s ifconfig.me
```
Example output: `145.79.24.36` (use your actual IP)

### Step 2: Add A Record in DNS Provider

Where you manage `dincouture.pk` (e.g. Hostinger, Cloudflare, GoDaddy):

| Field | Value |
|-------|-------|
| **Type** | A |
| **Name** | `erp` (or `erp.dincouture.pk` if provider uses FQDN) |
| **Value** | Your VPS public IP (from Step 1) |
| **TTL** | 300 (or default) |

### Step 3: Wait for Propagation

- Usually 5–15 minutes
- Check: `dig +short erp.dincouture.pk` – should return your VPS IP

---

## After DNS Resolves: Run Full Diagnostic

On your VPS (from project root):

```bash
chmod +x deploy/diagnose-erp.sh
./deploy/diagnose-erp.sh
```

This checks:
- DNS
- Ports 80, 443, 3000
- Docker ERP container
- Caddy config
- HTTPS response

---

## If Caddy Config Is Wrong

```bash
sudo ./deploy/fix-erp-routing.sh
```

Or manually:
```bash
sudo tee /etc/caddy/Caddyfile << 'EOF'
erp.dincouture.pk {
    reverse_proxy localhost:3000
}
EOF
sudo systemctl restart caddy
```

---

## If ERP Container Not Running

From project root on VPS:
```bash
# Ensure .env.production exists with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
docker compose -f deploy/docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## Final Verification

```bash
curl -I https://erp.dincouture.pk
# Expect: HTTP/2 200
```

Then open https://erp.dincouture.pk in browser.
