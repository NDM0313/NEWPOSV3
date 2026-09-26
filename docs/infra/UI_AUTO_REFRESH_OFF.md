# UI auto-refresh (Realtime + fallback poll) — default OFF

## Policy

Passive UI remounts from Supabase Realtime, fallback polling, and visibility-driven reloads are **off by default** on web and mobile (`erp-mobile-app`), so Accounting / statements keep scroll position and filters during testing.

Still allowed:

- Explicit header / per-screen **Refresh**
- Invalidations after **this user’s** save / cancel / delete (local mutation dispatch)
- `erp:globalRefresh` / equivalent user-triggered refresh

Not allowed when the flag is off:

- `realtime-change`
- `fallback-poll`
- Visibility-driven accounting remounts

## Flag

| Value | Behavior |
|-------|----------|
| unset or any value other than `1` | Auto-refresh **off** (default) |
| `VITE_UI_AUTO_REFRESH=1` | Re-enable Realtime bridge + fallback poll + visibility reloads |

Web: `src/app/lib/uiAutoRefresh.ts`  
Mobile: `erp-mobile-app/src/lib/uiAutoRefresh.ts`

Documented in root `.env.example` and `erp-mobile-app/.env.example`.

## Realtime WebSocket

When Realtime WS fails repeatedly, the client now **tears down** channels (`removeAllChannels` + `realtime.disconnect`) so the browser does not keep reconnecting and spamming the console. With auto-refresh off, the web bridge does not subscribe and does not start the 120s fallback poll; local-dev direct WSS attach is also skipped unless `VITE_UI_AUTO_REFRESH=1`.

## How to re-enable

1. Set `VITE_UI_AUTO_REFRESH=1` in `.env.local` / `.env.production` (and mobile env as needed).
2. Rebuild / restart Vite (Vite inlines env at build time).
3. For VPS ERP image: ensure the build arg / `.env.production` includes `VITE_UI_AUTO_REFRESH=1`, then rebuild with CACHEBUST.
