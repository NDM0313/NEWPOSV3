# ID LACE — supplier consolidation preview (NO production apply)

## CURRENT_STATE

| Field | Value |
|-------|--------|
| Contact | ID LACE `SUP-ZHD-0027` `d681fcf5-938f-4841-8a99-b83d59eb9375` |
| Type | `supplier` (correct) |
| Canonical AP | `AP-SUPZHD0027` `30bbe521-…` under **2000** — **89** open lines |
| Legacy | `210027` `e11d244a-…` **inactive, 0 lines** |
| Remap | `journal_account_verified_remaps`: 210027→AP-SUPZHD0027 |
| Purchases | 0 · Payments active | 2 |
| Payable (Cr−Dr) | **-356,697.00** (debit-heavy / prepaid-style net on AP leaf) |

## CANONICAL_ROLE

**Supplier** — history already on canonical AP leaf.

## TARGET_ACCOUNTS

Keep `AP-SUPZHD0027`. Keep verified remap. No IBRAHIM-style line move required (legacy empty).

## HISTORY_TO_MOVE

**None** (legacy line count = 0). Package is **master-data + reporting confirmation**, not Class B line remap.

## HISTORY_TO_PRESERVE

All 89 lines on `AP-SUPZHD0027` unchanged.

## EXPECTED_BALANCE_BEFORE / AFTER

Before = After on `AP-SUPZHD0027` (**-356,697** payable convention / net Dr 356,697).

## REPORTING_EFFECT

Customers & Suppliers + Party attributed GL + Supplier AP ledger already key off this leaf/contact.

## ROLLBACK_METHOD

N/A for line moves. Contact type unchanged.

## Package stub

`ID_LACE_SUPPLIER_CONSOLIDATION` — durable backup schema **optional** (meta-only) documenting “no lines to move”; assert legacy empty + remap present. **Do not execute** until owner phrases approval after staging.
