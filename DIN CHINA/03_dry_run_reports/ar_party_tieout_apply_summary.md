# AR Party GL Tie-out — Apply Summary (2026-06-16)

## Database
- **Host:** `supabase.dincouture.pk` (production)
- Apply run from local machine via `migration-tools/.env.migration`

## Phase 4 — AR payment party reclass
- **First apply:** 50 journal lines moved (1100 → party `AR-*`)
- **Second apply (idempotent):** 17 additional lines (per post-backfill positive-gap customers)
- **Report:** `din_china_financial_integrity_apply_report.json`

### Spotlight after Phase 4

| Customer | Party GL before | After | Matches statement |
|----------|----------------:|------:|:-----------------:|
| AZIZ JAMURAD | 755,500 | **0** | Yes |
| SHAHURKH KHAN | 100,000 | **0** | Yes |
| LAL MOHAMMAD | 2,061,424 | **64,424** | Yes |
| HASSAN MARDAN | 6,009,458 | 6,009,458 | Partial — see below |

Verification: `ar_party_tieout_verification.json` (AZIZ, SHAHURKH, LAL **VERIFY PASS**)

## Phase 4.5 — sales paid_amount / due_amount backfill
- **Applied:** 9 sales with linked payments (34 proposed; 25 DIN COUTURE zero-payment rows **reverted**)
- **Script:** `migration-tools/dinChinaSalesPaidDueBackfill.js`
- **Report:** `din_china_sales_paid_due_backfill_report.json`

## HASSAN MARDAN — remaining gap
- Party GL ~6,009,458 vs document closing ~5,059,563 (~949k) — needs separate JE / return review (not Phase 4 positive-gap)

## Supabase SQL Editor
Use **`scripts/sql/diag_din_china_ar_party_operational_gap_supabase_editor.sql`** (no `\set`).

## VPS note
`migration-tools/.env.migration` is not on VPS; apply was executed from Windows against production Supabase API.

## UI refresh
Hard refresh ERP (Ctrl+F5) after apply — TB expanded AR party rows should show updated balances.
