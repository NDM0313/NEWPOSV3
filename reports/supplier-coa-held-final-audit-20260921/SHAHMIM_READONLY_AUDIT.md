# SHAHMIM NAZ — READ-ONLY audit

**Party final status:** `LEGIT_SPECIAL_ACCOUNTING_MODEL`  
**Company:** `e08a04af-22a8-4869-9b4d-da31fce13158`

## Identity (live)

| Field | Value |
|-------|--------|
| Contact ID | `f902a1f8-cc8a-4508-8c47-beb1850da1ed` |
| Code / name | `SUP-ZHD-0046` / **SHAHMIM NAZ** |
| ERP type | `supplier` (active) |
| Business meaning | Worker/artisan-style advances + closing bills; **0** merchandise purchases |

## Accounts

| Code | ID | Parent | Active | Linked | Lines | Net Dr−Cr |
|------|-----|--------|--------|--------|------:|----------:|
| `AP-SUPZHD0046` | `4d6a9b2f-e471-42ae-8063-c8b2d261967a` | 2000 | yes | SHAHMIM | **86** | **5,000,000** |
| `210046` | `9d105e58-7654-49e5-861d-02d023d0c1c4` | 2090 | **no** | none | **0** | 0 |
| Verified remap | `210046` → `AP-SUPZHD0046` | | | SHAHMIM | | |
| WA/WP leaves | **none** | | | | | |

## Operational docs

| Doc | Count |
|-----|------:|
| Purchases | **0** |
| Payments | **1** (`PAY-6719` 2026-09-06 amount 300,000 on AP) |
| Activity window | 2023-10-01 → 2026-09-06 |

## Reference-type mix on AP leaf

| reference_type | lines | sum Dr | sum Cr |
|----------------|------:|-------:|-------:|
| opening_balance_contact_ap | 81 | 18,586,500 | 344,000 |
| transfer | 2 | 0 | 14,092,500 |
| journal | 2 | 550,000 | 0 |
| payment | 1 | 300,000 | 0 |

## Sample reconstruction

**JE-4692 (transfer CLOSING 2025):** Dr `110076` 7,036,500 / Cr `AP-SUPZHD0046` 7,036,500 — closing bill vs shop AR.

## Line buckets

| Bucket | Result |
|--------|--------|
| A Canonical AP | 86 · `CANONICAL_ALREADY_CORRECT` |
| B Legacy | 0 |
| D Off-leaf | Bank counterparty · `LEGIT_NON_AP_OPERATIONAL` |
| Eligible remap | **0** |
| Unresolved | **0** |
| Simulated GL | **0.00** |

## Current posting

`PAY-6719` and recent journals use **`AP-SUPZHD0046`**. Same cosmetic legacy-code narration pattern as KIRAN/DHL.

## HOLD rationale

Same as KIRAN: **worker special model** on supplier AP leaf; dual legacy→AP remap not required (legacy empty). Future 1180/2010 role package = separate approval track.
