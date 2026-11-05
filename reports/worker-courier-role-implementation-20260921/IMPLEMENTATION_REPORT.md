# Implementation report — worker/courier prospective role model

**Date:** 2026-09-21 (implementation) / **2026-09-22 (security + Postgres gate)**  
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
| Provisional impl HEAD | `7f07317037b3b42ade4e4c8d303a536ac8fab20f` |

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

## Security harden (2026-09-22) — closes provisional READY

Prior verdict `PROSPECTIVE_ROLE_MODEL_ENGINEERING_READY` was **provisional** and must be read as  
`PROVISIONAL_NOT_READY_FOR_STAGING_CUTOVER` until this gate.

Added:

- `_party_role_account_assert_company_access` / effective-role helpers  
- Self-authorize on all DEFINER entrypoints before mutation  
- Explicit `REVOKE PUBLIC/anon` + intended `GRANT` after every `CREATE OR REPLACE`  
- Fail-loud wrong-role (no silent 1180/2010 fallback for leaf ensure)  
- Null-contact courier rejected for clients  
- Isolated Docker PG15 regression + feature-branch GHA workflow  

Evidence: `reports/worker-courier-role-implementation-20260922/SECURITY_AND_POSTGRES_GATE.md`

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

## Client tests

| Suite | Result |
|-------|--------|
| `journalPartyPosting.node.test.ts` | PASS (5) via `tsx --test` |
| `partyRoleAccountRouting.node.test.ts` | PASS (4) via `tsx --test` |
| Combined | **9/9 PASS** |

## PostgreSQL gate

| Item | Result |
|------|--------|
| Isolated Docker postgres:15 | **EXECUTED** |
| Marker | **`ROLE_MODEL_POSTGRES_REGRESSION_PASS`** |
| Evidence | `…/20260922/verification/EVIDENCE.md` |
| CI workflow | `.github/workflows/worker-courier-role-model-regression.yml` |

## Engineering verdict

See security gate doc + return block after commit:

- Staging-ready only if: company auth proven, ACL safe, cross-company fail, real PG PASS, client PASS, no production mutation.
