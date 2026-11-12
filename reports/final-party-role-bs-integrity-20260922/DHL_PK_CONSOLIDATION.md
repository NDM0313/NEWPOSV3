# DHL PK Courier Consolidation

**Marker:** `DHL_PK_COURIER_CONSOLIDATION_PASS`  
**Run id (prod):** `a370308a-5b4d-4c8b-9c23-02ec286364f4`  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`

## Live verify (pre)

| Item | Value |
|------|-------|
| Contact | `SUP-ZHD-0162` / `4505905b-b3e0-4ec2-8fc7-bd79464b0506` type **supplier** |
| Canonical | `2030162` / `919a3a0a-f87d-4c1b-87d9-068810378b8c` — 14 lines, net **6,550,000.00** |
| Misfiled AP | `AP-SUPZHD0162` / `88c0603a-2f96-4ed8-9956-9ff9b1128288` — **1** line, net **500,000.00** |
| Line | `0565a4d3-3410-4bef-acdd-d3605febf96c` PAY-6723 Debit **500,000.00** |

## Repair

- Immutable backup → `_closeout_repair_backup_20260922`
- Moved exact line AP → `2030162` (amount/date/description unchanged; no plug JE)
- Contact type → **courier**
- Deactivated `AP-SUPZHD0162`
- Verified remap `AP-SUPZHD0162` → `2030162`

## Post

| Item | Value |
|------|-------|
| Contact type | **courier** |
| `2030162` | **15** lines, net **7,050,000.00** (+500,000 debit) |
| `AP-SUPZHD0162` | **0** lines, inactive |
| GL Dr/Cr | **872,788,218.57** / **872,788,218.57** (unchanged) |

## Local DHL separation

| | Local DHL | DHL PK |
|--|-----------|--------|
| Code | `SUP-ZHD-0007` | `SUP-ZHD-0162` |
| UUID | `6ce5bed0-…` | `4505905b-…` |
| Type | courier | courier |
| Leaf | `203163` | `2030162` |

No merge / no cross-link.
