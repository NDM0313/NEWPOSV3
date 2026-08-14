# Import FX Case — W2 Arrangement enrichment

**Branch:** `feat/import-fx-w2-arrangement-enrichment`  
**Status:** **W2 CODE/UI COMPLETE — LOCALHOST LIVE DB QA PASS (2026-08-14)** · production migrate/deploy still deferred  
**Gates:** `multiCurrencyEnabled` ops · `fxSettlementAccountingEnabled = false` (Profile A)  
**Accounting:** **No journals / payments / wallets / AP** — every mutation returns `posts_journal: false`

Canonical companions: [`IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md`](./IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md) · [`IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md`](./IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md)

**Operator workflow + gap analysis (successor for ops confusion / Path 21 vs Cases):** [`IMPORT_FX_OPERATOR_WORKFLOW_AND_GAP_ANALYSIS.md`](./IMPORT_FX_OPERATOR_WORKFLOW_AND_GAP_ANALYSIS.md)

**W2.1 operator clarity + assignment (successor fix wave):** [`IMPORT_FX_CASE_W2_1_OPERATOR_CLARITY_AND_ASSIGNMENT.md`](./IMPORT_FX_CASE_W2_1_OPERATOR_CLARITY_AND_ASSIGNMENT.md)

---

## 1. Business purpose

Deepen the Import FX Case **ARRANGEMENT** stage so operators can capture multi-day planning intent (agent, third party, funding intention, expected amounts/rates/dates, planning links, attachment **metadata**) without posting any money.

---

## 2. Approved scope (W2a–W2e)

- Searchable money-exchange agent selector  
- Searchable third-party selector (other `money_exchange` contacts ≠ agent)  
- `funding_mode`: `ADVANCE` | `CREDIT` | `MIXED` (intention only)  
- Planned source + settlement currencies (RMB→CNY)  
- Expected USD/CNY amounts, indicative rates (online auto-pick vs company base; purchase→convert cascade; manually overridable; not financially posted), expected dates, planned advance PKR amount  
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

[`ImportFxCaseWorkspace.tsx`](../../src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx) with presentational cards in [`ImportFxCaseArrangementPanels.tsx`](../../src/app/features/import-fx-case/ImportFxCaseArrangementPanels.tsx).

### Case header

- Case number (or “New draft”)
- Arrangement status (Draft / Arranged / Cancelled)
- Accounting status: **Not Posted**
- Agent name
- Planned source → settlement currency
- Last updated
- Arrangement confirmed timestamp (or “Not yet”)
- **Read only** badge when Multi Currency is OFF
- Prominent notice: `Planning only — no payment or accounting entry has been posted.`

### Arrangement form sections

1. **Parties** — Money Exchange Agent; optional third party (other `money_exchange` only; cannot equal agent). Arrangement type (intention).
2. **Funding Intention** — Advance planned / Credit planned / Mixed planned. Intention only; not financially posted.
3. **Planned Currency** — sequential cascade (planning only):
   1. **What are you purchasing?** USD or RMB (CNY) → `planned_source_currency`
   2. Enter purchase amount → `planned_usd_amount` or `expected_cny_amount`
   3. Online indicative rates auto-fill / refresh (quoted vs `companies.currency`); manual override
   4. **Convert / settle into?** Keep purchase currency or the other (USD↔CNY) → `planned_settlement_currency`
   5. Expected settlement amount auto-fills from amount × rates (editable)
   6. **Planned advance amount (PKR)** reverse-calcs USD/CNY when edited (last-edited amount is driver; dirty fields preserved)
   - Stored columns unchanged. Helper: `importFxPlannedAmountSync`. **Not financially posted.**
   - Online rates: `open.er-api.com`; copy: `Online indicative rate — not financially posted. You can change it.`
4. **Expected Schedule** — arrangement date, advance date, USD acquisition date, expected completion date.
5. **References** — agent/quote reference, notes, purchase/supplier planning links, attachment metadata/reference (no binary upload).

Wording uses Planned / Expected / Intention / Not financially posted. The UI does not use Paid, USD purchased, Advance completed, Settled, or Financially completed.

### Actions

- **Save Draft** (create or update) — busy spinner; exclusive busy guard blocks duplicate clicks
- **Confirm Arrangement** — same busy/duplicate-click protection; idempotent client operation id
- **Cancel Unposted Case**
- **Resume / edit draft** from the case list
- After confirmation: fields lock, confirmation timestamp shown, accounting remains **Not Posted**, Save/Confirm hidden

### Disabled W3+ stages

ADVANCE, USD_ACQUISITION, China transfer, conversion, pool, allocation, and reconciliation appear as disabled timeline items with:

