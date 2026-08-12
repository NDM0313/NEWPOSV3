# Import FX Case — W2 Arrangement enrichment

**Branch:** `feat/import-fx-w2-arrangement-enrichment`  
**Status:** **BLOCKED — LOCALHOST DATABASE NOT CONFIRMED** (implementation complete; live apply/QA not run)  
**Gates:** `multiCurrencyEnabled` ops · `fxSettlementAccountingEnabled = false` (Profile A)  
**Accounting:** **No journals / payments / wallets / AP** — every mutation returns `posts_journal: false`

Canonical companions: [`IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md`](./IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md) · [`IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md`](./IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md)

---

## 1. Business purpose

Deepen the Import FX Case **ARRANGEMENT** stage so operators can capture multi-day planning intent (agent, third party, funding intention, expected amounts/rates/dates, planning links, attachment **metadata**) without posting any money.

---

## 2. Approved scope (W2a–W2e)

- Searchable money-exchange agent selector  
- Searchable third-party selector (other `money_exchange` contacts ≠ agent)  
- `funding_mode`: `ADVANCE` | `CREDIT` | `MIXED` (intention only)  
- Planned source + settlement currencies (RMB→CNY)  
- Expected USD/CNY amounts, indicative rates, expected dates, planned advance PKR amount  
- Agent/quote reference + notes  
- Planning links (purchase/supplier) — context only  
- Attachment **metadata only**  
- Draft/save/resume + idempotent ARRANGEMENT confirm  
- Company/branch auth + Multi Currency OFF historical read-only  

---

## 3. Explicit exclusions

- Confirm/complete `ADVANCE`, `USD_ACQUISITION`, China transfer, conversion, pool, allocation, reconciliation  
- Journals, payments, Agent/Supplier AP, wallets, FX lots, conversions, settlements, FX P&L, Phase-3, COA  
- Path 21 redesign; Docker/VPS/production migrate  
- Downstream stage rows are **not** set to `PLANNED` / `AWAITING_ACTION` / `COMPLETED` from W2 expectations  

---

## 4. W1 baseline

Shipped on `main` (`a8799ab9`): case shell, 8 stages, ARRANGEMENT-only confirm, fail-closed security, RPC-only tables.

---

## 5–6. W2 database changes / columns

| Migration | Purpose |
|-----------|---------|
| `migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql` | Columns + create/update/confirm/list/get/link |
| `migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql` | Metadata RPC |

| Column | Type | Meaning |
|--------|------|---------|
| `funding_mode` | text NULL CHECK ADVANCE/CREDIT/MIXED | Funding **intention** |
| `planned_settlement_currency` | text NULL | Expected settlement currency |
| `agent_reference` | text NULL | External quote/ref |
| `expected_arrangement_date` | date NULL | Expected agreement date |
| `expected_advance_date` | date NULL | Expected advance date (**not paid**) |
| `expected_usd_acquisition_date` | date NULL | Expected USD date (**not purchased**) |
| `expected_advance_amount_pkr` | numeric(24,2) NULL | Planned advance PKR (**not paid**) |
| `arrangement_confirmed_at` | timestamptz NULL | Set when ARRANGEMENT COMPLETED |
| `import_fx_case_attachments.is_metadata_only` | boolean NOT NULL DEFAULT false | True for W2 metadata rows |

---

## 7. RPC/API contracts

| RPC | Notes |
|-----|-------|
| `create_import_fx_case` | Extended with W2 planning args; idempotent `client_operation_id` |
| `update_import_fx_case_draft` | Enrichment fields; `arrangement_type` only while DRAFT + ARRANGEMENT unconfirmed |
| `confirm_import_fx_case_stage` | **ARRANGEMENT only**; else `IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY` |
| `list_import_fx_cases` / `get_import_fx_case` | Project W2 columns; omit `storage_path` / `client_operation_id` |
| `cancel_import_fx_case_unposted` | Unchanged semantics (W1) |
| `link_import_fx_case_target` | Planning only; agent cannot be linked as supplier |
| `register_import_fx_case_attachment_metadata` | Metadata only; `file_uploaded: false`; no path exposure |

All mutations: `posts_journal: false`.

**Error code:** W2 raises `IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY` (supersedes W1 `…_W1_PLANNING_ONLY` for new clients; UI maps both).

---

## 8. UI workflow

[`ImportFxCaseWorkspace.tsx`](../../src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx) — ARRANGEMENT enrichment form; money stages show “Available in W3+ — no financial posting in W2”. Planning links + attachment metadata registration. Path 21 Agent FX remains separate.

