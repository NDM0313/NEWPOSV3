# DIN CHINA — Purchase / Courier / Ledger Trail Audit

**Date:** 2026-07-07  
**Company:** DIN CHINA (`30bd8592-3384-4f34-899a-f3907e336485`)  
**Purchase:** PO2025/0003 (`a065035c-dca2-4079-837a-9c2aeca9332d`)

## User question: Is Rs 67,978,418.40 purchase + courier?

**Answer: No — it is the single Inventory (1200) debit on the purchase JE (full landed cost).**

| Finding | Result |
|---------|--------|
| Line with exactly 67,978,418.40 | **Inventory 1200**, JE-0001, `Inventory purchase PO2025/0003` |
| Supplier AP on same JE | Cr **43,404,978.40** (goods only) — PASS |
| YAQOOB 2031 on same JE | Cr **24,573,440.00** (clearance) — PASS |
| `due_amount` | **2,061,978.40** — PASS |
| JE-0311 duplicate accrual | **Voided** — PASS |
| Trial balance | **Balanced** (388,520,272.02) — PASS |
| Stock movements for PO | 17 rows, cost sum **67,978,418.40** — ties to inventory Dr |

## Gaps found

| Issue | Severity | Action |
|-------|----------|--------|
| 10 active `opening_balance_inventory` JEs (~38.76M Dr) reference **deleted** stock movements | High | Void via `repair_din_china_orphan_opening_jes.sql` |
| Cached 1200 inflated by orphan opening JEs (~67.44M vs ~28.68M true net) | Medium | Refresh after void |
| Supplier AP cached sign uses `debit-credit` (-2.06M) — matches journal; UI uses liability polarity | OK | No change |
| YAQOOB 2031 journal net | **0.00** | OK — cached 0 correct |

## Post-repair (applied 2026-07-07)

| Action | Result |
|--------|--------|
| Voided 10 orphan `opening_balance_inventory` JEs | ~38.76M Dr removed from GL |
| Refreshed 1200 / AP / 2031 cached balances | Done |
| `recalc_purchase_payment_totals` | due **2,061,978.40** |

| Account | Balance (debit − credit) |
|---------|--------------------------|
| Inventory 1200 | **28,678,939.27** |
| Supplier AP | **−2,061,978.40** (liability ~2.06M) |
| YAQOOB 2031 | **0.00** |

## Acceptance gates (all PASS)

- purchase_header, inventory_1200_purchase_dr, supplier_ap_net, yaqoob_2031_net, trial_balance, orphan_opening_inv_jes

## Scripts

- Diagnose: `scripts/sql/diag_din_china_purchase_ledger_trail.sql`
- Repair: `scripts/sql/repair_din_china_orphan_opening_jes.sql`
- Verify: `scripts/sql/verify_din_china_purchase_ledger_trail.sql`

## Deploy

Commit `becc2767` pushed and deployed to VPS (`git pull && bash deploy/deploy.sh`).
