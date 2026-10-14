# Discovery summary — Supplier Canonical TB Rollup

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Date:** 2026-09-22  
**Mode:** READ-ONLY

## Inputs

- `LEGACY_210_INVENTORY.csv` — 134 legacy `210xxx` / parent-2090 leaves
- `MAPPING_CANDIDATES.csv` — AUTO_SAFE classification
- `CLASSIFICATION_COUNTS.json`
- `VERIFIED_REMAPS.csv` (posting remaps; not used for TB aliases)
- Live special accounts: `2030162` DHL PK, `203163` DHL Payable, `WA-/WP-SUPZHD0036|0046`

## Classification counts

| Class | Count | Notes |
|-------|------:|-------|
| SAFE_SUPPLIER_ALIAS | 0 | No legacy row has both JE lines **and** a single linked active AP-SUP leaf |
| ALREADY_CLEAN | 35 | Inactive legacy, 0 JE lines, AP-SUP + verified remap present — no TB seed |
| ROLE_EXCEPTION | 3 | DHL `SUP-ZHD-0007`, KIRAN `0036`, SHAHMIM `0046` — hardlist; do not alias into AP |
| AMBIGUOUS | 96 | Mostly active legacy with JE lines but **no** AP-SUP leaf yet |
| NON_SUPPLIER | 0 | (DHL already courier → ROLE_EXCEPTION via hardlist) |

## ROLE_EXCEPTION hardlist (confirmed)

| Contact | Legacy | Live type | Special accounts |
|---------|--------|-----------|------------------|
| DHL `SUP-ZHD-0007` | 210007 | courier | `203163`; ≠ DHL PK `2030162` |
| KIRAN `SUP-ZHD-0036` | 210036 | (worker model) | `WA-SUPZHD0036`, `WP-SUPZHD0036` |
| SHAHMIM `SUP-ZHD-0046` | 210046 | (worker model) | `WA-SUPZHD0046`, `WP-SUPZHD0046` |

## Seed decision

`SAFE_SUPPLIER_ALIAS` seed count = **0**. Alias table will be created empty for DIN COLLECTION; Canonical TB = Raw TB until future SAFE pairs exist. ROLE_EXCEPTION / AMBIGUOUS never seeded.

## Artifacts

- `MAPPING_CANDIDATES.csv`
- `CLASSIFICATION_COUNTS.json`
- `LEGACY_210_INVENTORY.csv`
- `SEED_SAFE_ALIASES.sql` (empty / no VALUES)
