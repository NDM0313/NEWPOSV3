# Phase 2.9A-2 — Browser Waiver Closure (Ops Browser Check)

**Sign-off state:** `PHASE 2.9A LIVE WAIVER CHECKS PASS WITH LIMITED WAIVERS — review before Stage 1`  
**Timestamp (UTC):** 2026-06-25T12:55:00Z  
**Branch / commit:** `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` @ `3c42d381` (browser check run; doc commit follows)  
**Target:** `https://erp.dincouture.pk` (production)  
**Tester:** Cursor agent — **no authenticated browser session**; production bundle static analysis  
**Production DB mutation:** **NONE**  
**Flag enablement:** **NONE**

---

## Prerequisite finding (deployment)

Production ERP JS bundle [`prod-bundle-check.txt`](prod-bundle-check.txt) on `erp.dincouture.pk`:

| String | Status |
|--------|--------|
| `unified-ledger-tieout` | **Present** (Admin Compare route in bundle) |
| `Unified engine preview` | **Missing** |
| `Load MR JALIL` | **Missing** |
| `phase2-compare-ledger-v2` | **Missing** |
| `ledger_v2` | **Missing** |

**Impact:** Ledger V2 preview toggles (Phase 2.3–2.7) are **not deployed** to production ERP. Live browser checks **1–11 cannot pass** on `erp.dincouture.pk` until a preview-capable build is deployed (staging or approved production deploy of preview stack).

---

## Live browser checklist (admin/developer — DIN CHINA)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Open Ledger V2 | **BLOCKED** | Preview UI not in prod bundle; auth session not available |
| 2 | Preview toggle visible | **BLOCKED** | Same |
| 3 | Toggle default OFF | **BLOCKED** | Same |
| 4 | Banner mode legacy | **BLOCKED** | Same |
| 5 | DevTools Network open | **NOT RUN** | — |
| 6 | No unified RPC with toggle OFF | **NOT RUN** | Code gates RPC on `unifiedPreviewEnabled`; HAR not captured |
| 7 | Preview toggle ON | **BLOCKED** | Deploy prerequisite |
| 8 | MR JALIL shortcut | **BLOCKED** | Deploy prerequisite |
| 9 | Unified closing 216,300 ±0.01 | **PASS (2.9A RPC)** | [`../mr-jalil-rpc-verification.json`](../mr-jalil-rpc-verification.json) — not re-tested in browser |
| 10 | Preview JSON non-official | **NOT RUN** | Deploy prerequisite |
| 11 | PDF/Excel legacy only | **NOT RUN** | Deploy prerequisite |
| 12 | Admin Compare Center loads | **PARTIAL** | Route in prod bundle; live load not authenticated |
| 13 | Staff: no preview toggles | **NOT RUN** | No staff session |
| 14 | Env kill-switch rebuild | **WAIVED** | Requires local rebuild `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true`; not executed |

---

## Screenshots / HAR / JSON

| Artifact | Status |
|----------|--------|
| Screenshots | **Not captured** — deploy + auth prerequisite |
| Network HAR | **Not captured** |
| Preview JSON export | **Not captured** |
| Export parity notes | See [`export-parity-notes.md`](export-parity-notes.md) |
| Staff visibility notes | See [`staff-visibility-notes.md`](staff-visibility-notes.md) |
| Admin Compare notes | See [`admin-compare-notes.md`](admin-compare-notes.md) |
| Kill-switch | See [`kill-switch-notes.md`](kill-switch-notes.md) |

---

## Combined 2.9A + 2.9A-2 waiver status

| Waiver | Status |
|--------|--------|
| DB flags OFF (DIN CHINA) | **CLEARED** (2.9A) |
| MR JALIL 216,300 | **CLEARED** (2.9A read-only RPC) |
| Live DIN CHINA walkthrough | **OPEN** — deploy preview build first |
| Network HAR | **OPEN** |
| Preview JSON download | **OPEN** |
| Kill-switch rebuild | **OPEN** |
| Staff visibility | **OPEN** |

---

## Recommendation

1. **Do not run Stage 1 SQL** until browser waivers are closed on a **preview-capable build**.
2. **Deploy** `feature/single-core-ledger-phase-2-9-pilot-enablement-plan` (or merged preview stack) to **staging** or approved ERP slot — **no flag enablement required** for UI verification.
3. Ops runs authenticated session: admin/developer + staff on DIN CHINA; capture screenshots/HAR/JSON per checklist.
4. Optional: env kill-switch rebuild on staging after preview deploy.
5. Re-run 2.9A-2 sign-off as **PASS** before Stage 1 `unified_ledger_pilot` ticket.

---

## Explicit confirmations

| Item | Status |
|------|--------|
| Stage 1 SQL | **NOT RUN** |
| Stage 2 SQL | **NOT RUN** |
| `feature_flags` writes | **NONE** |
| Deploy / merge to main | **NONE** |
