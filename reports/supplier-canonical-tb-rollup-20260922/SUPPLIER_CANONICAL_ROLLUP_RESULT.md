# SUPPLIER_CANONICAL_ROLLUP_RESULT

**Verdict: `SUPPLIER_CANONICAL_ROLLUP_PASS`**

**Date:** 2026-09-22  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Branch:** `feat/supplier-canonical-tb-rollup`

## What shipped

| Layer | Change |
|-------|--------|
| Schema | `account_reporting_aliases` + `list_account_reporting_alias_sources` (`migrations/20260922150000_account_reporting_aliases.sql`) |
| TB RPC | `get_unified_trial_balance(..., p_presentation text DEFAULT 'canonical')` (`migrations/20260922151000_unified_trial_balance_reporting_presentation.sql`) |
| UI | Trial Balance **Canonical (rolled-up)** vs **Raw GL** toggle (default Canonical); source-count chip; multi-account ledger drill with Source account column |
| Seed | **0** `SAFE_SUPPLIER_ALIAS` rows (discovery found no legacy+AP pair with JE activity on both sides) |

## Discovery classification (134 legacy 210 rows)

| Class | Count |
|-------|------:|
| SAFE_SUPPLIER_ALIAS | 0 |
| ALREADY_CLEAN | 35 |
| ROLE_EXCEPTION | 3 (DHL / KIRAN / SHAHMIM) |
| AMBIGUOUS | 96 |

Artifacts: `MAPPING_CANDIDATES.csv`, `CLASSIFICATION_COUNTS.json`, `DISCOVERY_SUMMARY.md`, `LEGACY_210_INVENTORY.csv`.

## Parity gates

### Clone `ledger_stage_20260919_prodcheck`

| Check | Result |
|-------|--------|
| Canonical Dr = Raw Dr | PASS `872277543.57` |
| Canonical Cr = Raw Cr | PASS `872277543.57` |
| Difference both modes | PASS `0.00` |
| Alias rows | 0 |
| ROLE_EXCEPTION aliases | 0 |
| historical_rows_modified | 0 |

### Production `postgres`

| Check | Result |
|-------|--------|
| Raw before migrate | `872788218.57` |
| Raw after migrate | `872788218.57` (= before) |
| Canonical Dr = Raw Dr | PASS `872788218.57` |
| Canonical Cr = Raw Cr | PASS `872788218.57` |
| Difference both modes | PASS `0.00` |
| Alias rows | 0 |
| ROLE_EXCEPTION aliases | 0 |
| historical_rows_modified | 0 |

## Deploy

- DB migrations applied on clone then production (reporting-only; no JE rewrite; no dual-account repair).
- Frontend hard-rebuild: `erp-frontend` healthy; `https://erp.dincouture.pk/` → 200 (`CACHEBUST=1790071836`).

## Explicit non-goals (unchanged)

- No historical `journal_entry_lines.account_id` remaps
- No Strategy B / IBRAHIM / ID LACE mutation
- No WA/WP/203x role cutover (accounts already exist for KIRAN/SHAHMIM/DHL; not collapsed into AP)
- DHL PK `2030162` remains distinct from DHL courier `203163` / `SUP-ZHD-0007`
