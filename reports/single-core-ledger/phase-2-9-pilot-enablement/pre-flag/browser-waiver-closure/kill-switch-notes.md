# Kill switch — browser waiver

**Status:** WAIVED (env rebuild not executed)

**DB check (2.9A):** `unified_ledger_kill_switch` row **absent** for DIN CHINA (same as all flags OFF).

**Env kill procedure (when preview build available):**

1. Set `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true` in `.env.local` or staging env.
2. Rebuild and restart dev/staging server.
3. Open Ledger V2 as admin — preview toggle **disabled**, killed banner shown.
4. Confirm no preview RPC when toggle would be ON.
5. Open `/admin/unified-ledger-tieout` — compare still runs (`shadowForce`).

**Action:** Ops runs on **staging** after preview deploy; not required on production for 2.9A-2 closure if staging matches prod flags (all OFF).
