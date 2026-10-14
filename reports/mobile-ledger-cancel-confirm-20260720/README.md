# Mobile full ledger + Cancel Payment confirm — 2026-07-20

## Why mobile showed ~40 rows (Oct 2025 → Jul 2026)

Default date range is **Current FY**, not a hard RPC row limit. Older activity is folded into **opening balance**. Full JE history is available via **All time**.

## Fixes

| Area | Change |
|------|--------|
| Party GL mapper | Map `payment_id` → `paymentId` so effective-net twin matching does not over-hide rows |
| Party ledger UI | Entry count uses presented (effective-net) lines |
| Date range | Pin **All time** chip first on party/account ledgers + “Show full history” link |
| Cancel Payment | `TransactionDetailModal` uses `TransactionConfirmDialog` instead of `window.confirm` (also Reverse / Remove from live GL / orphan / undo) |

## Non-goals

- No GL posting rewrite for Cancel Payment
- No new migration
- Web Include-reversals presentation already fixed in `b8973a2f`

## Validation

- Local web + mobile builds
- Deploy: VPS `deploy/vps-build-erp-only.sh`

## Delivery

| Item | Value |
|------|--------|
| Branch | `main` |
| Commit | `b00c5d3f` |
| Evidence | this folder |
| VPS HEAD | `b00c5d3f` |
| Production | `https://erp.dincouture.pk` → 200 |
| Mobile | `https://erp.dincouture.pk/m/` → 200 |

Hard-refresh browser / `/m/` (Ctrl+Shift+R) after deploy.
