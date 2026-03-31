# Runbook: Accessing Supabase Studio API Keys (Self-Hosted)

## Overview
This runbook describes how to retrieve and use the default `anon` and `service_role` keys in a self-hosted Supabase environment.

## Method 1: Command Line (Recommended & Stable)
Since the Supabase Studio modern UI for API Keys is partially incompatible with self-hosted metadata, the most reliable way to retrieve your keys is directly from the server environment.

Run this command on your VPS to see the live credentials:
```bash
grep -E 'ANON_KEY|SERVICE_ROLE_KEY' /root/supabase/docker/.env
```

## Method 2: IDE Integration (Cursor/VS Code)
Use these credentials for your local development or IDE integration:
- **Project URL:** `https://supabase.dincouture.pk`
- **Anon Key:** (Run the command in Method 1 to retrieve)
- **Service Role Key:** (Run the command in Method 1 to retrieve)

## Method 3: Supabase Studio (Legacy View)
If you must use the Studio UI, navigate to:
**Settings > API**

Note: If the "API Keys" page appears broken or displays "New API key creation is not supported", please fall back to Method 1. The dashboard stability has been prioritized over UI-based key retrieval.

## Emergency Stability Check
If the Studio dashboard crashes (e.g., `(A ?? []).filter is not a function`):
1. **Rollback Traefik:** Ensure `/etc/dokploy/traefik/dynamic/supabase.yml` points to `studio:3000` directly.
2. **Restart Traefik:** Traefik should reload automatically upon file change.
3. **Clear Browser Cache:** Perform a hard reload (Cmd+Shift+R or Ctrl+F5) to clear any cached malformed JSON responses.
