# Implementation report — worker/courier prospective role model

**Date:** 2026-09-21  
**Branch:** `feat/worker-courier-role-model-implementation`  
**Strategy:** `STRATEGY_A_PROSPECTIVE_FIRST`  
**Dual-account cleanup:** `SUPPLIER_DUAL_ACCOUNT_CLEANUP_FINAL_CLOSED` (not reopened)

## Audit merge

| Item | SHA |
|------|-----|
| Pre-merge main | `7678aa5623d46cd8d80b74f81e1a2b3c3e8331ef` |
| Audit | `172ca1bf03ae27ea24cdb0287be9f4b03a5f4196` |
| Merge / new main | `c253d4c17e77f3353650a2bd6eee760516e6e95d` |
| Mark | `ROLE_MODEL_AUDIT_EVIDENCE_MERGED` |

## What shipped (engineering capability)

1. **Migration** `migrations/20260922120000_worker_courier_role_model_account_domain.sql`  
   - `_ensure_worker_advance_subaccount` → `WA-*` under 1180  
   - WP ensure: worker role gate + wrong-company raise  
   - Courier ensure: `linked_contact_id` + `contact_id` parity  
   - `_resolve_worker_payment_debit_account` helper  
   - `get_contact_party_gl_balances` WA **subtree**

2. **TS account domain** — `ensureWorkerAdvanceSubaccountForContact`, resolvers, worker advance service leaf posting, party role routing (no name heuristics).

3. **JE assist** — courier role hint + party list; worker multi-leaf requires pick / `workerIntent`.

4. **Reporting** — Customers & Suppliers excludes worker/courier rows.

5. **Mobile** — studio finalize ensures WP via RPC; worker GL includes `WA-*`/`WP-*`.

6. **Docs / evidence** — cutover runbook (non-executed), matrix AFTER, postgres script.

## Explicitly NOT done

| Guard | Status |
|-------|--------|
| Production contact type flips | NONE |
| Production 203x / WA / WP for DHL/KIRAN/SHAHMIM | NONE |
| Historical AP line moves | NONE |
| Strategy B | NOT executed |
| Dual-account cleanup reopen | NO |
| Production migration apply | NO |
| Production deploy | NO |
| Graphify stash | NOT touched |
| Ibrahim / ID LACE repairs | NOT touched |

## Client tests (this session)

| Suite | Result |
|-------|--------|
| `journalPartyPosting.node.test.ts` | PASS (5) |
| `partyRoleAccountRouting.node.test.ts` | PASS (4) |
| Vitest-only files (`preferCanonical…`, etc.) | `PRE_EXISTING_OUT_OF_SCOPE` (missing vitest package under `tsx --test`) |
| Isolated Postgres | NOT_EXECUTED (Docker daemon unavailable) |

## Engineering verdict

**`PROSPECTIVE_ROLE_MODEL_ENGINEERING_READY`**

Meaning: schema/functions/client paths/tests are ready for a **separate** staging apply + owner cutover decision.  
Does **not** mean production contacts may be flipped automatically.

## Remaining blockers before production cutover

1. Owner T0 + type flips for DHL local / KIRAN / SHAHMIM.  
2. Staging migration apply + `postgres_regression.sql` PASS.  
3. Optional: wire `_resolve_worker_payment_debit_account` into `record_payment_with_accounting` (TS paths already leaf-aware).  
4. Docker unavailable on implementer host — isolated PG not executed this session.
