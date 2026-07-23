# Phase 2.9A-3 — Post-Deploy Browser QA Evidence

**Plan:** [`docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9A3_PREVIEW_DEPLOY_PLAN.md`](../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9A3_PREVIEW_DEPLOY_PLAN.md)  
**Access:** `ssh -N -L 3002:127.0.0.1:3002 dincouture-vps` → http://localhost:3002  
**Container:** `erp-frontend-preview` (port 3002) — production `erp.dincouture.pk` unchanged  

Populate after ops deploy + browser session. **No feature_flags writes.**

## Artifacts

| File | When |
|------|------|
| `bundle-verify.txt` | Immediately after container up |
| `browser-waiver-closure.md` | After admin + staff browser checks |
| `post-deploy-flags.json` | Read-only SQL after session |
| `screenshots/` | Toggle OFF/ON, MR JALIL, staff view |
| `network-notes.md` | DevTools filter `get_unified` |
| `phase2-compare-ledger-v2-*.json` | Preview panel export |
| `export-parity-notes.md` | PDF/Excel spot-check |
| `staff-visibility-notes.md` | Staff login negative test |
| `rollback-log.md` | If rollback drill run |

## Templates

`*_TEMPLATE*` files — copy and fill during QA.
