# KIRAN MUKESH — role-model design (`SUP-ZHD-0036`)

**Decision:** `PROSPECTIVE_ROLE_MODEL_RECOMMENDED`  
**Target:** Worker **advance asset (1180 / WA-*)** + **work payable (2010 / WP-*)**  
**Dual-account:** closed (legacy `210036` = 0)

## Identity

| Field | Value |
|-------|--------|
| Contact | `797ca8bb-5491-4827-8d6e-c7971d20a022` |
| Type today | `supplier` |
| AP leaf | `AP-SUPZHD0036` · 68 lines · net Dr **2,250,000** |
| Purchases | **0** |

## Why not single AP

AP is a **liability**. Large **debit** history (advances to artisan) is economically an **asset**. Mixing advance Drs and closing-bill Crs on one AP leaf hides true payable vs prepaid and mislabels the party as a merchandise supplier.

## Lifecycle (design journals only)

1. **Advance issued:** Dr `WA-*`/`1180` / Cr Bank  
2. **Work performed / bill:** Dr WIP/Expense / Cr `WP-*`/`2010`  
3. **Apply advance:** Dr `WP-*` / Cr `WA-*` (or settlement JE `worker_advance_settlement` pattern)  
4. **Remainder payable:** unpaid credit on WP  
5. **Settlement:** Dr WP / Cr Bank (`worker_payment`)  
6. **Excess advance:** remains debit on WA  

**Both leaves are required** unless product deliberately keeps a single netting account (current AP hack) — not recommended.

## Historical heuristic buckets

| Bucket | Lines | Dr | Cr | Net |
|--------|------:|---:|---:|----:|
| ADVANCE_ASSET | 58 | 12,626,000 | 0 | 12,626,000 |
| PAYABLE_LIABILITY | 10 | 0 | 10,376,000 | −10,376,000 |
| AMBIGUOUS | 0 | | | |

Sample payable: JE-4697 transfer `CLOSING` Cr AP 6,750,000 vs shop AR.

## Strategy

- **A Prospective:** from cutover, worker payment screen + WP/WA leaves; old AP frozen historical. **Recommended.**  
- **B Historical:** optional; reclass ADVANCE → 1180 family and PAYABLE → 2010 family with per-line allowlist. Asset↑ / AP↓ presentation change; needs owner gate.

## ERP gap blocker

Live company has **0 WP leaves**, **0 WA leaves**, **0 worker contacts**. `_ensure_worker_payable_subaccount` exists; **WA-* ensure is NOT shipped** — advances today post to **1180 control**. MVP must add WA leaf ensure **or** accept control-level advances with clear reporting.
