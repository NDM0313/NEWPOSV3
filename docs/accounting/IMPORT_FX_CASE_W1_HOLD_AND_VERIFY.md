# Import FX Case — W1 hold and Wave 0 verify

**Date:** 2026-08-12  
**Scope:** Wave W1 only (case/stage persistence + draft UI + create-case idempotency + historical read when disabled + read/mutation security hardening).  
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
13. `20260812020000_import_fx_case_read_security_hardening_w1.sql` (**fail-closed company + branch auth for reads**)
14. `20260812030000_import_fx_case_mutation_security_parity_w1.sql` (**fail-closed company + branch auth for mutations**)
15. `20260812040000_import_fx_case_attachment_security_w1.sql` (**attachment table privilege revoke + parent-case RLS**)
16. `20260812050000_import_fx_case_table_privilege_lockdown_w1.sql` (**RPC-only lockdown for cases/stages/events/links + helper REVOKE + link target branch check**)

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

## Mutation security parity (PASS)

Migration: `20260812030000_import_fx_case_mutation_security_parity_w1.sql`

| RPC | Company fail-closed | Case company match | Branch auth | MC OFF blocked | Journals |
|-----|---------------------|--------------------|-------------|----------------|----------|
| `create_import_fx_case` | Yes (`_import_fx_case_assert_company_access`) | N/A (creates) | `assert_branch_param`; idempotent replay also checks `branch_row_allowed` | Yes | None |
| `update_import_fx_case_draft` | Yes | Yes (`id` + `company_id`) | `branch_row_allowed` on case | Yes | None |
| `confirm_import_fx_case_stage` | Yes | Yes | `branch_row_allowed` on case | Yes | None (ARRANGEMENT only) |
| `cancel_import_fx_case_unposted` | Yes | Yes | `branch_row_allowed` on case | Yes | None |
| `link_import_fx_case_target` | Yes | Yes | `branch_row_allowed` on case | Yes | None |
| Attachment mutations | **No W1 RPC** — direct table privileges **revoked** from authenticated; see attachment matrix | — | — | — | — |

NULL-branch **create**: allowed for company members (same as commission/payments INSERT: `branch_id IS NULL OR has_branch_access`). Privileges: revoke `PUBLIC`/`anon`; grant `authenticated` only. Helpers remain non-executable by clients.

QA: `node scripts/qa/import-fx-w1-mutation-security-qa.mjs` — **22/22 PASS** (0 skipped).

---

## Attachment authorization matrix (PASS)

Migration: `20260812040000_import_fx_case_attachment_security_w1.sql`

### Pre-fix findings (localhost)

| Item | Finding |
|------|---------|
| Grants to authenticated | SELECT, INSERT, UPDATE, DELETE |
| Grants to PUBLIC / anon / service_role | None |
| RLS | Enabled; single `FOR ALL` policy `company_id = get_user_company_id()` only |
| Branch via parent case | **Missing** — restricted user could read/write attachment rows for other-branch cases in same company |
| `storage_path` via direct SELECT | **Exposed** |
| Storage bucket policies | **N/A on localhost** (`storage.objects` absent); production bucket policies not part of this W1 table fix |

### Post-fix contract

| Access path | SELECT metadata | `storage_path` | INSERT/UPDATE/DELETE |
|-------------|-----------------|----------------|---------------------|
| Direct table (`authenticated`) | **Denied** (privileges revoked) | Denied | **Denied** (privileges revoked) |
| `get_import_fx_case` | Allowed after company + parent-case branch auth | **Omitted** from JSON | N/A |
| Multi Currency OFF | Historical get still returns attachment metadata (read-only) | Omitted | Denied (no table privilege; RLS also requires MC ON if privileges restored) |
| Cross-company / cross-branch | Denied via get / RLS parent-case helpers | — | Denied |
| `anon` / PUBLIC | No table privilege | — | No table privilege |

Defense-in-depth RLS (if privileges are ever re-granted): SELECT uses `_import_fx_case_attachment_parent_access_ok`; writes use `_import_fx_case_attachment_mutation_ok` (parent access + `multiCurrencyEnabled`); UPDATE WITH CHECK blocks moving `case_id` onto an unauthorized case.

QA: `node scripts/qa/import-fx-w1-attachment-security-qa.mjs` — **18/18 required PASS** (0 skipped; plus defense-in-depth OFF RLS check).

---

## Case shell table lockdown (PASS)

Migration: `20260812050000_import_fx_case_table_privilege_lockdown_w1.sql`

Closes [Bugbot](5a096de3-4016-4bf1-8a53-e7a33ee7831a) finding: direct `authenticated` CRUD on `import_fx_cases` / stages / events / links could bypass SECURITY DEFINER company/branch/MC gates.

