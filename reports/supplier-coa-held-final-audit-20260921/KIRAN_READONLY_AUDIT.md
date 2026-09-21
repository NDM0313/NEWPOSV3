# KIRAN MUKESH — READ-ONLY audit

**Party final status:** `LEGIT_SPECIAL_ACCOUNTING_MODEL`  
**Company:** `e08a04af-22a8-4869-9b4d-da31fce13158`

## Identity (live)

| Field | Value |
|-------|--------|
| Contact ID | `797ca8bb-5491-4827-8d6e-c7971d20a022` |
| Code / name | `SUP-ZHD-0036` / **KIRAN MUKESH** |
| ERP type | `supplier` (active) |
| Business meaning | Artisan/worker-style advances + closing bills; **0** merchandise purchases |

## Accounts

| Code | ID | Parent | Active | Linked | Lines | Net Dr−Cr |
|------|-----|--------|--------|--------|------:|----------:|
| `AP-SUPZHD0036` | `2c79df0c-12cb-4e6b-924c-e904ae774c11` | 2000 | yes | KIRAN | **68** | **2,250,000** |
| `210036` | `5a51df64-60bb-4018-8c0d-9a02a7d551b7` | 2090 | **no** | none | **0** | 0 |
| Verified remap | `210036` → `AP-SUPZHD0036` | | | KIRAN | | |
| WA `1180` / WP `2010` leaves for contact | **none** | controls exist empty | | | | |

## Operational docs

| Doc | Count |
|-----|------:|
| Purchases | **0** |
| Payments | **1** (`PAY-6720` 2026-09-07 amount 300,000 on AP) |
| Activity window | 2023-10-11 → 2026-09-07 |

## Reference-type mix on AP leaf

| reference_type | lines | sum Dr | sum Cr |
|----------------|------:|-------:|-------:|
| opening_balance_contact_ap | 55 | 11,726,000 | 0 |
| transfer | 10 | 0 | 10,376,000 |
| journal | 2 | 600,000 | 0 |
| payment | 1 | 300,000 | 0 |

## Sample reconstruction

**JE-4697 (transfer CLOSING):** Dr `110076` 6,750,000 / Cr `AP-SUPZHD0036` 6,750,000 — shop AR vs KIRAN payable closing bill. Worker-payable economics filed under supplier AP.

## Line buckets

| Bucket | Result |
|--------|--------|
| A Canonical AP | 68 · `CANONICAL_ALREADY_CORRECT` (as current leaf) |
| B Legacy | 0 |
| D Off-leaf mentions | Bank/AR counterparty · `LEGIT_NON_AP_OPERATIONAL` |
| E Other-party | 0 |
| Eligible remap | **0** |
| Unresolved | **0** |
| Simulated GL | **0.00** (no-op) |

## Current posting

Recent payment and journals post to **`AP-SUPZHD0036`**. Narration may still cite `(210036)` → `COSMETIC_ONLY`.

## HOLD rationale

Not an open dual-account remap. Contact remains held from merchandise AP auto-repair because economics match **worker advance (1180) / work payable (2010)** models. Any future WA/WP package needs separate owner approval and line-class review — **not** drafted here.
