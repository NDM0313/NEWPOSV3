# Import FX Case — W1 hold and Wave 0 verify

**Date:** 2026-08-12  
**Scope:** Wave W1 only (case/stage persistence + draft UI + create-case idempotency + historical read when disabled + read security hardening).  
**Gates:** `multiCurrencyEnabled` ops · `fxSettlementAccountingEnabled = false` (Profile A).

---

## Confirmed non-production environment (2026-08-12)

| Item | Value |
|------|--------|
| Host | `localhost` |
| Port | `5432` |
| Database | `postgres` |
| Container | `newposv3-local-pg` (`postgres:16-alpine`) |
| Credentials source | `.env.db.local` only |
| Production | **Not used** (`supabase.dincouture.pk` refused) |

Apply runner: `node scripts/qa/apply-import-fx-w1-local.mjs` (localhost abort guard; does **not** load `.env.local`).

Harness: `scripts/qa/import-fx-w1-local-harness.sql` + `scripts/qa/import-fx-w1-security-harness.sql` (auth/branch stubs for SECURITY DEFINER QA).

---

## Exact migrations applied (local)

1. `import-fx-w1-local-harness.sql`
2. `20260801190000_fx_currency_purchase_schema.sql`
3. `20260801190100_fx_currency_purchase_rpcs.sql`
4. `20260811160000_import_fx_wave_a_server_off_checks.sql`
5. `20260811160100_import_fx_wave_a_purchase_payment_fx_guards.sql`
6. `20260811170000_import_fx_path21_agent_role_guards.sql`
7. `20260811171000_import_fx_tt_wallet_include_party_tt.sql`
8. `20260811200000_import_fx_wave0_path21_idempotency_settlement_lifecycle.sql`
9. `20260811230000_import_fx_case_stage_persistence_w1.sql`
10. `20260812010000_import_fx_case_create_idempotency_w1.sql` (**create-case idempotency**)
11. `20260812013000_import_fx_case_history_read_when_disabled_w1.sql` (**historical list/get when Multi Currency OFF**)
12. `import-fx-w1-security-harness.sql` (localhost QA stubs only)
13. `20260812020000_import_fx_case_read_security_hardening_w1.sql` (**fail-closed company + branch auth**)

---

## Historical readability contract (PASS)

When `multiCurrencyEnabled = false`:

| Action | Expected |
|--------|----------|
| `list_import_fx_cases` | Allowed **only after** company + branch authorization — historical rows; `read_only: true` |
| `get_import_fx_case` | Allowed **only after** company + case-branch authorization — stages/events/links/attachments; `read_only: true` |
| Create / draft / confirm / link / cancel | Rejected (`MULTI_CURRENCY_DISABLED`) |
| Journals / payments from reads | **None** |

OFF-mode historical reads are **not** a security bypass: Multi Currency OFF never relaxes tenant or branch isolation.

UI: Purchases shows **Import FX Cases — Read Only** when history exists; workspace banner + mutation buttons hidden.

Verified on localhost (2026-08-12): **PASS**.

---

## Read security hardening (PASS)

Migration: `20260812020000_import_fx_case_read_security_hardening_w1.sql`

| Control | Behavior |
|---------|----------|
| Company assert | Fail-closed: `get_user_company_id()` errors propagate; NULL session company → `IMPORT_FX_CASE_AUTH_COMPANY_REQUIRED`; mismatch → `IMPORT_FX_CASE_COMPANY_MISMATCH`. No `WHEN OTHERS` allow. |
| Branch assert | Reuses `get_user_role()` company-wide roles (unified ledger set) + `has_branch_access()`. Explicit unauthorized `p_branch_id` → `IMPORT_FX_CASE_BRANCH_ACCESS_DENIED`. `p_branch_id=NULL` does not expand restricted users. NULL-branch cases follow commission/payments RLS convention (visible). |
| Privileges | Helpers revoked from `PUBLIC`/`anon`/`authenticated`. `list`/`get` revoke `PUBLIC`/`anon`; grant `authenticated` only. |
| Response projection | Omits `client_operation_id` and attachment `storage_path`. |

QA: `node scripts/qa/import-fx-w1-read-security-qa.mjs` — **21/21 required scenarios PASS** (plus off-slice zero-journal).

---

## Create-case idempotency contract