| Control | Behavior |
|---------|----------|
| Table privileges | REVOKE ALL from PUBLIC/anon/authenticated on cases, stages, events, links |
| Internal helpers | REVOKE EXECUTE on `_import_fx_case_seed_stages`, `_import_fx_case_derive_operational_status` from PUBLIC/anon/authenticated |
| Defense-in-depth RLS | Branch via parent case; writes also require Multi Currency ON |
| `link_import_fx_case_target` | Verifies PURCHASE / FX_CURRENCY_PURCHASE company + branch visibility; contacts company-scoped |

Client path remains `importFxCaseService` RPCs only.

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

### `import-fx-w1-mutation-security-qa.mjs` — **22/22 PASS** (0 skipped)

| # | Scenario | Result |
|---|----------|--------|
| 1–3 | Authorized create + idempotent retry / no duplicates | PASS |
| 4–8 | Company/auth/anon create rejects | PASS |
| 9–11 | Branch create (authorized / unauthorized / NULL per policy) | PASS |
| 12–13 | MC OFF reject / ON create | PASS |
| 14–18 | Cross-company + unauthorized branch mutations | PASS |
| 19 | Invalid stage (ADVANCE) rejected | PASS |
| 20–22 | JE / lines / payments Δ = 0 | PASS |

### `import-fx-w1-read-security-qa.mjs` — **21/21 PASS** (0 skipped; suite also logs off-slice)

### `import-fx-w1-live-rpc-qa.mjs` — **29/29 PASS**

Including OFF reject mutations, ON create/idempotency, draft/confirm/link/cancel, OFF historical list/get, cross-company blocked, zero-journal proof.

### `import-fx-w1-attachment-security-qa.mjs` — **18/18 PASS** (0 skipped)

### Zero-journal proof (mutation + read + attachment security suites)

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

## Successor — W2 ARRANGEMENT enrichment

W2 (non-posting ARRANGEMENT enrichment only) is documented in [`IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`](./IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md).  
W2 does **not** confirm ADVANCE/USD or post money. Money execution remains **W3+**.

## HOLD — W3–W6 / Phase 3

Do **not** implement without separate approval: advances / USD acquisition **money** confirm+posting, China transfer, conversion/pool, multi-supplier allocations, mobile case UX completion, FX P&L accounts `1395`/`2295`/`6100`/`7100`.

---

## Remaining blockers / risks

1. Full-repo `npm run migrate` against empty DB still unsuitable (bootstrap marks 02–18 without applying). Local Import FX QA uses the dedicated localhost runner above.
2. Path 21 full JE posting needs broader ERP helpers than the W1 harness provides.
3. Live web UI against local requires a non-prod Supabase API stack (not started this pass).
4. Attachment add/remove has no W1 SECURITY DEFINER RPC — direct table privileges revoked; future waves need a signed-file / controlled attach RPC before re-granting client table access.
5. Production Supabase Storage bucket policies for Import FX paths were not verified in this localhost gate (`storage.objects` absent locally).
6. Live browser UI vs non-production API has not been completed (app env still points at production HTTP API).

---

## Owner acceptance — localhost W1 merge-readiness only (2026-08-12)

**Recorded:** 2026-08-12 (office).  
**Gate accepted:** isolated Docker DB `localhost:5432/postgres` · container `newposv3-local-pg` — **PR merge-readiness only**.

### Confirmed evidence (this acceptance)

| Check | Result |
|-------|--------|
| W1 security / regression suites | **122/122 PASS** (documented in this file) |
| Production build | **PASS** |
| JE / journal_entry_lines / payments Δ | **0 / 0 / 0** |
| Evidence tip commit | `770af42eb60a6f39fc9cb9fd2a86fa1fc95f369c` (`fix: RPC-only lockdown for Import FX case shell tables`) |
| Rebased equivalent on current history | `ba26db6b` (same message; after rebase onto `main`) |

No destructive or unnecessary migrations were re-run for this acceptance record. Production was not accessed for this gate letter.

### Explicitly **not** authorized by this acceptance

- Production database access  
- Production migration or deployment  
- Use of `supabase.dincouture.pk` for this gate  
- Multi Currency enablement in production  
- Treating localhost as production-equivalent  
- W2–W6 implementation  
- Phase-3 accounting  
- Money-journal changes  

### Production-deployment blockers (still required)

1. Proper non-production Supabase / VPS staging environment  
2. Live UI smoke against non-production HTTP API  
3. Production Storage bucket policy verification (or N/A with evidence)  
4. Explicit production migration / deployment approval  

### Merge-readiness verdict

**READY for PR merge (code only)** — localhost gate owner-accepted.  
This verdict does **not** authorize production migrate/deploy. Merge must remain a human action; do not treat merge as production release.
