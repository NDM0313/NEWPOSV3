# First genuine post-T0 transaction verification

**Checked at (UTC):** 2026-09-21 22:03:31+00  
**PRODUCTION_T0:** 2026-09-22 02:54:21 Asia/Karachi (`2026-09-21 21:54:21+00`)  
**Product SHA:** `356819d0759948f1583c3b9f22e9dded4d9f2529`  
**Mode:** READ / VERIFY ONLY — no synthetic transactions

## Overall status

`AWAITING_FIRST_REAL_ROLE_POSTS`

## Per-party

| Party | First real txn found | Reference | Account used | Expected | Status |
|-------|----------------------|-----------|--------------|----------|--------|
| DHL local `SUP-ZHD-0007` | **NO** | — | — | `203163` | `DHL_FIRST_REAL_ROLE_POST_PENDING` |
| KIRAN `SUP-ZHD-0036` | **NO** | — | — | WA/WP by intent | `KIRAN_FIRST_REAL_ROLE_POST_PENDING` |
| SHAHMIM `SUP-ZHD-0046` | **NO** | — | — | WA/WP by intent | `SHAHMIM_FIRST_REAL_ROLE_POST_PENDING` |

### Search coverage (post-T0)

- `journal_entry_lines` on role accounts `203163`, `WA-SUPZHD0036`, `WP-SUPZHD0036`, `WA-SUPZHD0046`, `WP-SUPZHD0046` → **0**
- `payments` with contact/reference_id = target UUIDs → **0**
- AP-% lines for targets with `je.created_at >= T0` → **0**
- DHL PK `2030162` posts after T0 → **0**
- `courier_shipments` for DHL local after T0 → **0**
- `worker_ledger_entries` for KIRAN/SHAHMIM after T0 → **0**
- All-time JE lines on role leaves → **0** (accounts exist; unused)

## Integrity snapshot

| Check | Result |
|-------|--------|
| Historical AP fingerprint | `e2d8dbaf79042b661d354a95d1980d3e` |
| Historical freeze | `POST_T0_HISTORICAL_AP_FREEZE_PASS` |
| GL imbalance | `0.00` |
| New 210xxx for target parties (post-T0) | **0** |
| Duplicate role leaves (max) | **1** |
| Contact types | DHL=courier; KIRAN=worker; SHAHMIM=worker |
| erp-frontend | healthy; `/` 200; `/health` 200 |
| Graphify | `stash@{7}: On main: graphify root` untouched |
| Incidents | none |

## Closure

Not closed — awaiting first genuine business postings for all three parties.

Do not invent transactions. Re-run this verification after real operator activity.