`Available in W3+ — no financial posting in W2`

No buttons for Pay Advance, Buy USD, Convert Currency, or Settle Supplier. Path 21 Agent FX remains a separate screen.

### Selectors

- Agent search: name, code, phone/reference; money_exchange only; loading / no-results / clear
- Third party: same list minus the selected agent
- Purchase planning search: purchase number, supplier invoice/reference, supplier name
- Keyboard navigation: existing `SearchableSelect` / Command combobox

### Responsive behavior

| Width | Layout |
|-------|--------|
| ~390px mobile | Cards stack; timeline is a horizontal chip row; action buttons wrap; dialog `max-h-[95vh]` with inner scroll; `overflow-hidden` on the page shell (no page-level horizontal scroll) |
| ~1024px tablet | Case list ~1/3, arrangement form ~2/3; timeline chips above the form |
| ~1440px desktop | List \| timeline \| form \| summary |

Browser screenshot smoke is **deferred** (no production HTTP; no local app session required for this pass).

Path 21 Agent FX remains separate.

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

Live financial before/after counts (localhost `newposv3-local-pg`, 2026-08-14): **0 / 0 / 0 / 0 / 0**.

---

## 16. Migration order

Path 21 → Wave A → Wave 0 → W1 → **W2 enrichment → W2 attachment metadata → W2.1 assignment/validation**.

Apply W2(+W2.1) with: `node scripts/qa/apply-import-fx-w2-local.mjs` (`.env.db.local`, host `localhost`/`127.0.0.1`, port `5432`, database `postgres`). Does **not** load harness SQL or `.env.local`.

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

### 17.3 Applied migration results (localhost 2026-08-14)

| Migration | Applied on localhost? | `schema_migrations` |
|-----------|----------------------|---------------------|
| `20260812140000_import_fx_case_arrangement_enrichment_w2.sql` | **YES** | recorded |
| `20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql` | **YES** | recorded |
| `20260813120000_import_fx_case_operator_assignment_and_validation_w2_1.sql` | **YES** | recorded |
| `20260812120000_import_fx_wave0_claim_before_pay.sql` | **YES** | recorded |

Target: `localhost:5432/postgres` · `newposv3-local-pg`. Production / `supabase.dincouture.pk` **not** used.

### 17.4 Live W2 RPC QA (33 scenarios + financial proof)

Command: `node scripts/qa/import-fx-w2-live-rpc-qa.mjs`

**2026-08-14:** **PASS=38 FAIL=0** (includes multi-stage “27 later stage …” rows + financial delta check). JE/lines/payments/wallet/settle Δ = **0/0/0/0/0**.

QA seed fix: branches insert placeholders corrected (`$4,$5` for company B). Scenario 24 accepts W2.1 `IMPORT_FX_CASE_ARRANGEMENT_LOCKED` (and legacy `ARRANGEMENT_TYPE_LOCKED`).

Companion static/unit (same day): `import-fx-w2-static-qa.mjs` **PASS=25 SKIPPED=2**; related unit suite **80/80 PASS**.

Live counts: **PASS=38 FAIL=0 SKIPPED=0**

This is **database/RPC verification only**. No live UI PASS is claimed. Production HTTP API was not used.

### 17.5 Financial-table before/after (localhost 2026-08-14)

| Table | Before | After | Delta |
|-------|-------:|------:|------:|
| `journal_entries` | 0 | 0 | **0** |
| `journal_entry_lines` | 0 | 0 | **0** |
| `payments` | 0 | 0 | **0** |
| `wallet_movements` (if present) | 0 | 0 | **0** |
| supplier settlement/allocation (if present) | 0 | 0 | **0** |

Expected delta: `0 / 0 / 0 / 0 / 0`. Actual delta: **0 / 0 / 0 / 0 / 0**.

### 17.6 Code/UI verification

| Command | Result |
|---------|--------|
| Related unit suite (2026-08-14, incl. W2.1 / rates / planned sync) | **PASS=80 FAIL=0** |
| `node scripts/qa/import-fx-w2-static-qa.mjs` (2026-08-14) | **PASS=25 FAIL=0 SKIPPED=2** |
| `node scripts/qa/import-fx-w2-live-rpc-qa.mjs` | **PASS=38 FAIL=0** |
| Browser screenshot smoke | **DEFERRED** (no non-prod HTTP API) |
| Production migrate/deploy | **NOT DONE** — separate approval required |

### 17.7 Defects found and fixes

