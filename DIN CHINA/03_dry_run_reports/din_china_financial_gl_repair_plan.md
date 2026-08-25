# DIN CHINA Financial GL Repair Plan — Dry Run Only

**Generated:** 2026-06-16T09:14:47.464Z

**Apply was NOT run.** This document is a preview only.

## Blocking errors

- 12 products missing cost source — Phase 2 COGS repair blocked
- Purchase total mismatch -67514347.4 requires user approval before Phase 3

## Phases

### Phase 1 — Missing sale revenue JE repair

Post Dr AR / Cr Sales Revenue 4100 for imported final sales with no canonical document JE.

- Eligible: 0
- Blocked for apply: NO
- Gates:
  - Sales Revenue 4100 must resolve
  - No duplicate active document JE for same sale
  - DIN CHINA branch scope only
  - Does not change sale totals/items/payments

### Phase 2 — Missing COGS / Inventory relief repair

Append Dr COGS 5010 / Cr Inventory 1200 on sale document JEs when cost source is reliable.

- Eligible: 0
- Expected COGS total: 0
- Blocked for apply: YES
- Gates:
  - 5010 and 1200 accounts must exist
  - Product cost from weighted avg or cost_price — never sale price
  - Stock movement qty must match sale item qty
  - Missing cost products block apply

### Phase 3 — Purchase total / inventory mismatch repair

Adjust stale ERP purchase total (67,978,418.40) vs updated CSV (67,514,347.40).

- Mismatch: -67514347.4
- Blocked for apply: YES
- Gates:
  - Explicit user approval required
  - Never auto-update purchase header without approved migration
  - Flag --approve-purchase-repair on apply (future)
- Note: Manual approval required — adjust purchase header total via approved migration only

### Phase 4 — AR payment party reclass (1100 → AR-*)

Relink sale receipt AR credits from control 1100 to customer party sub-ledger when the sale document JE debited AR-*.

- Eligible: 17
- Payment issues: 17
- Blocked for apply: YES
- Gates:
  - Dry-run review required
  - Pass --apply --apply-phase 4 --approve-ar-party-reclass
  - Only moves AR credit lines on payment JEs (no sale total / payment amount changes)
- Note: UPDATE journal_entry_lines.account_id from control 1100 to party AR-* when the linked sale document JE debited the party sub-ledger. Matches RAEES LHR repair (2026-06-16).

### Phase 5 — Owner Equity Opening Clearing review

Analysis only — FS2 routing / opening equity clearing; no apply unless separately approved.

- Blocked for apply: YES
- Gates:
  - User must explicitly approve separate owner-equity repair

### Phase 6 — Legacy sell return import + GL

Import 4 excluded sell_return documents (CN2025/0001–0002, CN2026/0003–0004) with settlement Dr 4100 / Cr AR and inventory reversal.

- Eligible: 0
- Blocked for apply: YES
- Gates:
  - Dry-run review required
  - Pass --apply --apply-phase 6 after approval
  - DIN CHINA branch only
  - Idempotent fingerprints on return JEs
- Note: Not applied automatically — reduces AR gap by ~Rs 1,059,903 when posted.

### Phase 7.5 — Screenshot discount backfill (sales + GL)

Backfill old-ERP Customers & Suppliers screenshot discounts on DC-0041, DC-0004, DC-0002 — UPDATE sales.discount_amount/total/due and amend document JE (Dr AR net, Cr 4100 gross, Dr 5200).

- Eligible: 0
- Blocked for apply: YES
- Gates:
  - Dry-run review required
  - Pass --apply --apply-phase 7.5 --approve-screenshot-discount-backfill
  - Approved map: DIN CHINA/07_maps_json/din_china_screenshot_discount_backfill_map.json
- Note: Screenshot backfill: UPDATE sales.discount_amount/total/due, then amend document JE — reduce Dr AR, increase Cr 4100, add Dr 5200.

### Phase 7 — Discount GL alignment (Dr 5200 / gross 4100)

Amend sale document JEs for legacy sales with discount_amount > 0 — increase Cr 4100, add Dr Discount Allowed 5200.

- Eligible: 0
- Blocked for apply: YES
- Gates:
  - Dry-run review required
  - Pass --apply --apply-phase 7 after approval
  - 5200 and 4100 accounts must exist
  - Does not change sale.total rows
- Note: Phase 7 amends document JE: Cr 4100 gross, Dr AR net, Dr 5200 discount. Phase 7.5 handles screenshot-only discounts.

## Proposed repairs sample

```json
[
  {
    "phase": 3,
    "note": "Manual approval required — adjust purchase header total via approved migration only",
    "erpTotal": 0,
    "targetTotal": 67514347.4,
    "delta": -67514347.4
  }
]
```