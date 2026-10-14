# Merge readiness — payment RPC security + final audit

**Date:** 2026-09-22  
**Branch:** `feat/worker-courier-role-model-implementation`  
**Feature HEAD (start):** `ce5cd918f636de88cce7923df793d3c9930c989e`  
**Main:** `c253d4c17e77f3353650a2bd6eee760516e6e95d` (ahead 3 → +security commit)  
**Graphify stash (by message):** `On main: graphify root` — not popped/dropped/committed

## Diff audit (`main...ce5cd918` + follow-up)

| Group | Paths |
|-------|-------|
| Account-domain migration | `20260922120000_…` |
| Payment RPC migrations | `20260922130000_…`, `20260922140000_…` |
| Web role routing | `partyRoleAccountRouting.ts`, `journalPartyPosting.ts`, `AddEntryV2.tsx` |
| Worker accounting | `partySubledgerAccountService.ts`, `workerAdvanceService.ts` |
| Reporting | `customersSuppliersReportService.ts`, docs |
| Mobile | `studioFinalizeAfterInvoice.ts`, `workerPartyGlLedger.ts` |
| Tests / evidence | reports `20260921`/`20260922`/`staging-rehearsal` |

Checks:

- No committed JWT/password secrets (staging secrets stay on VPS `/root/role-model-stage/`)
- No Graphify files in feature diff
- No production contact flips / leaf creates in migrations
- Staging ports/hosts only in evidence scripts
- Business UUIDs only in reports/scripts, not runtime product code

## Payment RPC security (mandatory)

`record_payment_with_accounting` is `SECURITY DEFINER`. Prior leaf migration did **not** gate `p_company_id`.

### Fix (`20260922140000_record_payment_company_auth_and_acl.sql`)

1. Entry: `PERFORM _party_role_account_assert_company_access(p_company_id)` before mutations  
2. Re-raise `insufficient_privilege` (do not swallow into JSON)  
3. `p_payment_account_id` must belong to `p_company_id`  
4. worker/courier `p_reference_id` contact must belong to `p_company_id`  
5. 12-arg overload: company-gated wrapper → 13-arg  
6. Deterministic ACL both overloads: PUBLIC/anon **deny**; authenticated + service_role **grant**

### Isolated PG

| Marker | Result |
|--------|--------|
| `PAYMENT_RPC_ACL_PASS` | PASS |
| Cross-company payment | `42501`, 0 Co-B mutations |
| Same-company → WA leaf | PASS |
| Anon | denied |
| service_role | PASS |
| Supplier manual_payment | PASS |
| **`ROLE_MODEL_PAYMENT_RPC_SECURITY_PASS`** | **PASS** |

### Staging JWT (post-change)

| Marker | Result |
|--------|--------|
| Same-company KIRAN → `WA-SUPZHD0036` | PASS |
| Cross-company | HTTP 403, no mutation |
| Anon | 401 |
| Ordinary supplier | PASS |
| Prod types still supplier / assert absent on live | PASS |
| **`STAGING_PAYMENT_JWT_SECURITY_PASS`** | **PASS** |

## GHA

**`GITHUB_ACTIONS_UNVERIFIED`** — token scopes still `gist,read:org,repo` (no `workflow`).

## Product cutover

Still **not** executed: no production type flips, no production role leaves, no historical AP moves, no Strategy B, dual-account cleanup remains closed.
