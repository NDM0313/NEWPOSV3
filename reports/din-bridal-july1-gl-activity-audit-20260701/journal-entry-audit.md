# Journal entry audit — DIN BRIDAL after clean snapshot

**Clean snapshot:** 2026-07-01T11:32:17Z  
**Method:** Read-only Supabase service-role query (no writes)

## Posted JEs after 11:32 UTC (active, non-void)

| Entry | Created (UTC) | Entry date | Type | Amount (Dr=Cr) | Cash/bank impact |
|-------|---------------|------------|------|----------------|------------------|
| **RCV-0075** | 11:56:02 | 2026-06-14 | payment | 80,000 | +80,000 bank (1061 NDM FSY) |
| **JE-0205** | 12:32:12 | 2026-07-01 | sale | 79,325 | none (AR/revenue/COGS/inventory) |
| **RCV-0076** | 12:42:24 | 2026-06-15 | payment | 42,000 | +42,000 cash (1002 CASH G140) |
| **RCV-0077** | 13:07:42 | 2026-05-16 | payment | 20,000 | +20,000 cash (1002 CASH G140) |

## RCV-0075 detail

- **Description:** Receipt RCV-0075 (Walk-in Customer old) - N331 reaming Balance
- **Lines:** Dr 1061 NDM FSY 80,000 | Cr AR-CUS0001 Walk-in Customer 80,000
- **Payment ID:** `54243a50-be7c-44ae-951b-138c0759ad74`

## JE-0205 detail (Sale SL-0018)

- **Description:** Sale finalized – SL-0018 (MAHVISH IQBAL)
- **Sale ID:** `4a080eeb-4866-4c90-8265-bceec62d6727`
- **Lines:** AR Dr 57,000 | Revenue Cr 51,000 | Extra service Cr 6,000 | COGS Dr 22,325 | Inventory Cr 22,325

## RCV-0076 detail

- **Description:** Receipt SL-0018 (MAHVISH IQBAL)
- **Lines:** Dr CASH G140 42,000 | Cr AR-D1CA11 42,000
- **Payment ID:** `f918811d-abb3-4be7-9e38-fba87b5173f1`

## RCV-0077 detail (post–12:43 artifact)

- **Description:** Receipt SL-0019 (HARIS N219)
- **Lines:** Dr CASH G140 20,000 | Cr AR-CUS0062 20,000
- **Payment ID:** `a9e755e9-a345-410d-a9a3-930c1c9b4da4`

All entries are **balanced** (debit = credit). No voids. Backdated `entry_date` on receipts is normal for operational receipt posting.