---

## 9. ARRANGEMENT state transitions

ARRANGEMENT: `PLANNED` → `AWAITING_CONFIRMATION` (optional) → `COMPLETED` → case `ARRANGED` + `arrangement_confirmed_at`.  
Other stages: unchanged by W2 (remain seeded statuses).

---

## 10. Idempotency

Create: `(company_id, client_operation_id)`.  
Confirm: event unique `(company_id, event_type, client_operation_id)`; UI retains confirm op UUID on retry.  
Attachment metadata: same pattern on `ATTACHMENT_METADATA_REGISTERED`.

---

## 11–12. Authorization / Multi Currency

W1 fail-closed helpers preserved. Agent + third party must be company `money_exchange` and distinct. OFF: list/get RO; mutations `MULTI_CURRENCY_DISABLED`.

---

## 13. Attachment-metadata limitations

Metadata RPC only. `storage_path` never returned. Opaque `metadata-only://w2/...` placeholder. No Storage upload/bucket/signed URL.

---

## 14. Audit events

`CASE_CREATED`, `DRAFT_SAVED`, `STAGE_CONFIRM_ARRANGEMENT`, `ATTACHMENT_METADATA_REGISTERED`, `CASE_CANCELLED` — always `posts_journal=false`.

---

## 15. Expected journal entries

**None.** W2 RPCs must not insert into `journal_entries`, `journal_entry_lines`, `payments`, `wallet_movements`, or supplier settlement/allocation tables.

Live financial before/after counts were **not measured** on 2026-08-12 because localhost Postgres was not confirmed. Expected when live QA runs: **0 / 0 / 0 / 0 / 0**.

---

## 16. Migration order

Path 21 → Wave A → Wave 0 → W1 → **W2 enrichment → W2 attachment metadata**.

Apply W2 only with: `node scripts/qa/apply-import-fx-w2-local.mjs` (`.env.db.local`, host `localhost`/`127.0.0.1`, port `5432`, database `postgres`). Does **not** load harness SQL or `.env.local`.

---

## 17. Test and QA evidence

Recorded 2026-08-12 on branch `feat/import-fx-w2-arrangement-enrichment` at implementation `bf7973c4` / docs stamp `1bce4f2e`.

### 17.1 Safety preflight (live apply blocked)

| Check | Result |
|-------|--------|
| Branch | `feat/import-fx-w2-arrangement-enrichment` (tracks origin) |
| HEAD at preflight | `1bce4f2e8f3a1c8c60c7bc2eeb1cceae01a4f9bb` |
| Worktree | Unrelated dirty Graphify/mobile AST cache **not staged** |
| `.env.db.local` | **MISSING** (required by localhost QA runner) |
| `.env.local` | `VITE_SUPABASE_URL` host = `supabase.dincouture.pk` — **rejected** |
| `.env.qa.local` | Browser QA passwords for production companies — **rejected** |
| Port `5432` | **Not listening** |
| Docker / `newposv3-local-pg` | Docker **not installed**; container **not proven** |
| W1 `schema_migrations` | **Not readable** (no localhost session) |
| Before-counts JE / lines / payments / wallets / settlements | **Not readable** |

**Verdict:** `BLOCKED — LOCALHOST DATABASE NOT CONFIRMED`

No fallback to production, VPS, `supabase.dincouture.pk`, or a new Docker/Supabase stack.

### 17.2 Migration review (static; before apply)

Reviewed `migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql` and `migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql`.

| Review item | Result |
|-------------|--------|
| Additive columns / CHECK only | PASS |
| No `DROP TABLE` / destructive money-table `ALTER` | PASS |
| No journal/payment/wallet inserts | PASS |
| No W3+ money tables or FX P&L accounts | PASS |
| `SECURITY DEFINER` + `SET search_path TO 'public'` | PASS |
| Fail-closed `_import_fx_case_assert_company_access` | PASS |
| Branch row helpers on mutations | PASS |
| Helpers revoked from `PUBLIC`/`anon`/`authenticated`; RPCs `authenticated` only | PASS |
| RMB → CNY via `_normalize_import_fx_currency` | PASS |
| Negative planning amounts/rates rejected | PASS |
| Metadata RPC omits `storage_path`; `file_uploaded: false` | PASS |
| Direct `import_fx_case_attachments` privileges remain revoked | PASS |
| Non-ARRANGEMENT confirm → `IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY` | PASS |
| Confirm does not bump ADVANCE/USD stage rows | PASS |
| Old create/update signatures dropped (no leftover overload bypass) | PASS |
| Migrations do not depend on QA harness SQL | PASS |
| `WHEN OTHERS` | Document-number fallback only (not auth fail-open) |

