# ARIF Golden Regression

**Date:** 2026-09-22  
**Company:** DIN COLLECTION `e08a04af-22a8-4869-9b4d-da31fce13158`  
**Contact:** ARIF LHR `SUP-ZHD-0017` / `21e1ac76-b911-44a1-87dd-6283969efa4c`

## Live RO proof (pre-deploy fingerprint)

| Check | Value |
|-------|------:|
| Linked Business lines (210017) | **24** |
| Sum debit | 1,624,000.00 |
| Sum credit | 1,663,937.00 |
| Business net (Cr − Dr) | **39,937.00** |
| Official AP (2000 / AP-*) | **0** |
| Classification | `LEGACY_ONLY_DETERMINISTIC` |

## Expected UI after alignment

| Surface | Expected |
|---------|----------|
| Supplier Statement — Business History | 24 deterministic rows, Source Account includes `210017`, closing **39,937** |
| Supplier Statement — Official AP | Empty / 0 (unchanged) |
| Contacts supplier GL | Aligns to Business net **39,937** payable |
| Customers & Suppliers Due (GL) | **39,937** |
| Customers & Suppliers Advance (GL) | **0** |
| Raw Account Ledger `210017` | Unchanged; Dr−Cr = **−39,937** |

## Unit tests

`node --test src/app/lib/supplierBusinessGl.node.test.ts src/app/lib/arifSupplierBusinessStatementPilot.node.test.ts` → **10/10 pass**
