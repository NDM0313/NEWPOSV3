# Phase 2.9A — DIN CHINA Live Waiver Clearance (Ops Check)

**Sign-off state:** `PHASE 2.9A LIVE WAIVER CHECKS PASS WITH WAIVERS — review before Stage 1`  
**Timestamp (UTC):** 2026-06-25T12:47:00Z  
**Branch / commit:** `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` @ `fe1b9c15`  
**Tester:** Cursor agent (ops check mode — read-only production SQL + local unit tests)  
**Environment:** Production DB via `ssh dincouture-vps` → `supabase-db` (read-only); ERP UI `https://erp.dincouture.pk` (not authenticated in this session)  
**Production DB mutation:** **NONE**  
**Flag enablement:** **NONE**

---

## DIN CHINA confirmation

| Field | Value | Result |
|-------|-------|--------|
| Company ID | `30bd8592-3384-4f34-899a-f3907e336485` | **PASS** (SQL) |
| Company name | DIN CHINA | **PASS** |

Evidence: [`query-din-china-company.sql`](query-din-china-company.sql), [`pre-flag-flags.json`](pre-flag-flags.json)

---

## Check results

| # | Check | Method | Result | Notes |
|---|-------|--------|--------|-------|
| 1 | All unified ledger flags OFF for DIN CHINA | Production read-only SQL | **PASS** | 0 rows in `feature_flags` for `unified_ledger%` |
| 2 | Admin/developer login on DIN CHINA | Live browser | **WAIVED** | No credentials / no browser session in ops check agent run |
| 3 | Open Ledger V2 | Live browser | **WAIVED** | Requires authenticated UI session |
| 4 | Preview toggle visible, default OFF | Live browser | **WAIVED** | Code + 2.8 unit tests; not live-verified on `erp.dincouture.pk` |
| 5 | Banner mode `legacy` | Live browser | **WAIVED** | Expected when flags OFF; not live-verified |
| 6 | DevTools Network open | Live browser | **WAIVED** | — |
| 7 | No `get_unified_party_ledger` / `get_unified_account_ledger` with toggle OFF | Network HAR | **WAIVED** | Preview loader gated on `unifiedPreviewEnabled` in code; HAR not captured |
| 8 | Preview toggle ON | Live browser | **WAIVED** | — |
| 9 | MR JALIL shortcut | Live browser | **WAIVED** | — |
| 10 | Unified closing PKR 216,300 ±0.01 | Read-only production RPC | **PASS** | Last row `running_balance` = **216300.00** — see [`mr-jalil-rpc-verification.json`](mr-jalil-rpc-verification.json) |
| 11 | Preview JSON export non-official | Live browser | **WAIVED** | Export filename pattern `phase2-compare-ledger-v2-*.json` in codebase |
| 12 | PDF/Excel legacy totals only | Live browser | **WAIVED** | 2.8 static inspection PASS; not live export spot-check |
| 13 | Staff/manager: no preview toggles | Live browser | **WAIVED** | 15 access unit tests PASS (112/112) |
| 14 | Admin Compare Center loads | Live browser | **WAIVED** | Route `/admin/unified-ledger-tieout` not exercised live |
| 15 | Kill-switch dry-run | Staging rebuild or DB read | **PARTIAL** | DB `unified_ledger_kill_switch` absent (same as flags OFF); env rebuild not run |
| — | `npm run test:unified-ledger` | Local | **PASS** | 112/112 at ops check time |

---

## Phase 2.8 waiver clearance status

| 2.8 waiver | 2.9A status |
|------------|-------------|
| Live DIN CHINA walkthrough | **Open** — needs ops browser session on deployed preview build |
| Network HAR (toggle OFF) | **Open** |
| Preview JSON download | **Open** |
| Kill-switch rebuild | **Open** (DB kill flag confirmed absent; env kill not rebuilt) |

---

## Automated evidence (completed)

- [`pre-flag-flags.json`](pre-flag-flags.json) — all `unified_ledger%` flags absent
- [`mr-jalil-rpc-verification.json`](mr-jalil-rpc-verification.json) — golden closing **216,300**
- Read-only SQL scripts: `query-din-china-flags.sql`, `query-din-china-company.sql`, `query-mr-jalil-*.sql`

---

## Recommendation

1. **Do not run Stage 1 SQL yet** — complete remaining **live browser** waivers on DIN CHINA as admin/developer (and staff negative check) on a build that includes Phase 2.3–2.7 preview UI (staging or approved preview deploy to `erp.dincouture.pk`).
2. **Production DB gate is clear:** all unified ledger flags OFF; MR JALIL unified RPC golden **PASS** read-only.
3. After ops live session fills waivers §2–14, re-sign as **2.9A PASS** and open Stage 1 ticket for `unified_ledger_pilot` only.

---

## Explicit confirmations

| Item | Status |
|------|--------|
| Stage 1 SQL executed | **NO** |
| Stage 2 SQL executed | **NO** |
| `feature_flags` writes | **NONE** |
| Deploy / merge to main | **NONE** |
| Default loader switch | **NONE** |
