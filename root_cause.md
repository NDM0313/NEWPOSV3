# Root Cause Analysis: Supabase Studio API Keys Creation Failure (Updated)

## Issue Description
Users were unable to create or view API keys in Supabase Studio. The UI displayed a "Failed to create API key" error, and the "Legacy API Keys" tab appeared broken. Console logs showed 404 errors for several platform routes.

## Root Cause
The modern Supabase Studio UI (React) expects several "Platform" management routes that are either missing or differently named in the self-hosted backend (NestJS).

Specific failing routes:
1. `GET /api/platform/organizations/default`: The UI is hardcoded to call `default`, but the backend uses a dynamic slug.
2. `GET /api/platform/projects/default`: The UI expects project metadata here.
3. `GET /api/platform/projects/default/config/api`: The UI expects API configuration details.
4. `GET /api/v1/projects/default/api-keys/legacy`: The UI expects legacy keys here, but the backend serves them at `/api/v1/projects/default/api-keys`.
5. `POST /api/v1/projects/default/api-keys`: Self-hosted Supabase does not support creating new keys via the UI.

## Resolution
We utilized the `erp-studio-injector` as a middleware bridge to intercept and mock these routes.

Changes made:
1. **Enhanced `erp-studio-injector`**:
   - Mocks `/api/platform/organizations/default`.
   - Mocks `/api/platform/projects/default`.
   - Mocks `/api/platform/projects/default/config/api`.
   - Bridges `/api/v1/projects/default/api-keys/legacy` to `/api/v1/projects/default/api-keys`.
   - Provides a custom 405 error message for the `POST` method on API keys.
2. **Verified Traefik configuration**:
   - Confirmed `/etc/dokploy/traefik/dynamic/supabase.yml` routes `studio.dincouture.pk` through the injector.

## Why this fix is safe
- It doesn't modify core Supabase binaries or the database.
- It doesn't rotate secrets.
- It provides a graceful user experience for self-hosted limitations.

## Self-hosted Limitations
Creating new publishable or secret API keys via the Studio UI is **unsupported by design** in self-hosted Supabase. Keys are managed via the `.env` file and derived from the `JWT_SECRET`. The "Legacy API Keys" tab now correctly displays the existing `anon` and `service_role` keys.
