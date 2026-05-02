# Realtime Auto-Sync Deploy Guide

## Required environment variables

- `VITE_SUPABASE_URL` must point to your real Supabase API host.
- `VITE_SUPABASE_ANON_KEY` must be your project anon key (not the public demo key).
- Optional kill switch: `VITE_DISABLE_REALTIME=true` (only for emergency rollback).

## Deploy order

1. Update VPS `.env.production` with the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Rebuild and redeploy web/mobile bundles so Vite bakes new env values at build time.
3. Open web + mobile and confirm console health logs:
   - Web: `[Supabase] Realtime health: ...`
   - Mobile: `[ERP Mobile] Realtime health: ...`
4. Confirm `reason: "ok"` and `canUseRealtime: true` on both clients.

## Runtime behavior

- Realtime is primary transport for cross-client updates (mobile <-> web).
- Updates are domain-scoped (`sales`, `purchases`, `accounting`, `contacts`) with debounce.
- If realtime is disabled/unhealthy, UI falls back to lightweight targeted interval refresh on active modules.