| Defect | Fix |
|--------|-----|
| Arrangement form was one congested column | Five section cards + header + responsive grid |
| Funding/date copy used “not paid” | Advance/Credit/Mixed **planned**; “not financially posted” |
| Agent search omitted phone | Name + code + phone; money_exchange only |
| Purchase link omitted supplier/invoice search | Purchase number, invoice, supplier name |
| Confirmed cases still looked editable | Lock planning fields; show confirmation timestamp; accounting Not Posted |
| Duplicate Save/Confirm clicks | `createExclusiveBusyGuard` + per-action spinner |
| Client did not assert `posts_journal` | Service asserts false and strips `storage_path` |
| SearchableSelect could still open when locked | Optional `disabled` / `loading` |

No W2 SQL contract correction migration was written (migrations remain unapplied).

---

## 18. Files changed

- `migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql`
- `migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql`
- `src/app/lib/importFxCaseHelpers.ts` (+ test)
- `src/app/lib/importFxCaseWorkspaceView.ts` (+ test)
- `src/app/lib/importFxGateCodes.ts`
- `src/app/services/importFxCaseService.ts`
- `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx`
- `src/app/features/import-fx-case/ImportFxCaseArrangementPanels.tsx`
- `src/app/components/ui/searchable-select.tsx` (`disabled` / `loading` only)
- `scripts/qa/import-fx-w2-static-qa.mjs`
- `scripts/qa/apply-import-fx-w2-local.mjs`
- `scripts/qa/import-fx-w2-live-rpc-qa.mjs`
- `scripts/qa/import-fx-w1-live-rpc-qa.mjs`
- `scripts/qa/import-fx-w1-mutation-security-qa.mjs`
- `docs/accounting/IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`

---

## 19. Known limitations / remaining deployment prerequisites

- Localhost live DB migrate + RPC QA: **done 2026-08-14** (see §17.3–17.4). Production / VPS migrate still deferred.
- Attachment binary upload / signed URLs deferred.
- Browser screenshot smoke deferred (no non-prod HTTP API).
- Third-party role model uses `money_exchange` only.
- Production migrate, W3–W6 money posting, and COA changes remain unauthorized without separate approval.

---

## 20. W2→W3 handoff

**Operator howto (Cases vs Agent FX, RMB supplier pay):** [`IMPORT_FX_CASES_VS_AGENT_FX_OPERATOR_WORKFLOW.md`](IMPORT_FX_CASES_VS_AGENT_FX_OPERATOR_WORKFLOW.md)

**W2 completion boundary:** ARRANGEMENT draft/resume/confirm UI + non-posting RPCs + metadata attachments. Accounting status stays `NOT_POSTED`. Money stages remain disabled.

W3 (separate approval): financial ADVANCE / USD acquisition confirm + posting. Path 21 remains until an approved migration story.

---

## 21. Final verification verdict

**W2 CODE/UI COMPLETE — LOCALHOST LIVE DB QA PASS (2026-08-14)**

Code/UI + localhost migrate + live RPC (38/38) + financial Δ 0/0/0/0/0 + static/unit gates are green. Production deploy, staging HTTP UI smoke, and Storage review remain **not** claimed.

Production, VPS, financial posting, Chart of Accounts, and W3–W6 money stages were **untouched** in this localhost pass.

---

## 22. Commit hash and branch

| Item | Value |
|------|-------|
| Branch | `feat/import-fx-w2-arrangement-enrichment` |
| Implementation commit | `bf7973c4fa8459cb84f494daeccab04f55224fc0` |
| Docs hash stamp (pre-live-QA) | `1bce4f2e8f3a1c8c60c7bc2eeb1cceae01a4f9bb` |
| Live QA evidence (blocked preflight) | `503bffbb09676903acec7316197449dbe5db7b11` |
| UI finalize commit | `7e888ccd6db76ecf86bd13a2c6c4f94959eaf9d9` |
| Compare | https://github.com/NDM0313/NEWPOSV3/compare/main...feat/import-fx-w2-arrangement-enrichment |

---

## Implementation evidence table

| W2 item | Planned | Implemented | Tested | Notes |
|---------|--------:|------------:|-------:|-------|
| W2a schema/RPC | yes | yes | static + unit + live | Localhost applied 2026-08-14 |
| W2b UI | yes | yes | unit view-model + static | Header, 5 sections, wording, busy/lock |
| W2c links UI | yes | yes | unit + static | Purchase/supplier search + clear |
| W2d attach meta | yes | yes | static + live | metadata only; no upload claim |
| W2e tests/docs | yes | yes | unit/static/live | Browser smoke deferred |
| W2 localhost apply | yes | yes | **PASS** | `apply-import-fx-w2-local.mjs` (+ W2.1) |
| W2 live 33 RPC scenarios | yes | yes | **PASS=38** | includes financial proof row |
| Financial delta 0/0/0/0/0 | yes | yes | **PASS** | localhost live measured |
