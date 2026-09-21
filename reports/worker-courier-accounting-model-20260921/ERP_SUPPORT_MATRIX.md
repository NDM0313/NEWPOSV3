# ERP support matrix — worker / courier role cutover

**Company snapshot:** 0 `worker` contacts, 0 `courier` contacts, 0 `WP-*`, 0 `WA-*`, 1× `203x` (DHL PK), 0 `couriers` rows.

## Leaf / domain

| Capability | Status | Notes |
|------------|--------|-------|
| AP `AP-*` under 2000 | `SUPPORTED` | Current home for DHL/KIRAN/SHAHMIM |
| Courier leaf RPC `get_or_create_courier_payable_account` | `SUPPORTED` | Numeric 203x; sets `contact_id` |
| Courier `linked_contact_id` parity | `PARTIAL` | Needed for attributed GL / JE assist |
| `couriers` master | `SUPPORTED` (empty) | Additive for Settings UX |
| Worker WP ensure `_ensure_worker_payable_subaccount` | `SUPPORTED` | Unused in this company yet |
| Worker WA-* under 1180 | `NOT_SUPPORTED` | Advances post to **1180 control** |
| Multi-leaf per contact | `SUPPORTED` | JE assist refuses silent pick if >1 |

## Screens / flows

| Surface | Worker | Courier | Notes |
|---------|--------|---------|-------|
| UnifiedPaymentDialog worker | `SUPPORTED` | `NOT_APPLICABLE` | Needs `type=worker` |
| Courier payment / PayCourierModal | `NOT_APPLICABLE` | `SUPPORTED` | Needs courier leaf (+ master) |
| Add Entry JE party assist | `PARTIAL` | `PARTIAL` | Worker OK; courier type not in party list |
| Add Entry dedicated worker/courier payment | `SUPPORTED` | `SUPPORTED` | Separate from GE assist |
| Party attributed GL | `PARTIAL` | `PARTIAL` | Needs `linked_contact_id` |
| Unified party ledger RPC | `SUPPORTED` | `NOT_SUPPORTED` | No `party_type=courier` |
| Customers & Suppliers report | `PARTIAL` | `NOT_SUPPORTED` | Workers wrongly in supplier filter; couriers excluded |
| Supplier AP ledger (2000 only) | `PARTIAL` | `NOT_APPLICABLE` | Hides role truth if left on AP |
| Trial Balance / Account Ledger | `SUPPORTED` | `SUPPORTED` | Account-centric OK |
| Aging AP | `PARTIAL` | `PARTIAL` | Misleading debit “AP” advances |
| Mobile worker/courier payment | `SUPPORTED` | `SUPPORTED` | Flows exist |
| Mobile contacts courier tab | `NOT_APPLICABLE` | `NOT_SUPPORTED` | |
| JE account guard / remaps | `SUPPORTED` | `SUPPORTED` | Does not invent role routing |
| Contact type flip tooling | `NOT_SUPPORTED` | `NOT_SUPPORTED` | Manual/design; preserve UUID |

## REQUIRED_FOR_CORRECTNESS (before prospective cutover)

1. Owner-approved contact type (`worker` / `courier`) **or** explicit routing bypass (discouraged).  
2. Leaf ensure: WP for workers; 203x for DHL; **WA ensure or documented control-1180 policy**.  
3. Payment path uses worker/courier screens (not supplier AP payment) after cutover.  
4. Set `linked_contact_id` on courier leaves.  
5. Reporting: stop treating workers as suppliers; courier discoverability path.  
6. Isolated tests for routing + multi-leaf JE assist.

## NICE_TO_HAVE

- Unified ledger `party_type=courier`  
- Contacts UI courier tab  
- Attributed “one party view” polish  
- Historical reclass packages (Phase F)  
- Auto type-flip tooling

## Breakage risk if type flipped without product work

| Risk | Effect |
|------|--------|
| `supplier` → `worker` only | Supplier payment/AP ensure may stop; worker payment needs WP/WA |
| `supplier` → `courier` only | Falls out of supplier reports; needs 203x + courier pay UX |
| Leaves created without type change | Partial — DHL PK pattern; payments may still hit AP |
