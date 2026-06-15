# DIN CHINA Balance Sheet Issue Analysis

**Generated:** 2026-06-15T18:32:47.924Z

## Account snapshots

```json
{
  "ar1100": {
    "id": "51ef008a-00ca-48cd-94f8-4fdad79b7065",
    "code": "1100",
    "name": "Accounts Receivable",
    "balance": -21416540
  },
  "inventory1200": {
    "id": "250bbcfc-3f85-4614-879c-5be749399810",
    "code": "1200",
    "name": "Inventory",
    "balance": 28678939.27
  },
  "ap2100": {
    "id": "7cbf1212-1a47-4de2-aad5-3690c587372a",
    "code": "2000",
    "name": "Accounts Payable",
    "balance": 0
  },
  "revenue4100": {
    "id": "ce23889c-07c0-4f09-9946-1e55764719e1",
    "code": "4100",
    "name": "Sales Revenue",
    "balance": -49040015
  },
  "cogs5010": {
    "id": "e0821405-9244-4f43-9fd2-694f0e905b1b",
    "code": "5010",
    "name": "COGS - Inventory",
    "balance": 39299479.13
  },
  "discount5200": {
    "id": "327829be-35fc-4700-bd60-7767e74a699c",
    "code": "5200",
    "name": "Discount Allowed",
    "balance": 148818
  }
}
```

## Inventory vs COGS

- Expected COGS from cost_price × qty: Rs 0
- Actual COGS posted (5010): Rs 40106406.25
- Inventory credit on sale JEs: Rs 40106406.25
- COGS/inventory relief appears aligned with expected costs.

## AR vs customer dues

- Sum of sale due_amount: Rs 17792088
- GL AR (1100) balance: Rs -21416540
- Gap: Rs 39208628
- Phase 6 sell returns (~Rs 1.06M) may explain part of any residual AR gap.

## Purchase / AP

- ERP purchase total: Rs 0
- Updated CSV target: Rs 67514347.4
- Mismatch: Rs -67514347.4 (Phase 3 requires approval)

## Revenue tie-out

- Operational sales total: Rs 49951100
- GL 4100 on sale document JEs: Rs 50099918
- Missing revenue JEs: 0
