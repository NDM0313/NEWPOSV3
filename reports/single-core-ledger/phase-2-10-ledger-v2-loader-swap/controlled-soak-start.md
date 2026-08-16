# Phase 2.10D — Controlled loader soak (start checkpoint)

**Timestamp:** 2026-06-26T13:07:17Z  
**Checkpoint:** T0 start  
**Soak option:** A — 2-hour controlled soak  
**Loader flag:** **ON** (DIN CHINA only)  
**Overall:** **PASS**

## T0 verification

| Check | Result |
|-------|--------|
| `data-ledger-v2-main-loader="unified"` | PASS |
| MR JALIL closing PKR 216,300 | PASS |
| Unified main-loader RPC on load | PASS (1 call) |
| Preview `legacy_shadow` compare | PASS |
| Export PDF/Excel/CSV PKR 216,300 | PASS |
| Admin Party MR JALIL | PASS |
| Pilot Batch 9/9 | PASS |
| Production frontend | untouched |

## Artifacts

- `screenshots/210d-soak-start-ledger.png`
- `screenshots/210d-soak-start-export-pdf-preview.png`
- `screenshots/210d-soak-start-admin-compare.png`

## Waivers

- Staff preview toggle visibility — no staff credentials (see soak staff waiver in plan)
