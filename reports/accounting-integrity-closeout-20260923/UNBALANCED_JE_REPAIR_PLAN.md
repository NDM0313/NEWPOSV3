# Unbalanced JE repair plan

## Gate

| Check | Result |
|-------|--------|
| Fresh backup | PASS `20260923-005428` |
| All 8 JE reconstructions | DETERMINISTIC |
| Active bridal ambiguous? | **NO** |
| Suspense / artificial JE? | **NO** |
| DIN COLLECTION touched? | **NO** |

**Proceed:** all rows in `UNBALANCED_JE_MATRIX.csv` = `SAFE_DETERMINISTIC_REPAIR`

## Root-cause summary

### DIN CHINA `55b744a8…` (void)

PUR-0004 cancelled Rs.190; only JE is void `purchase_reversal` with single Dr AP 2000 190. No original purchase JE ever existed. Missing historical Cr Inventory 1200 190 (mirrors China purchase pattern Dr Inv / Cr AP reversed).

### DIN BRIDAL active `f1bda1df…` / `bdebfa9a…`

Sale JEs have Inventory Cr (COGS amount) but COGS 5010 lines exist with **debit=0**. Fix: set COGS debit = Inventory credit (7995 / 5625). Proven by balanced bridal sales (e.g. SL-0060).

### DIN BRIDAL void (5)

Live balanced JEs already exist for the same sales. Void rebuilds diverge:

| Sale | Void defect | Fix |
|------|-------------|-----|
| SL-0013 ×2 | Sales Cr 38000 vs live/subtotal 39000 | UPDATE credit → 39000 |
| SL-0015 | Sales Cr 14600 vs live/subtotal 15300 | UPDATE credit → 15300 |
| SL-0021 | Triple Extra Service ×2500 | DELETE 2 duplicates; keep Income 2500 |
| SL-0041 | Triple Extra Service ×10000 | DELETE 2 duplicates; keep Income 10000 |

## Script

`repair_allowlisted_jes.sql` — allowlisted IDs only; in-transaction verify DO block.

## Rollback

`ROLLBACK.md` + VPS `targeted_export/rollback/pre_mutated_lines.csv`
