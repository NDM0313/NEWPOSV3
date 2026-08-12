# Import FX Case — W2 Arrangement enrichment

**Branch:** `feat/import-fx-w2-arrangement-enrichment`  
**Status:** Implemented (PARTIAL — live DB QA skipped on office PC)  
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

**None.** Live financial delta not measured on this office PC (Docker unauthorized). Expected when live QA runs: **0 / 0 / 0 / 0 / 0** (JE / lines / payments / wallets / settlements).

---

## 16. Migration order

Path 21 → Wave A → Wave 0 → W1 → **W2 enrichment → W2 attachment metadata**.

---

## 17. Test and QA evidence

| Suite | Result |
|-------|--------|
| `npx tsx --test src/app/lib/importFxCaseHelpers.test.ts` (+ Path 21 / Wave 0 / Wave A related) | **33/33 PASS** (helpers alone 9/9) |
| `node scripts/qa/import-fx-w2-static-qa.mjs` | **15/15 PASS** |
| Live DB / security harness | **SKIPPED** (no Docker / no authorized DB target) |
| `npm run build` | **PASS** |

---

## 18. Files changed

- `migrations/20260812140000_import_fx_case_arrangement_enrichment_w2.sql`
- `migrations/20260812140100_import_fx_case_attachment_metadata_rpc_w2.sql`
- `src/app/lib/importFxCaseHelpers.ts` (+ test)
- `src/app/lib/importFxGateCodes.ts`
- `src/app/services/importFxCaseService.ts`
- `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx`
- `scripts/qa/import-fx-w2-static-qa.mjs`
- `docs/accounting/IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`
- `docs/accounting/IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md` (successor pointer)
- `docs/accounting/IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md` (W2/W3 rename note)
- `docs/accounting/PAYMENT_ENTRY_PATHS.md`
- `docs/accounting/ACCOUNTING_REPORTS_INDEX.md`
- `.cursor/rules/multi-currency-import-fx.mdc`

---

## 19. Known limitations

- Live DB QA SKIPPED on office PC (no Docker; production/VPS unauthorized).
- Attachment binary upload / signed URLs deferred.
- Third-party role model uses `money_exchange` only (no separate converter type in contacts).

---

## 20. W2→W3 handoff

W2 exit: ARRANGEMENT COMPLETED, `accounting_status=NOT_POSTED`, money stages not COMPLETED, zero money postings from case RPCs.  
W3 (separate approval): financial ADVANCE / USD acquisition confirm + posting. Path 21 remains until an approved migration story.

---

## 21. Final implementation status

**PARTIAL** — code/docs/unit/static QA/build complete; live DB apply/QA not run on this machine.

---

## 22. Commit hash and branch

*(filled after push)*

---

## Implementation evidence table

| W2 item | Planned | Implemented | Tested | Notes |
|---------|--------:|------------:|-------:|-------|
| W2a schema/RPC | yes | yes | static + unit | Live DB SKIPPED |
| W2b UI | yes | yes | static | |
| W2c links UI | yes | yes | static | |
| W2d attach meta | yes | yes | static | metadata only |
| W2e tests/docs | yes | yes | unit/static/build | |
