# Root Cause Analysis: Supabase Studio Dashboard Crash (Self-Hosted)

## Observed Issue
After implementing a broad metadata bridge for the "API Keys" page, the main Supabase Studio dashboard (`/project/default`) began crashing with a client-side exception: `(A ?? []).filter is not a function`.

## Root Cause
The broad mocking of `/api/platform/projects/default` in the `erp-studio-injector` middleware returned a single JSON object. However, the modern Studio dashboard expects this endpoint to return either an array of projects or an object with specific array-like properties that can be filtered.

When the dashboard attempted to filter the project list using `.filter()`, it encountered a non-array object, causing the React/Next.js application to crash.

## Resolution (Emergency Rollback)
1. **Traefik Routing Rollback:** Reverted the Traefik configuration to point directly to the original Studio container (`studio:3000`) instead of the injector middleware.
2. **Direct Access Restored:** Studio now handles requests natively. While the "API Keys" page may still show 404s for platform routes, the core dashboard stability is restored.
3. **Manual Path Recommendation:** For self-hosted environments, API keys should be retrieved directly from the server environment (`.env`) rather than relying on the Studio UI bridge, which can introduce instability due to schema mismatches.

## Files Changed
- `/etc/dokploy/traefik/dynamic/supabase.yml`: Reverted `studio-dincouture` service URL to `http://studio:3000`.
- `/root/NEWPOSV3/docs/infra/SUPABASE_STUDIO_API_KEYS_ROOT_CAUSE.md`: Updated with this post-mortem.
- `/root/NEWPOSV3/docs/infra/SUPABASE_STUDIO_API_KEYS_RUNBOOK.md`: Updated to emphasize manual credential retrieval.
