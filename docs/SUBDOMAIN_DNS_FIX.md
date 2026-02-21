# Subdomain Not Working – Fix

## Current Status

| Subdomain | DNS (8.8.8.8) | Status |
|-----------|---------------|--------|
| erp.dincouture.pk | ❌ Not resolving | Add A record |
| n8n.dincouture.pk | ✅ 72.62.254.176 | Working |
| supabase.dincouture.pk | ❌ Not resolving | Add A record |
| studio.dincouture.pk | ❌ Not resolving | Add A record |

## Fix 1: Hosts File (Immediate – This Mac/PC Only)

**Mac:**
```bash
sudo bash scripts/fix-erp-hosts-mac.sh
```

**Windows:** Edit `C:\Windows\System32\drivers\etc\hosts` as Administrator, add:
```
72.62.254.176 erp.dincouture.pk supabase.dincouture.pk studio.dincouture.pk n8n.dincouture.pk
```

Then open https://erp.dincouture.pk. If you see a certificate warning, click **Advanced → Proceed**.

---

## Fix 2: DNS A Records (Permanent – All Users)

In **Hostinger** → Domains → dincouture.pk → DNS / Nameservers:

Add these A records (remove any duplicates for same name):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | erp | 72.62.254.176 | 300 |
| A | supabase | 72.62.254.176 | 300 |
| A | studio | 72.62.254.176 | 300 |

n8n already resolves. After adding, wait 5–15 minutes, then:
```bash
ssh dincouture-vps "docker restart \$(docker ps -q --filter name=traefik)"
```
