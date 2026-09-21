# DHL — READ-ONLY audit

**Party final status:** `LEGIT_SPECIAL_ACCOUNTING_MODEL`  
**Company:** `e08a04af-22a8-4869-9b4d-da31fce13158`

## Identity (live)

| Field | Value |
|-------|--------|
| Contact ID | `6ce5bed0-bd0a-495d-8841-19f90be6188c` |
| Code / name | `SUP-ZHD-0007` / **DHL** |
| ERP type | `supplier` (active) |
| Business meaning | Local deposit/advance party historically filed under supplier AP — **not** DHL Pakistan international courier master |
| Distinct sibling | **DHL PK** `SUP-ZHD-0162` `4505905b-…` with courier leaf `2030162` (14 lines) + `AP-SUPZHD0162` (1 line) — **do not merge** |

## Accounts

| Code | ID | Parent | Active | Linked | Lines | Net Dr−Cr |
|------|-----|--------|--------|--------|------:|----------:|
| `AP-SUPZHD0007` | `9c512049-6b68-4d2a-9516-27d43163efc4` | 2000 | yes | DHL | **48** | **4,700,000** |
| `210007` | `2fe47afc-ac2e-4b8d-8146-5741ca83d27a` | 2090 | **no** | none | **0** | 0 |
| Verified remap | `210007` → `AP-SUPZHD0007` | — | — | DHL | — | — |
| Courier 203x for **this** DHL | **missing** | 2030 control exists; `couriers` rows for company = **0** | | | | |

## Operational docs

| Doc | Count |
|-----|------:|
| Purchases | **0** |
| Payments | **1** (`PAY-6729` 2026-09-15 amount 200,000 → Dr AP / Cr `190176`) |
| Activity window | 2024-04-04 → 2026-09-15 |

## Reference-type mix on AP leaf

| reference_type | lines | sum Dr | sum Cr |
|----------------|------:|-------:|-------:|
| opening_balance_contact_ap | 43 | 13,725,000 | 0 |
| journal | 2 | 700,000 | 0 |
| payment | 1 | 200,000 | 0 |
| transfer | 2 | 0 | 9,925,000 |

Economic reading: predominantly **advances/deposits** (debits) and large transfer settlements (credits) — **not** merchandise purchase AP.

## Line buckets

| Bucket | Result |
|--------|--------|
| A Canonical AP | 48 · `CANONICAL_ALREADY_CORRECT` |
| B Legacy | 0 |
| C Outside canonical payable | 0 |
| D Off-leaf name mentions | Bank `190001`/`190176`/`180005`, AR `110076` · `LEGIT_NON_AP_OPERATIONAL` |
| E Other-party contamination | 0 for this contact’s payable |
| F Dedicated courier leaf for this DHL | none |

**ELIGIBLE_ACCOUNT_REMAP_CANDIDATE:** **0**  
**UNRESOLVED:** **0**  
**Simulated GL effect if eligible moved:** n/a / **0.00**

## Sample reconstructions

**PAY-6729:** Dr `AP-SUPZHD0007` 200000 / Cr `190176` 200000 — balanced; current path uses AP leaf.

Recent journals narrate `DHL (210007)` while posting to `AP-SUPZHD0007` → **`COSMETIC_ONLY`** + remap already directing new posts.

## Current vs historical

- **Historical dual defect (open lines on 210007):** gone.
- **Current posting path:** AP leaf (payment module) — not a live dual-write bug.
- **Remaining HOLD reason:** role/model — courier-style economics sitting in merchandise AP; future 203x migration is separate from Class B/C remaps.

## Reporting note (no code change)

Party Ledger / supplier AP views that key off 2000 will show DHL as a large debit AP balance (advances). Courier 203x reporting will **not** include this contact until a role package exists. That is a discoverability gap, not an eligible line remap.
