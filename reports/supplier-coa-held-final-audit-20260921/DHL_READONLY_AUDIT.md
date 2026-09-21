# DHL — read-only dual-account / role audit

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**As-of:** 2026-09-21 (production RO)  
**Final status:** `LEGIT_SPECIAL_ACCOUNTING_MODEL`  
**Dual-CoA eligible remaps:** **0**

## Identity (from live ERP — not inferred from label alone)

| Field | Value |
|-------|--------|
| Contact ID | `6ce5bed0-bd0a-495d-8841-19f90be6188c` |
| Code | `SUP-ZHD-0007` |
| Name | `DHL` |
| Type | `supplier` (active) |
| Purchases | **0** |
| Separate entity | **DHL PK** `4505905b-…` / `SUP-ZHD-0162` — **do not merge** |

## Accounts

| Role | Code | Account ID | Parent | Active | Open lines | Net Dr |
|------|------|------------|--------|--------|------------|--------|
| Canonical AP leaf | `AP-SUPZHD0007` | `9c512049-6b68-4d2a-9516-27d43163efc4` | `2000` | yes | **48** | **4,700,000** |
| Legacy | `210007` | `2fe47afc-ac2e-4b8d-8146-5741ca83d27a` | `2090` | **no** | **0** | 0 |
| Courier leaf for **this** contact | — | — | — | — | **none** | — |
| DHL PK courier leaf (other contact) | `2030162` | `919a3a0a-…` | `2030` | yes | 14 | (other party) |

`account_remaps` table: **not present** in this database.

## Canonical line mix (non-void)

| reference_type | lines | Dr | Cr |
|----------------|------:|---:|---:|
| opening_balance_contact_ap | 43 | 13,725,000 | 0 |
| transfer | 2 | 0 | 9,925,000 |
| journal | 2 | 700,000 | 0 |
| payment | 1 | 200,000 | 0 |

## Classification of dual-CoA suspects

| Class | Count | Notes |
|-------|------:|-------|
| CANONICAL_ALREADY_CORRECT | 48 | All live liability on AP leaf |
| LEGIT_LEGACY_HISTORICAL | 0 | Legacy empty |
| ELIGIBLE_ACCOUNT_REMAP_CANDIDATE | **0** | Nothing left on `210007` |
| LEGIT_NON_AP_OPERATIONAL | n/a for dual | Economics are courier/advance-like; role redesign is separate |
| OTHER_PARTY | 0 | |
| COSMETIC_ONLY | present | JE text often says `210007` while posting to AP leaf |
| UNRESOLVED | 0 | |

## Economic meaning

Sample recent activity is bank transfer / payment naming (e.g. PAY-6729 2026-09-15; OB lines “Money Transferred To ABIR MUNIR…”). **No merchandise purchase documents.** Treating this as ordinary supplier merchandise AP would be incorrect.

## Current vs historical

| Lens | Finding |
|------|---------|
| HISTORICAL_DATA_ISSUE (dual CoA) | **Resolved / absent** — legacy drained |
| CURRENT_POSTING_PATH_ISSUE (role) | **Yes** — ERP still books DHL activity to supplier AP under 2000 |

## Simulation (dual remap)

Empty allowlist → `TOTAL_GL_EFFECT = 0` (no-op).

## Repair design

Not opened for dual CoA. Future courier-role package (if owner-approved) must be **DHL-only**, create 203x leaf, never touch DHL PK / Ibrahim / ID LACE.
