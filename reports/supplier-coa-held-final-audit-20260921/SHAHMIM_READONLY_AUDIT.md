# SHAHMIM NAZ — read-only dual-account / role audit

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**As-of:** 2026-09-21 (production RO)  
**Final status:** `LEGIT_SPECIAL_ACCOUNTING_MODEL`  
**Dual-CoA eligible remaps:** **0**

## Identity

| Field | Value |
|-------|--------|
| Contact ID | `f902a1f8-cc8a-4508-8c47-beb1850da1ed` |
| Code | `SUP-ZHD-0046` |
| Name | `SHAHMIM NAZ` |
| Type | `supplier` (active) |
| Purchases | **0** |
| WA/WP leaves | **none** |

## Accounts

| Role | Code | Account ID | Parent | Active | Open lines | Net Dr |
|------|------|------------|--------|--------|------------|--------|
| Canonical AP leaf | `AP-SUPZHD0046` | `4d6a9b2f-e471-42ae-8063-c8b2d261967a` | `2000` | yes | **86** | **5,000,000** |
| Legacy | `210046` | `9d105e58-7654-49e5-861d-02d023d0c1c4` | `2090` | **no** | **0** | 0 |

## Canonical line mix (non-void)

| reference_type | lines | Dr | Cr |
|----------------|------:|---:|---:|
| opening_balance_contact_ap | 81 | 18,586,500 | 344,000 |
| journal | 2 | 550,000 | 0 |
| transfer | 2 | 0 | 14,092,500 |
| payment | 1 | 300,000 | 0 |

## Classification (dual CoA)

| Class | Count |
|-------|------:|
| CANONICAL_ALREADY_CORRECT | 86 |
| ELIGIBLE_ACCOUNT_REMAP_CANDIDATE | **0** |
| UNRESOLVED | 0 |

## Economic meaning

Same worker-style pattern as KIRAN: advances/OB to NASEEM NAZ stan accounts; transfer settlements; **zero** merchandise purchases. Prior preview: `reports/party-role-consolidation-20260920/SHAHMIM_WORKER_REPAIR_PREVIEW.md` (not executed).

## Current vs historical

| Lens | Finding |
|------|---------|
| HISTORICAL dual CoA | Absent (legacy empty) |
| CURRENT posting path | PAY-6719 (2026-09-06) still on AP leaf — role path issue |

## Simulation

Empty dual allowlist → `TOTAL_GL_EFFECT = 0`.

## Repair design

No dual-CoA package in this phase. Future worker package must be SHAHMIM-only with exact-line allowlist if owner ever approves role consolidation.
