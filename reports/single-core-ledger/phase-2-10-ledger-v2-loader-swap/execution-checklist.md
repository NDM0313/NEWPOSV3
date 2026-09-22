# Phase 2.10 — Ledger V2 loader swap execution checklist

**Use when:** Implementation approved + loader flag SQL authorized — **not for planning sign-off alone**  
**Blocked until:** All hard gates below are PASS  

---

## Pre-execution hard gates

| # | Gate | Evidence | Status |
|---|------|----------|--------|
| G1 | Phase 2.9C Stage 2 soak PASS (or waiver) | `stage-2-accelerated-soak-waiver.md` | PASS @ 2026-06-25 |
| G2 | This plan approved (Status A) | `SINGLE_CORE_LEDGER_PHASE_2_10_LEDGER_V2_LOADER_SWAP_PLAN.md` | Pending ops |
| G3 | Implementation merged to **preview** branch (not main until approved) | Preview build on `:3003` | Not started |
| G4 | `unified_ledger_loader_ledger_v2` flag key in code + resolver | Code review | Not started |
| G5 | MR JALIL unified **main table** = 216,300 (loader ON in preview env) | Browser QA script | Not run |
| G6 | Pilot Batch 9/9 PASS (loader ON) | Admin Compare | Not run |
| G7 | PDF + Excel + CSV export spot-check **completed** (not waived) | Signed checklist row | **Required** |
| G8 | Staff/manager: no preview toggle OR explicit signed waiver | HR/ops sign-off | Waived in 2.9C — **re-review for loader** |
| G9 | Rollback L1 SQL dry-run documented | `rollback-plan.md` + ops log | Document only |
| G10 | Cross-company SQL: only DIN CHINA flags | `phase-29c-cross-company-flags.sql` | Template ready |
| G11 | Forbidden screen flags OFF/absent | Post-enable SQL | Template ready |
| G12 | No migrations / no GL mutations in same change set | PR review | — |
| G13 | Kill switch tested → legacy fallback | Unit/integration test | Not run |

---

## SQL sequence (execution day — DIN CHINA only)

| Step | Script (to create at implementation) | Expected |
|------|----------------------------------------|----------|
| 1 | `phase-210-preflight-flags.sql` | Stage 2 state: 3 flags ON, loader absent/OFF |
| 2 | `phase-210-cross-company-flags.sql` | DIN CHINA only |
| 3 | `phase-210-enable-loader-ledger-v2.sql` | `INSERT 0 1` loader ON |
| 4 | `phase-210-post-loader-flags.sql` | 4 keys ON (pilot, engine, screen, loader) |
| 5 | Cross-company re-read | Still DIN CHINA only |

**Do not** enable any other `unified_ledger_screen_*` or Cash/Bank flags.

---

## Browser QA sequence (preview tunnel)

```powershell
ssh -N -L 3002:127.0.0.1:3003 dincouture-vps
$env:QA_BROWSER_PASSWORD = '<admin password>'
node scripts/single-core-ledger/run-phase-210-loader-browser-qa.mjs
```

Expected checks (future script):

- [ ] Admin login DIN CHINA
- [ ] Wide date range (2000-01-01 → today)
- [ ] Loader flag ON → main table unified RPC (toggle OFF)
- [ ] MR JALIL closing 216,300 main table
- [ ] Preview toggle still manual; optional legacy shadow compare
- [ ] Export legacy authority / basis labels correct
- [ ] Admin Compare engine ON, Party PASS, Batch 9/9
- [ ] Staff: no preview toggle (or waiver on file)
- [ ] Screenshots → `post-loader-swap/screenshots/`

---

## Post-enable monitoring

| Window | Action |
|--------|--------|
| T+0 | Flag readback + browser QA |
| T+24h | Optional soak (or accelerated waiver per ops) |
| T+incident | L1 rollback if any export/complaint/RPC spike |

---

## Rollback triggers (immediate L1)

- Main table closing ≠ golden fixture beyond tolerance
- Export totals ≠ on-screen totals
- Unexpected unified RPC errors in console/network
- User-reported statement mismatch
- Wrong company/flag detected in SQL

---

## Sign-off block

| Role | Name | Date | Approve loader execution? |
|------|------|------|---------------------------|
| Ops | | | |
| Engineering | | | |
| Finance (export spot-check) | | | |

**Stage 3 loader swap execution:** ☐ Approved ☐ Denied ☐ Deferred
