# Readonly stock diagnosis — DIN China SKU 0018 (2026-07-13)

Company: `30bd8592-3384-4f34-899a-f3907e336485` (DIN China)

## SKU 0018 / COTTON WHITE

| Check | Result |
|-------|--------|
| Product | `abc23aaf-afab-425f-8549-0106f9647b20`, `has_variations=false` |
| Company-wide `SUM(quantity)` | **-590.90** (6 movements) |
| Branch split | All 6 rows on branch `DIN CHINA` — **no `branch_id IS NULL` rows** |
| Strict branch vs null-inclusive | Same (**-590.90**) |
| By type | sale **-591.90** (5), sale_return **+1** (1) |
| Purchases / opening | **None** |
| Z1 sync notes | 1 row: `Stock sync SL-0010 Δ=-1 (line vs movements)` |

## Company context

- Company-wide null-branch movements: **0**
- Other active negatives: `0005` SHAMIZ RIYAN **-2498.3**, `0013-4` WOOL **-298**, `0009` SILK COLOR POLYSTER **-151.7**

## Conclusion

- Web UI **-590.90** matches the ledger exactly — **real ledger drift**, not a display formula bug.
- Mobile branch-filter parity still correct for other tenants with null-branch openings; for this DIN China company it does not change 0018.
- Remaining negative stock requires **business/data repair** (missing purchase/opening, or sale qty corrections) — **not applied** in this pass (system lockdown). Ask before any cleanup/adjustment scripts.
