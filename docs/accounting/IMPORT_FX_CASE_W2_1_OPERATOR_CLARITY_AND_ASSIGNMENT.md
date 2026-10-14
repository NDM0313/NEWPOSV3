# Import FX Case — W2.1 Operator clarity, validation & assignment

**Branch:** `feat/import-fx-w2-arrangement-enrichment`  
**Status:** **W2.1 CODE/UI/MIGRATION WRITTEN — LOCALHOST APPLY DONE (2026-08-14)** · production migrate still deferred  
**Gates:** `multiCurrencyEnabled` ops · `fxSettlementAccountingEnabled = false` (Profile A)  
**Accounting:** **No journals / payments / wallets / AP** — every mutation returns `posts_journal: false`  
**Path 21:** Unchanged money path

**Companions:**
- [`IMPORT_FX_OPERATOR_WORKFLOW_AND_GAP_ANALYSIS.md`](./IMPORT_FX_OPERATOR_WORKFLOW_AND_GAP_ANALYSIS.md)
- [`IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`](./IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md)
- [`IMPORT_FX_CASES_VS_AGENT_FX_OPERATOR_WORKFLOW.md`](./IMPORT_FX_CASES_VS_AGENT_FX_OPERATOR_WORKFLOW.md) (subordinate Path 21 quick guide)

---

## 1. Approved gaps

| Gap ID | Topic |
|--------|-------|
| IFX-GAP-01 | Agent-based arrangement confirm without agent |
| IFX-GAP-02 | CREDIT displays planned advance PKR |
| IFX-GAP-03 | Ambiguous rate-direction wording |
| IFX-GAP-04 | No employee/task assignment |
| IFX-GAP-05 | UI locks confirmed case but draft RPC still editable |
| IFX-GAP-06/07 | Operator confusion Cases vs Path 21 / wallet origin |

---

## 2. Root cause of each gap

| Gap | Root cause |
|-----|------------|
| 01 | `validateArrangementPlanning` and `confirm_import_fx_case_stage` did not require `agent_contact_id`; party assert only ran when non-null |
| 02 | Advance field always visible; funding mode switch did not clear `expected_advance_amount_pkr` |
| 03 | Summary used slash form `CNY/USD`; labels omitted “per 1” |
| 04 | No assignment columns or RPCs on `import_fx_cases` |
| 05 | `isArrangementLocked` hid Save in UI, but `update_import_fx_case_draft` still allowed `ARRANGED` while `NOT_POSTED` |
| 06/07 | Dual Purchases buttons without in-workspace Path clarity / wallet source guidance |

---

## 3. Implementation decisions

1. **Agent matrix:** All shipped arrangement types require agent on confirm: `PATH_21_AGENT_DUAL_CREDIT`, `POOLED_USD_CNY`, `AGENT_PREPAID`. No agentless type ships in W2.1.
2. **Historical NULL-agent ARRANGED cases:** Remain **readable**; show warning; do **not** auto-rewrite; assignment still editable; arrangement fields stay locked.
3. **CREDIT advance:** Canonical behavior = **clear to NULL** (UI on switch + client payload normalize + server normalize).
4. **MIXED:** Reject advance > expected total when total computable (`usd × pkr_per_usd + fees`).
5. **Lock:** Server raises `IMPORT_FX_CASE_ARRANGEMENT_LOCKED` after confirm / ARRANGEMENT COMPLETED / `operational_status=ARRANGED`. No reopen in W2.1.
6. **Assignment:** Additive columns on `import_fx_cases` + `update_import_fx_case_assignment` / `complete_import_fx_case_assignment` + events. Not a company-wide task platform.
7. **Path clarity:** In-workspace help card only; no auto-navigate to Path 21; no dual posting.

---

## 4. Database changes

Migration: [`migrations/20260813120000_import_fx_case_operator_assignment_and_validation_w2_1.sql`](../../migrations/20260813120000_import_fx_case_operator_assignment_and_validation_w2_1.sql)

Columns on `import_fx_cases`:

| Column | Type |
|--------|------|
| `case_owner_user_id` | uuid → `public.users(id)` |
| `assigned_to_user_id` | uuid → `public.users(id)` |
| `current_action_required` | text |
| `assignment_due_at` | timestamptz |
| `assignment_priority` | LOW\|NORMAL\|HIGH\|URGENT |
| `assignment_status` | OPEN\|IN_PROGRESS\|WAITING_AGENT\|WAITING_THIRD_PARTY\|DONE\|CANCELLED |
| `reminder_at` | timestamptz |
| `assignment_updated_at` | timestamptz |
| `assignment_notes` | text |

Helpers (internal, revoked from client roles): `_import_fx_w21_arrangement_requires_agent`, `_import_fx_w21_assert_agent_for_confirm`, funding normalize/assert; hardened `_import_fx_w2_assert_party_contacts` (inactive agent).

---

## 5. RPC contracts

