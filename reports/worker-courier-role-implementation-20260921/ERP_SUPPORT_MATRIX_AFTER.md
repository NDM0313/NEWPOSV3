# ERP support matrix AFTER role-model implementation

Compare to `reports/worker-courier-accounting-model-20260921/ERP_SUPPORT_MATRIX.md`.

## Leaf / domain

| Capability | BEFORE | AFTER |
|------------|--------|-------|
| AP `AP-*` under 2000 | SUPPORTED | SUPPORTED (unchanged) |
| Courier `get_or_create_courier_payable_account` | SUPPORTED | SUPPORTED |
| Courier `linked_contact_id` parity | PARTIAL | **SUPPORTED** |
| Worker WP ensure | SUPPORTED | SUPPORTED (+ worker role gate) |
| Worker WA-* under 1180 | NOT_SUPPORTED | **SUPPORTED** (`_ensure_worker_advance_subaccount`) |
| Multi-leaf JE refuse | SUPPORTED | SUPPORTED (+ `workerIntent` opt) |
| Party GL WA subtree | PARTIAL (control only) | **SUPPORTED** (1180 subtree) |

## Screens / flows

| Surface | BEFORE | AFTER |
|---------|--------|-------|
| Add Entry JE party assist worker | PARTIAL | **SUPPORTED** (explicit multi-leaf) |
| Add Entry JE party assist courier | PARTIAL | **SUPPORTED** (courier in party list + role hint) |
| Worker advance / bill / apply / pay | PARTIAL (control 1180) | **SUPPORTED** (WA/WP leaves via TS resolvers) |
| Courier deposit / charge / settle | SUPPORTED | SUPPORTED (parity linkage) |
| Customers & Suppliers | PARTIAL (workers as suppliers) | **SUPPORTED** filter excludes worker/courier |
| Unified party ledger courier | NOT_SUPPORTED | PARTIAL (still no party_type=courier RPC) |
| Mobile worker payable ensure | PARTIAL | **SUPPORTED** (RPC ensure on studio finalize) |
| Mobile worker GL WA/WP leaves | PARTIAL | **SUPPORTED** (WA-/WP- codes included) |
| Contact type flip tooling | NOT_SUPPORTED | NOT_SUPPORTED (by design) |

## Still PARTIAL / deferred

- Production `record_payment_with_accounting` worker branch still selects existing WP child / control **1180** until next payment-RPC rewrite uses `_resolve_worker_payment_debit_account` (TS payment paths already prefer leaves).
- Unified ledger `party_type=courier`.
- Contacts UI courier tab.
- Strategy B historical reclass (`DEFERRED_OPTIONAL_PHASE_F`).

## REQUIRED_FOR_CORRECTNESS before production cutover

1. Owner-approved type flip + T0.  
2. Create leaves **after** type flip (migration alone does not create DHL/KIRAN/SHAHMIM leaves).  
3. Staging smoke of worker + courier flows.  
4. Optional: wire payment RPC helper into `record_payment_with_accounting`.

## Security / Postgres gate (2026-09-22)

| Item | Status |
|------|--------|
| DEFINER company auth (`get_user_company_id` match) | **SUPPORTED** |
| PUBLIC/anon EXECUTE on privileged ensures | **DENIED** |
| Cross-company mutation isolation | **PROVEN** (isolated PG) |
| Isolated Postgres regression | **`ROLE_MODEL_POSTGRES_REGRESSION_PASS`** |
| Feature-branch GHA workflow | **ADDED** |
| Production migrate/deploy | **NO** |

Prior `ENGINEERING_READY` without executed PG/ACL was provisional. See `…/20260922/SECURITY_AND_POSTGRES_GATE.md`.
