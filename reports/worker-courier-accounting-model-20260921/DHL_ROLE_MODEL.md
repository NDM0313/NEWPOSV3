# DHL local — role-model design (`SUP-ZHD-0007`)

**Decision:** `PROSPECTIVE_ROLE_MODEL_RECOMMENDED`  
**Not:** DHL PK (`SUP-ZHD-0162` / `2030162`)  
**Dual-account:** already closed (legacy `210007` = 0 lines)

## Identity

| Field | Value |
|-------|--------|
| Contact | `6ce5bed0-bd0a-495d-8841-19f90be6188c` |
| Type today | `supplier` |
| Canonical leaf | `AP-SUPZHD0007` · 48 lines · net Dr **4,700,000** |
| Purchases | **0** |
| Payments | 1 recent on AP leaf |

## Model comparison

| Model | Meaning | Debit habit | Credit habit | Fit |
|-------|---------|-------------|--------------|-----|
| **A Keep AP 2000** | Treat as merchandise supplier | Looks like prepaid/negative AP | Settlements reduce AP | **Poor** — 0 purchases; pollutes supplier aging/AP |
| **B Courier 203x** | Courier/deposit liability under 2030 | Deposits/advances to courier (same pattern as DHL PK on `2030162`) | Service bills / settlements | **Best match to existing ERP courier spine + sibling DHL PK** |
| **C Advance asset** | Recoverable deposit asset (1180-like) | Asset increase | Clear against expense/payable | Viable economically; **no courier UX**; mixes with worker control |
| **D Hybrid** | Asset deposits + courier payable charges | Split by event | Split by event | Only if owner proves both natures; needs multi-leaf + JE assist |

**Chosen direction:** Model **B** prospectively — because live sibling **DHL PK** already uses **203x debit deposits**, shipment/courier payment RPCs exist, and local DHL is deposit-heavy with settlement credits — **not** because the string “DHL” appears in the name.

## Lifecycle (ideal journals — design only)

1. **Deposit/advance:** Dr `203x` / Cr Bank  
2. **Service bill:** Dr Expense (or clearing) / Cr `203x`  
3. **Net against deposit:** may net on same leaf (debit deposit vs credit charge)  
4. **Extra payment / refund:** Dr `203x` or Cr Bank per policy  
5. **Remaining debit** = unapplied deposit with courier  

Do **not** post these in production in this phase.

## Historical simulation (heuristic)

| Bucket | Lines | Dr | Cr |
|--------|------:|---:|---:|
| ADVANCE_OR_DEPOSIT | 46 | 14,625,000 | 0 |
| SERVICE/SETTLE | 2 | 0 | 9,925,000 |
| AMBIGUOUS | 0 | | |

Strategy A: leave all 48 on AP as `HISTORICAL_KEEP_AS_IS`.  
Strategy B: would theoretically move deposit Drs → 203x and settle Crs → 203x; `TOTAL_GL_EFFECT` of JE balance remains 0, but AP liability presentation shrinks.

## Product prerequisites (before cutover)

- Create 203x via `get_or_create_courier_payable_account` **and** set `linked_contact_id`  
- Additive `couriers` row if Settings UX required  
- Prefer `contacts.type = courier` for routing (design; not done now)  
- JE assist / unified ledger courier gaps (see matrix)
