# Phase 2.12 — final execution report

**Status:** `PHASE 2.12 TRIAL BALANCE LOADER PASS WITH WAIVERS — monitor before expansion`

## Commits

| Phase | Hash | Message |
|-------|------|---------|
| 2.11 | `eaf83097` | feat(accounting): enable DIN CHINA account statement unified loader |
| 2.12 | `845865dc` | feat(accounting): enable DIN CHINA trial balance unified loader |
| 2.12 fix | `a74e7d1b` | fix(accounting): expose trial balance loader QA attrs during load |

## Deployment

- **Target:** `https://erp.dincouture.pk`
- **Build:** `phase-212-prod`
- **Migrations:** none
- **GL mutation:** none

## Flags (DIN CHINA live)

| Flag | State |
|------|-------|
| `unified_ledger_loader_trial_balance` | **ON** |
| `unified_ledger_screen_trial_balance` | **ON** |
| `unified_ledger_loader_ledger_v2` | ON (unchanged) |
| `unified_ledger_loader_account_statement` | ON (unchanged) |
| Roznamcha / Party / Cash-Bank | OFF |

## Trial Balance golden (All Branches, official_gl, wide period)

| Metric | Value |
|--------|-------|
| Total Debit | PKR 407,957,271.02 |
| Total Credit | PKR 407,957,271.02 |
| Difference | 0 |
| Main loader (live) | `unified` |
| Preview compare (live) | `legacy_shadow` |

## QA summary

| Gate | Result |
|------|--------|
| Unit tests (`test:unified-ledger`) | 188/188 PASS |
| Production baseline (loader OFF) | PASS |
| Production candidate (loader ON) | PASS |
| L1 rollback (loader OFF) | PASS |
| Soak T0 / mid / final (accelerated) | PASS |
| Ledger V2 MR JALIL | PKR 216,300 PASS |
| Account Statement MR JALIL | PKR 216,300 PASS |
| Admin Compare Pilot Batch | 9/9 PASS |

## Waivers

1. Preview tunnel QA — chunk routing to production origin (see `preview-deploy-notes.md`)
2. Accelerated soak (T0 + 30s + mid + 30s + final)
3. Export PDF/Excel/CSV — not automated; on-screen totals signed via QA debit/credit match
4. Staff-role visibility — not re-tested (admin QA only)

## Rollback

- L1 tested PASS @ 2026-06-26
- Loader re-enabled after rollback proof
- No rollback required for production incident

## Blocked future items

- Roznamcha, Party Ledger, Cash/Bank loader rollout
- Trial Balance expansion beyond DIN CHINA
- Other company flags
