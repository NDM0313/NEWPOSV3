# SHOP CASH CSV verify — DIN COLLECTION

**Verified:** 2026-11-05 (production Postgres on VPS)

## Company

| Field | Value |
|--------|--------|
| `company_id` | `e08a04af-22a8-4869-9b4d-da31fce13158` |
| Name | **DIN COLLECTION** |
| CSV journals | **130** (115 + 15 FIRDOUS) |
| Other companies with CSV marker | **0** |

## Account 180002

| Check | Result |
|--------|--------|
| CSV JEs with a `180002` SHOP CASH line | **115 / 115** |
| CSV JEs missing `180002` | **0** |
| Branch | **Main Branch** (`7977966a-a7a3-426d-9122-08f8abda6743`) |
| Entry dates | **2025-11-13 → 2026-10-26** |

Counterparty legs (`210053`, `110076`, `180005`, …) are expected from the cash-book CSV; every JE still has a **180002** leg.

## How to see them in the UI

1. Switch company to **DIN COLLECTION** (not another DIN company).
2. Set header date range to cover **13 Nov 2025 – 26 Oct 2026** (e.g. From start or custom FY).
3. Branch: **Main Branch** or **All branches**.
4. Open **Accounting → Journal Entries**, or **Account ledger / statement for `180002` SHOP CASH**.
5. Search description for: `csv:shop-cash-csv` or `Cash book #`.

Sample marker: `[csv:shop-cash-csv:1|2025-11-22|180005|IN|20000.00]`

Sample posted rows (search these in Journal Entries):

| entry_no | date | preview |
|----------|------|---------|
| JE-6741 | 2025-11-22 | Cash book #1 — DIN TR (IN) |
| JE-6744 | 2025-11-13 | Cash book #4 — SHERAZ KHTK (OUT) |
| JE-6745 | 2025-11-13 | Cash book #5 — MARYIM SILK (OUT) |

## Remaining

**15** CSV rows for counterparty **`AR-CU0008` (FIRDOUS FABRICS)** — CoA created under AR `1100` as `Receivable — FIRDOUS FABRICS`, then posted into `180002` (same company).
