# Phase 2.14 — Roznamcha unified loader rollout plan

**Status:** `PHASE 2.14 ROZNAMCHA LOADER FAILED — rolled back to legacy`  
**Prerequisite commit:** `a7a4b727` — Phase 2.13 Party Ledger loader  
**Company:** DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485`  
**Screen:** Roznamcha only — Cash/Bank parity out of scope

## Flags

| Flag | Purpose |
|------|---------|
| `unified_ledger_screen_roznamcha` | Screen gate (L2) |
| `unified_ledger_loader_roznamcha` | Main loader swap (L1) |

## Loader decision order

Kill switch → loader OFF → engine OFF → screen OFF → unified (`shadowForce: false`)

## QA attributes

- `data-roznamcha-main-loader`
- `data-roznamcha-preview-compare-source`

## Evidence

`reports/single-core-ledger/phase-2-14-roznamcha-loader/`