No security or accounting defect found that required stopping a migrate. **Apply itself was not executed.**

### 17.3 Applied migration results

| Migration | Applied on localhost? | `schema_migrations` |
|-----------|----------------------|---------------------|
| `20260812140000_import_fx_case_arrangement_enrichment_w2.sql` | **NOT APPLIED** | not recorded |
| `20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql` | **NOT APPLIED** | not recorded |

### 17.4 Live W2 RPC QA (33 scenarios)

Command: `node scripts/qa/import-fx-w2-live-rpc-qa.mjs`

**SKIPPED / BLOCKED** — runner aborted before any RPC. All 33 scenarios untested on a live database:

1. Create enriched ARRANGEMENT draft — SKIPPED  
2. Read all new fields — SKIPPED  
3. Update editable planning fields — SKIPPED  
4. Funding mode ADVANCE (intention only) — SKIPPED  
5. Funding mode CREDIT — SKIPPED  
6. Funding mode MIXED — SKIPPED  
7. Invalid funding mode rejected — SKIPPED  
8. RMB normalized to CNY — SKIPPED  
9. Negative planned amount rejected — SKIPPED  
10. Negative rate rejected — SKIPPED  
11. Unauthorized agent role rejected — SKIPPED  
12. Agent and third party cannot be the same — SKIPPED  
13. Cross-company agent rejected — SKIPPED  
14. Cross-branch target rejected — SKIPPED  
15. Authorized purchase/supplier planning link — SKIPPED  
16. Planning link creates no supplier settlement — SKIPPED  
17. Attachment metadata registration — SKIPPED  
18. Attachment metadata retry idempotent — SKIPPED  
19. `storage_path` absent from client response — SKIPPED  
20. Direct attachment-table access unavailable — SKIPPED  
21. ARRANGEMENT confirmation — SKIPPED  
22. Same confirmation operation ID replay — SKIPPED  
23. Confirmation event not duplicated — SKIPPED  
24. Confirmed ARRANGEMENT type lock — SKIPPED  
25. ADVANCE confirmation rejected — SKIPPED  
26. USD_ACQUISITION confirmation rejected — SKIPPED  
27. Every later money stage rejected — SKIPPED  
28. Multi Currency OFF list/get readable — SKIPPED  
29. Multi Currency OFF mutations rejected — SKIPPED  
30. Cross-company case access rejected — SKIPPED  
31. Unauthorized branch access rejected — SKIPPED  
32. Path 21 behavior unchanged — SKIPPED  
33. Every W2 mutation `posts_journal: false` — SKIPPED  

Live counts: **PASS=0 FAIL=0 SKIPPED=33**

This is **database/RPC verification only**. No live UI PASS is claimed. Production HTTP API was not used.

### 17.5 Financial-table before/after

| Table | Before | After | Delta |
|-------|-------:|------:|------:|
| `journal_entries` | n/a | n/a | **not measured** |
| `journal_entry_lines` | n/a | n/a | **not measured** |
| `payments` | n/a | n/a | **not measured** |
| `wallet_movements` (if present) | n/a | n/a | **not measured** |
| supplier settlement/allocation (if present) | n/a | n/a | **not measured** |

Expected delta: `0 / 0 / 0 / 0 / 0`. Actual delta: **not measured** (blocked).

### 17.6 Regression / build (no database)

| Command | Result |
|---------|--------|
| `node scripts/qa/apply-import-fx-w2-local.mjs` | **BLOCKED** exit 2 — `BLOCKED — LOCALHOST DATABASE NOT CONFIRMED` (missing `.env.db.local`) |
| `node scripts/qa/import-fx-w2-live-rpc-qa.mjs` | **BLOCKED** exit 2 — same |
| `node scripts/qa/import-fx-w2-static-qa.mjs` | **PASS=15 FAIL=0 SKIPPED=2** |
| `npx tsx --test src/app/lib/importFxCaseHelpers.test.ts src/app/lib/importFxWave0Correctness.test.ts src/app/lib/importFxWizardHelpers.test.ts src/app/lib/importFxServerGate.test.ts src/app/lib/importFxPath21Hotfix.test.ts src/app/lib/importFxCreditVoidHelpers.test.ts` | **PASS=33 FAIL=0 SKIPPED=0** |
| W1 `import-fx-w1-live-rpc-qa.mjs` / read / mutation / attachment security | **SKIPPED** (localhost DB not confirmed) |
| `npm run build` | **PASS** (exit 0) |

