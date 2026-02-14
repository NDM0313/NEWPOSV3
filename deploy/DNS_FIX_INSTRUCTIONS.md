# erp.dincouture.pk DNS Fix

## Option 1: Hostinger API (automated)

**Agar token invalid hai:** hPanel → Profile → API → naya token banao.

```bash
# Token set karo (naya token from hPanel)
export API_TOKEN="your-new-hostinger-api-token"

# VPS IP confirm karo (agar different hai)
export VPS_IP="154.192.0.160"

# Script chalao
./deploy/add-erp-dns-hostinger.sh
```

## Option 2: Manual (hPanel)

1. **hPanel** → https://hpanel.hostinger.com
2. **Domains** → dincouture.pk → **DNS / Nameservers**
3. **Add Record:**
   - Type: **A**
   - Name: **erp**
   - Points to: **154.192.0.160** (ya apna VPS IP)
   - TTL: 300
4. Save

## Option 3: Cursor mein Hostinger MCP use karo

1. Cursor restart karo (taake Hostinger MCP load ho)
2. Naya chat kholo
3. Pucho: "Add DNS A record erp.dincouture.pk pointing to 154.192.0.160 using Hostinger"
4. Hostinger MCP tools se add ho sakta hai

## Verify

```bash
dig +short erp.dincouture.pk
# 5-10 min baad VPS IP dikhna chahiye
```
