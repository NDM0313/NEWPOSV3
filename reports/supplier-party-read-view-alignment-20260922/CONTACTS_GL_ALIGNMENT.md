# Contacts GL Alignment

Contacts supplier payables now overlay **Supplier Business Net** from `loadSupplierBusinessGlBalancesMap` (same attribution core as Supplier Business History).

| Item | Behavior |
|------|----------|
| Source | `partyAttributed` linked leaves + verified remaps; filter `ap_2000` + `legacy_2090` |
| Suppliers / both / money_exchange | Display `businessNet` (Cr − Dr); advance (negative) surfaces as receivable-side |
| Workers / couriers | **No** business overlay — keep `get_contact_party_gl_balances` worker/courier slice |
| Official AP | Still available from RPC `gl_ap_payable` for diagnostics; Contacts cards use Business for supplier roles |

ARIF: Contacts supplier GL must show **39,937** payable (not 0).
