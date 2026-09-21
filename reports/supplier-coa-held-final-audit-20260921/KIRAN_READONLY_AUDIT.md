# KIRAN MUKESH — read-only dual-account / role audit

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**As-of:** 2026-09-21 (production RO)  
**Final status:** `LEGIT_SPECIAL_ACCOUNTING_MODEL`  
**Dual-CoA eligible remaps:** **0**

## Identity

| Field | Value |
|-------|--------|
| Contact ID | `797ca8bb-5491-4827-8d6e-c7971d20a022` |
| Code | `SUP-ZHD-0036` |
| Name | `KIRAN MUKESH` |
| Type | `supplier` (active) |
| Purchases | **0** |
| WA/WP leaves | **none** |

## Accounts

| Role | Code | Account ID | Parent | Active | Open lines | Net Dr |
|------|------|------------|--------|--------|------------|--------|
| Canonical AP leaf | `AP-SUPZHD0036` | `2c79df0c-12cb-4e6b-924c-e904ae774c11` | `2000` | yes | **68** | **2,250,000** |
| Legacy | `210036` | `5a51df64-60bb-4018-8c0d-9a02a7d551b7` | `2090` | **no** | **0** | 0 |

## Canonical line mix (non-void)

| reference_type | lines | Dr | Cr |
|----------------|------:|---:|---:|
| opening_balance_contact_ap | 55 | 11,726,000 | 0 |
| transfer | 10 | 0 | 10,376,000 |
| journal | 2 | 600,000 | 0 |
| payment | 1 | 300,000 | 0 |

## Classification (dual CoA)

| Class | Count |
|-------|------:|
| CANONICAL_ALREADY_CORRECT | 68 |
| ELIGIBLE_ACCOUNT_REMAP_CANDIDATE | **0** |
| UNRESOLVED | 0 |

Narration often cites `210036` while lines sit on `AP-SUPZHD0036` → **COSMETIC_ONLY** vs dual CoA.

## Economic meaning

Debits predominate as advances/OB; credits as transfer settlements to beneficiary accounts (e.g. SHIMERA IMRAN). Matches **worker advance / work-payable** economics, not merchandise supplier AP. Prior preview: `reports/party-role-consolidation-20260920/KIRAN_WORKER_REPAIR_PREVIEW.md` (not executed).

## Current vs historical

| Lens | Finding |
|------|---------|
| HISTORICAL dual CoA | Absent (legacy empty) |
| CURRENT posting path | PAY-6720 (2026-09-07) still on AP leaf — role path issue |

## Simulation

Empty dual allowlist → `TOTAL_GL_EFFECT = 0`.

## Repair design

No dual-CoA package. Any future worker-leaf design requires separate owner approval and WA/WP allowlists — not part of this phase.