- Column: `import_fx_cases.client_operation_id` (nullable)
- Partial UNIQUE `(company_id, client_operation_id) WHERE client_operation_id IS NOT NULL`
- RPC `create_import_fx_case(..., p_client_operation_id uuid DEFAULT NULL)`
- Same company + same key → returns existing case (`idempotent_replay: true`); no second stages/events seed
- Concurrent unique_violation → lookup existing
- Session `get_user_company_id()` mismatch → `IMPORT_FX_CASE_COMPANY_MISMATCH`
- UI: one UUID per Create intent; retain on failure; clear on success

---

## Live RPC / RLS results

### `import-fx-w1-live-rpc-qa.mjs` — **29/29 PASS**

Including OFF reject mutations, ON create/idempotency, draft/confirm/link/cancel, OFF historical list/get, cross-company blocked, zero-journal proof.

### `import-fx-w1-read-security-qa.mjs` — **21/21 PASS**

| # | Scenario | Result |
|---|----------|--------|
| 1 | Authorized company list | PASS |
| 2 | Authorized company get | PASS |
| 3 | Different company ID rejected | PASS |
| 4 | Auth company NULL rejected | PASS |
| 5 | Auth company resolution error rejected | PASS |
| 6 | Anon cannot execute list | PASS |
| 7 | Authenticated without company rejected | PASS |
| 8 | Unauthorized branch request rejected | PASS |
| 9 | `p_branch_id=NULL` does not expand restricted user | PASS |
| 10 | Get unauthorized branch rejected | PASS |
| 11 | Authorized branch case succeeds | PASS |
| 12 | Null-branch case per canonical policy | PASS |
| 13 | PUBLIC/anon cannot execute list/get | PASS |
| 14 | Helper not executable by authenticated | PASS |
| 15 | OFF historical reads read-only | PASS |
| 16 | OFF mutations blocked | PASS |
| 17 | ON reads succeed | PASS |
| 18 | Cross-company blocked | PASS |
| 19 | `Δ journal_entries = 0` | PASS |
| 20 | `Δ journal_entry_lines = 0` | PASS |
| 21 | `Δ payments = 0` | PASS |

### Zero-journal proof (security suite)

```text
before: journal_entries=0 journal_entry_lines=0 payments=0
after:  journal_entries=0 journal_entry_lines=0 payments=0
Δ journal_entries = 0
Δ journal_entry_lines = 0
Δ payments = 0
```

---

## Unit tests (tsx)

`importFxCaseHelpers`, Path21 hotfixes, Wave0, Wave A server gate, wizard helpers, credit void: **28/28 PASS**.

---

## Path 21 regression (same local DB)

| Check | Result |
|-------|--------|
| RPC present | OK |
| Supplier-as-agent rejected | OK (`IMPORT_FX_AGENT_ROLE_INVALID`) |
| W1 create JE delta | **0** |
| Full Step-1 credit JE | **Blocked on harness** — missing `public._is_account_control_code` (dependency outside Import FX chain). Not a W1 change. Unit Path 21 tests still pass. |

---

## UI smoke

| Check | Result |
|-------|--------|
| Static: Multi Currency ON → Import FX Cases + Agent FX | PASS |
| Static: Multi Currency OFF + history → Import FX Cases — Read Only | PASS |
| Static: Read-only banner + Create/Save/Confirm/Cancel/New draft hidden | PASS |
| Static: create clientOperationId retain/rotate | PASS |
| Live browser vs local API | **SKIPPED** — app `.env.local` points at production Supabase HTTP API; local stack is Postgres-only. Did not retarget production. |

---

## Wave 0 verification

Repo migration `20260811200000_…` applied on local. `client_operation_id` + `import_fx_client_operations` present.

---

## HOLD — W2–W6 / Phase 3

Do **not** implement without separate approval: advances, USD acquisition money, China transfer, conversion/pool, multi-supplier allocations, mobile case UX, FX P&L accounts `1395`/`2295`/`6100`/`7100`.

---

## Remaining blockers / risks

1. Full-repo `npm run migrate` against empty DB still unsuitable (bootstrap marks 02–18 without applying). Local Import FX QA uses the dedicated localhost runner above.
2. Path 21 full JE posting needs broader ERP helpers than the W1 harness provides.
3. Live web UI against local requires a non-prod Supabase API stack (not started this pass).
4. `create_import_fx_case` still uses legacy inline company check (fail-open when session company unset); read RPCs are fail-closed. Mutation hardening can follow in a later additive pass if required.
