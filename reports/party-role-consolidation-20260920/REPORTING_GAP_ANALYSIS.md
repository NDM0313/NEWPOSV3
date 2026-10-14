# Reporting / UI gap analysis — one party, one view

## Goal

One contact → one party view showing complete valid history, while GL stays on role-correct controls (2000 / 1180+2010 / 203x). **Not** “everything into Supplier AP.”

## Surfaces inspected (code)

| Surface | Path | Today |
|---------|------|--------|
| Customers & Suppliers report | `get_customers_suppliers_report` | Supplier tab includes `supplier|both|worker`; **excludes courier** |
| Party attributed GL | `partyAttributedGlLedgerService.ts` | All `linked_contact_id` leaves (can merge AP+legacy+203x) |
| Supplier AP GL | `getSupplierApGlJournalLedger` | **2000 AP subtree only** |
| Unified ledger RPC | `20260621150000_unified_ledger_phase_15_rpcs.sql` | `customer|supplier|worker` only — **no courier** |
| Effective party ledger | `effectivePartyLedgerService.ts` | customer/supplier docs only |
| Journal party assist | `journalPartyPosting.ts` | Role hints; courier not mapped from contact type → generic |
| Contacts UI | `ContactsPage.tsx` | No courier tab; TS union often omits `courier` |

## Per-role view contract (proposed)

### Supplier (ID LACE)

- One view = purchases + payments + JEs + AP leaf under 2000 + OB.
- Account Ledger on `AP-SUPZHD0027` already holds full history (legacy empty).
- Customers & Suppliers: keep as supplier.

### Worker (KIRAN, SHAHMIM)

- One view = **component** 1180 (advance) + 2010 (work payable) + settlements + JEs.
- Show component balances **and** net; **do not** sum 1180+2010 as double economic exposure without netting settlements.
- Remove from Customers & Suppliers **supplier** filter once `type=worker` (use Workers report / unified worker party).
- Today they appear as suppliers with large **debit** AP (advance pattern) — misleading.

### Courier (DHL, DHL PK)

- One view = deposits/charges/settlements/JEs on **203x** leaves only.
- DHL and DHL PK **separate** party pages.
- Exclude from Customers & Suppliers; expose via Courier / attributed GL / unified extension.
- DHL PK already mostly on `2030162`; DHL entirely on AP — need leaf + remaps.

## Filter recommendation

Prefer **canonical business role** = `contacts.type` (after cleanup) **plus** linked account control family as safety check:

- Report inclusion: type ∈ expected set for that report.
- Fail-closed: if type=worker but only AP-2000 leaf exists → show warning “misfiled GL” rather than hide history.

## Double-count risk

Attributed GL that unions AP-SUP* + 203x for DHL PK without excluding the stray AP payment would **double-count** if both leaves keep the same economic payment after move. Repair must **move** the AP line to 203x (not copy).

## Gap summary

| Gap | Severity | Fix direction |
|-----|----------|---------------|
| Workers in supplier report | High | type→worker; report filter drop worker from supplier |
| Couriers missing from unified party_type | High | extend RPC or courier-specific ledger |
| DHL on 2000 not 203x | High | create 203x + historical reclass package |
| DHL PK dual AP+203 | Medium | move 1 AP payment line |
| Contacts UI no courier | Medium | add type or Settings-only |
| journalPartyRoleHint ignores courier | Medium | map `courier` → courier role |
| Staging not run this phase | Blocker for prod apply | next gated step |