| RPC | Change |
|-----|--------|
| `update_import_fx_case_draft` | Reject when arrangement locked (`IMPORT_FX_CASE_ARRANGEMENT_LOCKED`); CREDIT clears advance; funding assert |
| `confirm_import_fx_case_stage` | Require active `money_exchange` agent when type needs agent (`IMPORT_FX_CASE_AGENT_REQUIRED` / role / inactive / not found); funding assert |
| `update_import_fx_case_assignment` | **New** — assignment fields only; MC ON; company/branch; assignee company+branch rules; event `ASSIGNMENT_UPDATED`; `posts_journal: false`; does not change accounting/arrangement |
| `complete_import_fx_case_assignment` | **New** — status DONE + event; `posts_journal: false` |
| `list_import_fx_cases` / `get_import_fx_case` | Project assignment columns; MC OFF still readable |

---

## 6. UI behavior

- Path clarity card (Case vs Agent FX) + wallet guidance
- Confirm requires agent (client + server)
- Historical missing-agent warning banner
- CREDIT hides planned advance; ADVANCE/MIXED show it; summary shows expected total / credit with “Not financially posted”
- Rate labels: `PKR per 1 USD`, `CNY received per 1 USD`, etc.
- Assignment panel: owner, assignee, action, due, priority, reminder, status, notes, timeline; editable after ARRANGEMENT confirm
- Arrangement fields remain locked after confirm

---

## 7. Task-assignment model

Additive on case + audit events (not Studio tasks, not generic ERP tasks). Assignment status is **operational only** and never changes accounting status, wallet/AP, or ARRANGEMENT confirmation.

---

## 8. Security and authorization

- Fail-closed `_import_fx_case_assert_company_access` + branch helpers
- Multi Currency required for mutations (including assignment)
- Assignee/owner must be active `public.users` in company; branch access for case branch when set
- Helpers revoked from PUBLIC/anon/authenticated
- RPCs GRANT EXECUTE to authenticated only
- Tables remain RPC-oriented; no JE/payment inserts

---

## 9. Tests and results

Ran (local):

```text
npx tsx --test src/app/lib/importFx*.test.ts  → 80 pass / 0 fail
```

Covered: agent matrix, blank agent, same agent/third party, CREDIT/ADVANCE/MIXED, excess advance, rate labels, UI lock, historical warning, assignment overdue, money stage block, Path clarity copy, storage_path strip (existing), Path 21 / Wave 0 / Wave A regression suites included in the Import FX batch.

Live DB QA: **deferred** (Windows PC; migration not applied here).

---

## 10. Files changed

See git commits for full list. Primary:

- `migrations/20260813120000_import_fx_case_operator_assignment_and_validation_w2_1.sql`
- `src/app/lib/importFxCaseW21Helpers.ts` (+ test)
- `src/app/lib/importFxCaseWorkspaceView.ts` / `importFxIndicativeRates.ts` (+ tests)
- `src/app/services/importFxCaseService.ts`
- `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx`
- `src/app/features/import-fx-case/ImportFxCaseAssignmentPanel.tsx`
- Docs: this file + gap analysis + W2 enrichment + rule + Cases vs Agent quick guide

---

## 11. Migration status

| Item | Status |
|------|--------|
| Migration file in repo | Yes |
| Applied to live / VPS DB | **No (deferred)** |
| Docker used | No |
| Production deploy | No |

---

## 12. Known limitations

- No reopen of confirmed arrangement (cancel unposted + replace)
- Historical NULL-agent cases need a later approved corrective workflow before W3 posting eligibility
- Wallet source-tracing in ledgers remains documentation/guidance in W2.1 (no ledger UI rewrite)
- Live financial delta not proven without authorized DB

---

## 13. W3 handoff

W3+ must:

- Treat missing-agent ARRANGED cases as ineligible for money until corrected
- Preserve Path 21
- Not treat assignment status as accounting status
- Implement money stages only with separate owner approval

---

## 14. Commit hashes

| Commit | Message |
|--------|---------|
| `48662d4d` | `fix: harden Import FX W2 operator workflow` |
| 83c77314 | `docs(accounting): record W2.1 workflow and assignment fixes` |

---

## Gap register (final status)

| Gap ID | Before | Fix | Tests | Final status |
|--------|--------|-----|-------|--------------|
| IFX-GAP-01 | Confirm without agent | UI+RPC agent required; historical warning | Unit matrix + blank agent | **Fixed — localhost migrate applied 2026-08-14** |
| IFX-GAP-02 | CREDIT showed advance | Hide/clear advance; summary rules | CREDIT/ADVANCE/MIXED unit | **Fixed — localhost migrate applied 2026-08-14** |
| IFX-GAP-03 | Ambiguous CNY/USD | Explicit directional labels | Rate label unit | **Fixed** |
| IFX-GAP-04 | No assignment | Columns + RPCs + panel | Helper + service wiring | **Fixed — localhost migrate applied 2026-08-14** |
| IFX-GAP-05 | RPC editable after confirm | `IMPORT_FX_CASE_ARRANGEMENT_LOCKED` | UI lock unit + live scenario 24 | **Fixed — proven on localhost live QA** |
| IFX-GAP-06/07 | Path/wallet confusion | Path clarity + wallet guidance card | Copy unit tests | **Fixed (docs/UI)** |

---

## Zero-accounting proof (static + localhost live)

W2.1 migration and client assignment/confirm/draft paths do not insert into `journal_entries`, `journal_entry_lines`, `payments`, wallet movement tables, Agent/Supplier AP, settlements, or conversions. Localhost live W2 suite (2026-08-14) measured financial delta **0 / 0 / 0 / 0 / 0**.
