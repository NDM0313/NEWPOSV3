# SHAHMIM NAZ — role-model design (`SUP-ZHD-0046`)

**Decision:** `PROSPECTIVE_ROLE_MODEL_RECOMMENDED`  
**Target:** Same worker dual-leaf model as KIRAN (`1180`/`WA-*` + `2010`/`WP-*`)  
**Dual-account:** closed (legacy `210046` = 0)

## Identity

| Field | Value |
|-------|--------|
| Contact | `f902a1f8-cc8a-4508-8c47-beb1850da1ed` |
| Type today | `supplier` |
| AP leaf | `AP-SUPZHD0046` · 86 lines · net Dr **5,000,000** |
| Purchases | **0** |

## Lifecycle

Identical to KIRAN: advance → bill → apply → settle. Ideal journals are design-only (see KIRAN doc).

## Historical heuristic buckets

| Bucket | Lines | Dr | Cr | Net |
|--------|------:|---:|---:|----:|
| ADVANCE_ASSET | 83 | 19,436,500 | 0 | 19,436,500 |
| PAYABLE_LIABILITY | 2 | 0 | 14,092,500 | −14,092,500 |
| AMBIGUOUS | 1 | 0 | 344,000 | −344,000 |

Ambiguous = opening_balance credit without transfer bill pattern — must stay `AMBIGUOUS` / not auto-reclass.

Sample payable: JE-4692 `CLOSING 2025` Cr AP 7,036,500.

## Strategy

Same as KIRAN: **prospective-first**; historical optional; do not collapse advance+payable into one leaf.

## ERP prerequisites

Same WA/WP / `type=worker` / reporting filter gaps as KIRAN.
