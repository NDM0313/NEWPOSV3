# DIN CHINA Inventory / COGS Tie-Out — Dry Run

**Generated:** 2026-06-15T18:32:51.597Z

## Import strategy note

Legacy import posted Dr AR / Cr 4100 only. Phase 2 adds Dr 5010 / Cr 1200 when product cost_price is set.

## Summary

| Metric | Value |
| --- | --- |
| Purchase inventory GL debit (1200) | 68785345.52 |
| Stock movement IN qty | 218406.85 |
| Stock movement IN value | 67978418.4 |
| Sale stock OUT qty | 0 |
| Sale item qty total | 130655.35 |
| Expected COGS | 0 |
| Actual COGS posted (5010) | 40106406.25 |
| Actual inventory credit from sales (1200) | 40106406.25 |
| COGS gap | -40106406.25 |
| Inventory overstatement estimate | 40106406.25 |
| Missing stock OUT lines | 0 |
| Stock qty mismatches | 0 |
| Balance sheet inventory overstated? | NO |

## COGS account

{
  "id": "e0821405-9244-4f43-9fd2-694f0e905b1b",
  "code": "5010",
  "name": "COGS - Inventory",
  "type": "expense",
  "balance": 39299479.13,
  "is_group": false,
  "parent_id": "4ec1e8ac-c86c-4d87-b7fe-5dcd966f2e64"
}

## Missing cost products

| Product ID | SKU | Name |
| --- | --- | --- |
| b881fbdd-b5c4-4fab-8e4b-5330263b2e42 | 0017-1 | TAIBO |
| a52110d7-9adf-483c-8765-d85852862b51 | 0013-4 | WOOL |
| 71c8a39d-b31f-458b-801f-34c964fb9cb1 | 0014 | VELVET SETECHABLE |
| 45e72f65-67aa-48b9-8e3b-2533f543e86b | 0003-3 | TR |
| abc23aaf-afab-425f-8549-0106f9647b20 | 0018 | COTTON WHITE |
| c7dec26c-e1c2-4554-842e-72a10a224ae8 | 0005 | SHAMIZ RIYAN |
| fc9d1281-7aa9-4927-85ec-671024454f03 | 0011 | RAD RIYAN |
| 679e7e52-a8db-4773-8206-99cb680310cb | 0012 | TC |
| 659126ee-dfaa-4e72-857e-9979c58c2cbc | 0009 | SILK COLOR POLYSTER |
| 97a2e574-53c1-4f41-8c23-0cdf48ceb746 | 0004 | KATAN RIYAN |
| 57e6d4ff-503f-47b8-8bae-43158eabed15 | 0008 | DUBAL SHADE POLYSTER |
| 74fa8f4e-67dd-4898-8db0-ec26ceb4ef19 | 0010 | RIYAN SILK PRINT |

## Example sale item rows

```json
[]
```

## Proposed COGS repairs (Phase 2 preview)

```json
[]
```