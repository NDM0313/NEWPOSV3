# Session log: localhost console cleanup (2026-04-18)

## Source

Analysis of browser console export `localhost-1777665939780.log` (Vite dev on port 5173, Supabase proxied at `/supabase`).

## Issues addressed (code)

1. **`document_sequences` 406 (Not Acceptable)**  
   - **Cause:** `getDocumentSequence` used `.single()` when more than one row could match `company_id` + `document_type` + `branch_id is null`.  
   - **Fix:** [`settingsService.ts`](../../src/app/services/settingsService.ts) — use `.limit(1).maybeSingle()`.

2. **Google Fonts `ERR_CONNECTION_TIMED_OUT`**  
   - **Cause:** Remote `@import` in [`fonts.css`](../../src/styles/fonts.css).  
   - **Fix:** Removed import; set `html, body` to a system UI font stack (no network) in [`fonts.css`](../../src/styles/fonts.css).

3. **Realtime WebSocket noise (`ws://localhost:5173/supabase/realtime/...` failed)**  
   - **Cause:** Placeholder anon JWT (`iss: supabase-demo`) while REST is proxied to production Kong.  
   - **Fix:** Export `isPlaceholderSupabaseAnonKey` in [`supabase.ts`](../../src/lib/supabase.ts); skip Realtime `subscribe` in [`RentalContext`](../../src/app/context/RentalContext.tsx) and [`AccountingContext`](../../src/app/context/AccountingContext.tsx) when true (also respect existing `VITE_DISABLE_REALTIME`). Warn once in dev when demo key detected.

4. **Verbose debug logs**  
   - **Fix:** [`debugErp.ts`](../../src/app/lib/debugErp.ts) — `localStorage DEBUG_ERP=1` enables traces. Gated: [`AccountLedgerReportPage.tsx`](../../src/app/components/reports/AccountLedgerReportPage.tsx) (`STATEMENT_FILTER_TRACE`), [`SettingsContext.tsx`](../../src/app/context/SettingsContext.tsx) (`PERM_DEBUG`), [`inventoryService.ts`](../../src/app/services/inventoryService.ts) (negative stock warnings).

5. **`public.users` REST 500**  
   - **Cause:** Server-side (PostgREST / DB / RLS); client query already uses `.maybeSingle()`.  
   - **Fix:** Richer **dev** logging in [`SupabaseContext.tsx`](../../src/app/context/SupabaseContext.tsx) (`details`, `hint` on PostgREST errors).

## Ops / environment (manual)

- Set **`VITE_SUPABASE_ANON_KEY`** to the **real project anon key** (not the demo JWT) for local dev so Realtime and auth align with the proxied API.
- If **`users` 500** persists, inspect Supabase API / Postgres logs for the failing SQL or RLS policy.

## Optional developer toggle

```js
localStorage.setItem('DEBUG_ERP', '1'); // then refresh — verbose PERM / statement / inventory traces
localStorage.removeItem('DEBUG_ERP');
```