W1 live/mutation suites now accept `IMPORT_FX_CASE_STAGE_W2_ARRANGEMENT_ONLY` **or** the legacy `W1_PLANNING_ONLY` code (contract update after W2 confirm rewrite; security still requires a money-stage block).

### 17.7 Defects found and fixes

| Defect | Fix |
|--------|-----|
| Localhost identity unproven | **No migrate.** Stopped with `BLOCKED — LOCALHOST DATABASE NOT CONFIRMED`. |
| W1 live/mutation QA still asserted only `W1_PLANNING_ONLY` | Accept `W2_ARRANGEMENT_ONLY` as well (would false-fail after W2 apply). |

No W2 SQL contract correction migration was required (nothing was applied).

---

## 18. Files changed

- `migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql`
- `migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql`
- `src/app/lib/importFxCaseHelpers.ts` (+ test)
- `src/app/lib/importFxGateCodes.ts`
- `src/app/services/importFxCaseService.ts`
- `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx`
- `scripts/qa/import-fx-w2-static-qa.mjs`
- `scripts/qa/apply-import-fx-w2-local.mjs`
- `scripts/qa/import-fx-w2-live-rpc-qa.mjs`
- `scripts/qa/import-fx-w1-live-rpc-qa.mjs` (accept W2 block code)
- `scripts/qa/import-fx-w1-mutation-security-qa.mjs` (accept W2 block code)
- `docs/accounting/IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`
- `docs/accounting/IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md` (successor pointer)
- `docs/accounting/IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md` (W2/W3 rename note)
- `docs/accounting/PAYMENT_ENTRY_PATHS.md`
- `docs/accounting/ACCOUNTING_REPORTS_INDEX.md`
- `.cursor/rules/multi-currency-import-fx.mdc`

---

## 19. Known limitations / remaining UI and production prerequisites

- Restore `.env.db.local` and start existing `newposv3-local-pg` on `localhost:5432/postgres`, then re-run apply + live RPC + W1 security suites. Do **not** recreate the removed local-Supabase staging experiment.
- Attachment binary upload / signed URLs deferred.
- Third-party role model uses `money_exchange` only (no separate converter type in contacts).
- Live UI smoke is **not** claimed. Do not use the production HTTP API for UI QA.
- Production / VPS migrate, merge to `main`, W3–W6, COA changes, and financial posting remain unauthorized.

---

## 20. W2→W3 handoff

W2 exit: ARRANGEMENT COMPLETED, `accounting_status=NOT_POSTED`, money stages not COMPLETED, zero money postings from case RPCs.  
W3 (separate approval): financial ADVANCE / USD acquisition confirm + posting. Path 21 remains until an approved migration story.

---

## 21. Final verification verdict

**BLOCKED — LOCALHOST DATABASE NOT CONFIRMED**

Implementation + static/unit/build may still PASS on this machine. Live DB apply, 33 RPC scenarios, W1 security harnesses, and financial delta `0/0/0/0/0` are **not** proven.

Production, VPS, `supabase.dincouture.pk`, W3–W6, Chart of Accounts, and real financial records were **untouched**.

---

## 22. Commit hash and branch

| Item | Value |
|------|-------|
| Branch | `feat/import-fx-w2-arrangement-enrichment` |
| Implementation commit | `bf7973c4fa8459cb84f494daeccab04f55224fc0` |
| Docs hash stamp (pre-live-QA) | `1bce4f2e8f3a1c8c60c7bc2eeb1cceae01a4f9bb` |
| Live QA evidence commit | *(this commit)* |
| Compare | https://github.com/NDM0313/NEWPOSV3/compare/main...feat/import-fx-w2-arrangement-enrichment |

---

## Implementation evidence table

| W2 item | Planned | Implemented | Tested | Notes |
|---------|--------:|------------:|-------:|-------|
| W2a schema/RPC | yes | yes | static + unit | Live DB **BLOCKED** (no localhost) |
| W2b UI | yes | yes | static | No live UI PASS claimed |
| W2c links UI | yes | yes | static | No live UI PASS claimed |
| W2d attach meta | yes | yes | static | metadata only; live RPC SKIPPED |
| W2e tests/docs | yes | yes | unit/static/build | Live RPC/security **BLOCKED** |
| W2 localhost apply | yes | runner added | **BLOCKED** | `.env.db.local` missing; `:5432` down |
| W2 live 33 RPC scenarios | yes | runner added | **SKIPPED 33/33** | identity not confirmed |
| Financial delta 0/0/0/0/0 | yes | n/a | **not measured** | would be FAIL if non-zero after apply |
