# Phase 7 — Telemetry & local dev console audit

**Scope:** Safe-zone documentation and Realtime URL hardening only. No GL, sale status, migrations, accounting lines, or `userService` schema changes.

Related: [`audit_log_latest.md`](audit_log_latest.md), [`system-lockdown-safety.mdc`](../.cursor/rules/system-lockdown-safety.mdc).

---

## 2026-05-21 — Console investigation (localhost web ERP)

### Symptoms observed

| Console signal | Classification | Action |
|----------------|----------------|--------|
| `POST http://127.0.0.1:7640/ingest/... net::ERR_CONNECTION_REFUSED` | **IDE / Cursor debug telemetry** — not ERP production code path | **No fix required** — no listener on port 7640 unless a debug session ingest server is started |
| `WebSocket connection to 'ws://localhost:5173/supabase/realtime/v1/websocket?...' failed` | **Dev Realtime URL** — REST/auth OK via Vite proxy; WS through proxy unreliable | **Fixed** — direct `wss://supabase.dincouture.pk/realtime/v1` in dev ([`src/lib/supabase.ts`](../src/lib/supabase.ts)) |
| `[AUTH] SIGNED_IN`, `[FETCH USER DATA SUCCESS]`, `[USER SERVICE] User updated successfully` | **Healthy auth + users pipeline** | **Locked as working** |

### `ERR_CONNECTION_REFUSED` on `127.0.0.1:7640`

- **Source:** Debug ingest calls in [`SettingsPageNew.tsx`](../src/app/components/settings/SettingsPageNew.tsx) and [`companyResetService.ts`](../src/app/services/companyResetService.ts) (session `91c22f`, hypothesis tracing). Each call uses `.catch(() => {})` so failures are silent to users.
- **Meaning:** Browser attempted to POST analytics to a **local ingest agent** that is not running. This is **not** Supabase, Kong, or ERP API failure.
- **Operator note:** Ignore during normal dev, or start the ingest server if actively debugging that session. Do not treat as login or user-creation failure.

### Users creation pipeline — locked functional

Evidence from same session (owner `mm@yahoo.com`, company `375fa03b-8e1e-46d3-9cfe-1cc20c02b473`):

| Step | Result |
|------|--------|
| Auth sign-in | `SIGNED_IN`, profile fetch **success**, role **owner** |
| Add / update user `te2` / `aa@yahoo.com`, role **salesman** | [`userService.ts`](../src/app/services/userService.ts) update **success** |
| Branch / account save | `identityId` resolved from `auth.users.id` |

**Locked:** Operational user CRUD via existing `userService` + RLS — **no schema or trigger changes** in this phase.

### Realtime hardening (implemented)

| Layer | Behavior |
|-------|----------|
| REST / Auth (dev) | Unchanged — `http://localhost:5173/supabase` Vite proxy → `https://supabase.dincouture.pk` |
| Realtime (dev) | `attachDirectRealtimeInLocalDev()` replaces client Realtime transport with `wss://supabase.dincouture.pk/realtime/v1` |
| Production (`erp.dincouture.pk`) | Unchanged — same-origin; no direct-WS override |

Parity pattern: [`erp-mobile-app/src/lib/supabase.ts`](../erp-mobile-app/src/lib/supabase.ts) `attachDirectRealtimeInLocalDev`.

### Files touched (this task)

| File | Change |
|------|--------|
| `docs/phase7_telemetry_audit_log.md` | **Created** — this file |
| `src/lib/supabase.ts` | Import `RealtimeClient`; attach direct WSS in Vite dev only |
| `docs/audit_log_latest.md` | Appended cross-reference entry |

### Explicitly NOT touched

- Migrations, `journal_entries`, sale/purchase finalize flows, GL triggers
- `SupabaseContext.tsx` session bridge shims (except using existing client after create)
- Counter PIN / mobile auth URL lockdown
- Removal of debug `7640` ingest calls (documented only; optional cleanup in a separate approved task)

---

## Protocol

Append new dated sections at the **top** (below this protocol block) for each future telemetry or console-noise investigation.
