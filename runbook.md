# Runbook: Supabase Studio API Keys Management (Self-Hosted)

## How to obtain credentials for Cursor/IDE tools
Since creating new API keys via the Studio UI is unsupported in self-hosted mode, you must use the existing keys defined in your environment.

### 1. Usable Credentials
- **Project URL**: `https://supabase.dincouture.pk`
- **Anon Key**: (Retrieve from Studio or `.env`)
- **Service Role Key**: (Retrieve from Studio or `.env`)

### 2. Accessing Keys via Studio
1. Open Supabase Studio: `https://studio.dincouture.pk`
2. Go to **Settings** > **API Keys**.
3. Click the **Legacy API Keys** tab.
4. You will see your `anon` and `service_role` keys there.

### 3. Accessing Keys via VPS
If Studio is unavailable, you can find the keys on the VPS:
```bash
ssh dincouture-vps "grep -E 'ANON_KEY|SERVICE_ROLE_KEY' /root/supabase/docker/.env"
```

## Troubleshooting the API Keys Page
If the API Keys page shows 404/405 errors:
1. Check if the `erp-studio-injector` is running:
   ```bash
   docker ps | grep erp-studio-injector
   ```
2. Check injector logs for errors:
   ```bash
   docker logs erp-studio-injector
   ```
3. Verify Traefik routing:
   ```bash
   cat /etc/dokploy/traefik/dynamic/supabase.yml
   ```
   It should point to `http://erp-studio-injector:8080`.

## Why "Create API Key" fails
This button is meant for Supabase Platform users. In self-hosted mode, API keys are static and managed via the `JWT_SECRET` in your `.env` file. Clicking this button will now show a clear error message explaining this limitation.
