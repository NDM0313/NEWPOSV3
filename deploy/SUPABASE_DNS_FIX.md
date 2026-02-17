# supabase.dincouture.pk – Connection Refused / Not Working

## Cause

"Connection refused" or "Connection failed" when opening **https://supabase.dincouture.pk** usually means:

1. **No DNS A record** – The hostname does not resolve to your VPS IP, or
2. **Wrong IP** – It resolves to an IP that is not your server.

## Fix

### 1. Add DNS A record

In your DNS provider (e.g. Hostinger, Cloudflare) for **dincouture.pk**:

| Type | Name   | Value        | TTL  |
|------|--------|--------------|------|
| A    | supabase | **72.62.254.176** | 300  |

(Use your real VPS IP if different.)

### 2. Confirm on the server

Traefik is already configured to route `supabase.dincouture.pk` to Kong:

- File: `/etc/dokploy/traefik/dynamic/supabase.yml`
- Rule: `Host(\`supabase.dincouture.pk\`)` → `http://supabase-kong:8000`

No server config change is needed once DNS points to the VPS.

### 3. Optional: Use same-origin only

The ERP app can work **without** supabase.dincouture.pk:

- **VITE_SUPABASE_URL=https://erp.dincouture.pk** (current production setting)
- All auth/rest requests go to erp.dincouture.pk; nginx in the ERP container proxies them to Kong.

So login works even if supabase.dincouture.pk is not set up. Add the A record only if you need direct access to the Supabase API at that hostname.
