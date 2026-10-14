# DIN CHINA Screenshot Discount Backfill — Apply Report

**Applied:** 2026-06-15T16:05:20.916Z  
**Company:** `30bd8592-3384-4f34-899a-f3907e336485`  
**Branch:** DIN CHINA (BL0002)  
**Map:** [`DIN CHINA/07_maps_json/din_china_screenshot_discount_backfill_map.json`](../07_maps_json/din_china_screenshot_discount_backfill_map.json)  
**Apply JSON:** [`din_china_screenshot_discount_backfill_apply_report.json`](din_china_screenshot_discount_backfill_apply_report.json)

## Command

```powershell
node migration-tools/dinChinaFinancialIntegrityAudit.js `
  --company-id 30bd8592-3384-4f34-899a-f3907e336485 `
  --apply --require-supabase `
  --apply-phase 7.5 `
  --approve-screenshot-discount-backfill
```

## Rationale

Legacy ZHD SQL/CSV import stored **Rs 60** total in `sales.discount_amount` (HAJI SHARIF / DC-0014 only). The old SHOP A8 Customers & Suppliers screenshot showed additional per-customer discounts that were **not** in the canonical export. This backfill uses the **approved screenshot mapping** (not invented amounts).

| Customer | Screenshot discount | CSV `discount_amount` | Action |
|---|---:|---:|---|
| AZIZ JAMURAD | 13,540 | 0 | Backfilled on DC-0041 |
| SHAHURKH KHAN | 35,218 | 0 | Backfilled on DC-0004 |
| LAL MOHAMMAD | 100,000 | 0 | Backfilled on DC-0002 (partial) |
| HAJI SHARIF | 60 | 60 | Already applied (Phase 7) — skipped |

## Per-invoice before / after

### DC-0041 — AZIZ JAMURAD (Rs 13,540)

| Field | Before | After |
|---|---:|---:|
| total | 337,134 | 323,594 |
| discount_amount | 0 | 13,540 |
| due_amount | 13,540 | 0 |
| payment_status | partial | paid |

**JE:** Dr AR 337,134 → 323,594 · Cr 4100 stays 337,134 (gross) · Dr 5200 +13,540

### DC-0004 — SHAHURKH KHAN (Rs 35,218)

| Field | Before | After |
|---|---:|---:|
| total | 135,218 | 100,000 |
| discount_amount | 0 | 35,218 |
| due_amount | 35,218 | 0 |
| payment_status | partial | paid |

**JE:** Dr AR 135,218 → 100,000 · Cr 4100 stays 135,218 (gross) · Dr 5200 +35,218

### DC-0002 — LAL MOHAMMAD (Rs 100,000 partial)

| Field | Before | After |
|---|---:|---:|
| total | 1,193,124 | 1,093,124 |
| discount_amount | 0 | 100,000 |
| due_amount | 164,424 | 64,424 |
| payment_status | partial | partial |

**JE:** Dr AR 1,193,124 → 1,093,124 · Cr 4100 stays 1,193,124 (gross) · Dr 5200 +100,000

## Post-apply verification

| Check | Expected | Actual |
|---|---:|---:|
| CS report `total_discount` | 148,818 | **148,818** |
| GL 5200 debit (audit) | 148,818 | **148,818** |
| Phase 7.5 eligible | 0 | **0** |
| Phase 7 eligible | 0 | **0** |
| Apply rows updated | 3 | **3** |
| Apply errors | 0 | **0** |

Per-customer CS report discount column:

- AZIZ JAMURAD: **13,540**
- SHAHURKH KHAN: **35,218**
- LAL MOHAMMAD: **100,000**
- HAJI SHARIF: **60**

## Screenshot total gap

| Source | Total discount |
|---|---:|
| Old ERP screenshot footer | 168,578 |
| NEW ERP after backfill | **148,818** |
| Unexplained remainder | **19,760** |

The remaining **Rs 19,760** is not present in legacy SQL/CSV or the approved 3-row map. Matching the full screenshot total requires a separate old-report export with per-invoice discount lines.

## Safety

- **No** sales, returns, payments, or stock rows deleted
- **3** `sales` rows updated (`discount_amount`, `total`, `due_amount`, `payment_status`)
- **3** existing sale document JEs amended (Dr AR net, Cr 4100 gross, Dr 5200)
- **Idempotent:** re-run shows Phase 7.5 eligible = 0
- Phase 3 purchase repair and Phase 4 AR gap unchanged

## Module

[`migration-tools/lib/dinChinaScreenshotDiscountBackfill.js`](../../migration-tools/lib/dinChinaScreenshotDiscountBackfill.js) — Phase **7.5** in [`dinChinaFinancialIntegrityAudit.js`](../../migration-tools/dinChinaFinancialIntegrityAudit.js)
