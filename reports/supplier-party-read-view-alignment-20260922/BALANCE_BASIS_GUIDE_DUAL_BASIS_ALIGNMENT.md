# Balance Basis Guide — dual-basis alignment (Official AP vs Business GL)

**Verdict:** `BALANCE_BASIS_GUIDE_DUAL_BASIS_ALIGNMENT_PASS`

**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Date:** 2026-09-22 / 2026-09-23 (Asia/Karachi)

---

## Sync / worktree

| Item | Value |
|------|-------|
| HOME starting SHA (pre-impl on this PC after fetch) | `6034f9c11ff78e174e2507919e433336d92be286` |
| Sync method | Clean working tree → checkout `feat/supplier-party-read-view-alignment` → `git pull --ff-only` (no worktree; no reset/clean/stash pop) |
| Remote base SHA (feature tip at start) | `6034f9c11ff78e174e2507919e433336d92be286` |
| Known prior accounting app deploy | `08a11922` |
| `origin/main` expected | `554a12ca004236a6818e570b22ec0dd2a106c3c1` (not merged) |

---

## Root cause

Balance Basis Guide was **Official AP / 2000-control only**. It never loaded Supplier Business GL, so legacy-only suppliers (Official AP = 0, Business GL ≠ 0) looked “empty” and could vanish under hide-zero.

Secondary production bug found during verify: `loadSupplierBusinessGlBalancesMap` used a single PostgREST `.in(account_id, …)` without paging. On DIN COLLECTION (~129 supplier-linked accounts, ~5.8k party JE lines) that returned empty → **all Business GL zeros**. Fixed with existing `fetchInBatches` + `.range` paging (same attribution engine; no second classifier).

---

## Files changed

| File | Change |
|------|--------|
| `src/app/lib/balanceBasisGuideLogic.ts` | `businessGlNet`; hide-zero keeps non-zero Business GL; `sumSupplierBusinessGlExposure` |
| `src/app/services/balanceBasisGuideReportService.ts` | Load shared map; export columns |
| `src/app/components/reports/BalanceBasisGuidePage.tsx` | O1 labels + banner; Business GL column; Supplier Business Exposure card; export |
| `src/app/lib/balanceBasisGuideLogic.test.ts` | ARIF / CLEAN_AP / role / hide-zero tests |
| `src/app/lib/supplierBusinessGl.ts` | Chunked + paged JE line fetch (shared map fix) |

Migrations: **NONE**  
Graphify: **NO**  
main merge: **NO**

---

## Implementation commits

| SHA | Role |
|-----|------|
| `41786b1dcdb78efdd82ebf5d0c52b6af3bf9c0a7` | Dual-basis UI + Official AP labels + Business GL column |
| `f414e4102e63ad8a2dc4fed952749c83ea8225a3` | Shared map fetch paging (production zeros fix) |
| *(this docs commit)* | Evidence |

Deployed SHA: **`f414e4102e63ad8a2dc4fed952749c83ea8225a3`**  
Bundle: `index-xAAsNMN1.js` on `https://erp.dincouture.pk`

---

## Browser verification (DIN COLLECTION)

### ARIF golden (`SUP-ZHD-0017`)

| Field | Result |
|-------|--------|
| Official AP (2000) | **0** |
| Business GL | **39,937** |
| Visible with hide-zero ON | **YES** |

### Other cases

| Case | Result |
|------|--------|
| CLEAN_AP ALAM BNRS | Official AP = Business GL = **1,105,100** |
| ZERO_HISTORY ABC (`SUP-ZHD-0011`) | both 0 (matrix); hide-zero may hide — expected |
| Worker KIRAN / SHAHMIM | Business GL = **—** |
| Courier DHL / DHL PK | Business GL = **—** |
| Matrix class B (Official 0, Business ≠ 0) | Matrix **59**; live table sampled **≥39** (e.g. ABDULLAH KHTK, AHMED BNRS, AMIR SKT, ARIF, ASIM GUJ) |

### Control accounting (must not change)

| Metric | Value |
|--------|-------|
| Control AP 2000 (UI) | **Rs. -2,283,810.00** |
| 2000 Accounts Payable card | **Rs. -2,283,810.00** |
| RO SQL family Cr−Dr (2000 + AP-*) | **-2283810.00** |
| Control AP changed by this work | **NO** |
| TB / Balance Sheet logic changed | **NO** |
| Supplier Business Exposure card | **Rs. 15,934,510.50** (visible suppliers; **outside** Control variance) |

---

## Financial immutability (this deploy window)

READ-ONLY fingerprint (all companies / all lines as queried):

| | JE count | Line count | Σ debit | Σ credit | difference |
|--|----------|------------|---------|----------|------------|
| PRE | 6536 | 13471 | 1562982132.08 | 1563017862.08 | -35730.00 |
| POST | 6536 | 13471 | 1562982132.08 | 1563017862.08 | -35730.00 |

**PRE == POST** for deploy window.

| Check | Result |
|-------|--------|
| JEs modified | **0** |
| journal `account_id` modified | **0** |
| accounts / contacts modified | **0** |
| database mutations | **0** |
| migrations applied | **NONE** |

(Note: totals differ from older historical baseline 5062/10124/… due to intervening business activity; freshness gate is PRE==POST only.)

---

## Exports

CSV/Excel/print path includes separate columns **Official AP (2000)** and **Business GL** (does not replace Official AP).

---

## Remaining items

- Live mismatch count (39) may be below matrix 59 after role-model cutovers / filters; matrix remains discovery SoT for class B inventory.
- Subledger Code/GL hint may still omit `210017` when another linked code wins first; ARIF row identity is by contact code/name.
- Do not fold Business GL into Control AP, TB, or Balance Sheet.

---

## Explicit non-actions

- No JE / account / contact repair  
- No AP-SUP creation  
- No Graphify update  
- No force push; no `main` merge  
- VPS local WIP (`deploy/backup-page/*`, untracked SQL) left untouched
