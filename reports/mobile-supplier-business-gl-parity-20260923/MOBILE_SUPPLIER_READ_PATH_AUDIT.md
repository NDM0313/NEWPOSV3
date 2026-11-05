# Mobile Supplier Read Path Audit

**Date:** 2026-09-23  
**Branch:** `feat/mobile-supplier-business-gl-parity`

## Before (Official AP only)

| Surface | Reader | Basis |
|---------|--------|-------|
| Supplier Ledger **list** (`PartyLedgerReport` kind=supplier) | `fetchContactPartyGlBalancesMap` → `glApPayable` via `resolveContactListBalance` | Official AP (2000 / AP-SUP) |
| Supplier Ledger **detail** | `getSupplierApGlLedgerLinesForContact` → RPC `get_supplier_ap_gl_ledger_for_contact` | Official AP only |
| Contacts list (supplier role) | same `glApPayable` path | Official AP |
| `getAllSuppliersWithPayable` | same | Official AP |
| Account CoA ledger (payable leaf + linked contact) | `getSupplierApGlLedgerLinesForContact` | **Kept** Official AP (account-centric CoA drill) |

## After (Supplier Business GL)

| Surface | Reader | Basis |
|---------|--------|-------|
| Supplier Ledger **list** | `loadSupplierBusinessGlBalancesMap` → `businessNet` (Cr−Dr) | Business GL (`ap_2000` + `legacy_2090`) |
| Supplier Ledger **detail** (default) | `loadSupplierBusinessHistory` | Business History |
| Supplier Ledger **detail** (toggle) | `getSupplierApGlLedgerLinesForContact` | Official AP (unchanged API) |
| Contacts list (supplier / all) | Business overlay when `isSupplierBusinessContactType` | Business GL |
| `getAllSuppliersWithPayable` | Business overlay, `max(0, businessNet)` | Business payable clamp |
| Account CoA ledger | unchanged | Official AP / sub-account |

## Intentionally NOT changed

| Path | Reason |
|------|--------|
| `getSupplierApGlLedgerLinesForContact` | Official AP diagnostic / toggle |
| `partyGlDueForListRole` / `glApPayable` helpers | Still used for customer/worker and Official AP fallback |
| `fetchContactBalancesSummary` combined payables | Used for mixed summaries; Contacts supplier path now overlays Business |
| Customer / worker ledger paths | Unchanged |
| AccountLedgerReport supplier-AP branch | Explicit Official/control CoA statement |

## Role exclusions

Worker and courier contacts are excluded from `isSupplierBusinessContactType` and never enter the Business GL batch map as suppliers.
