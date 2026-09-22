# UI app-path E2E + live reconciliation — 2026-09-21

**Branch:** `feat/party-je-guards-attributed-ledger`  
**Starting tip:** `fca86eb885e8801f23a811ecfef56e0cb6d73b8b`  
**Final tip:** 511e40832796397709d276552205ef83d8dbf7e2  

## Final verdict

# `READY_FOR_MERGE_DEPLOY_DECISION`

This is **not** approval to re-run production migration or IBRAHIM repair (both already live).  
It is a decision package for **repository merge / deployment alignment** only.

Residual (non-blocking for this verdict): **browser React click-through** against a clone-backed ERP UI was not available; Cases A–G were executed on the **same JWT + PostgREST persistence path** `AddEntryV2` → `accountingService.createEntry` uses, plus client-guard unit tests.

---

## Hard stops honored this phase

| Action | Status |
|--------|--------|
| Production mutations | **NONE** |
| Production migration rerun | **NO** |
| IBRAHIM `01_backup` / `02_apply` on production | **NO** |
| Production rollback | **NO** |
| Deploy | **NO** |
| Merge | **NO** |
| Graphify commit | **NO** (stashed out of scope) |

---

## 1. Real UI execution path (documented)

Frontend **does not** call `resolve_journal_posting_account_id`.

| Step | Component / API |
|------|-----------------|
| UI | `src/app/components/accounting/AddEntryV2.tsx` (`pure_journal`) |
| Party assist | `listPartyJeAccountChoices` / `resolvePartyLinkedAccountId` |
| Client guard | `assertPureJournalAccounts` → `assertOrResolveJournalAccountId` + `loadVerifiedAccountRemaps` |
| Service | `createPureJournalEntry` / `updatePureJournalEntry` (`addEntryV2Service.ts`) |
| Persist | `accountingService.createEntry` / `updateManualJournalEntry` → PostgREST `journal_entries` + `journal_entry_lines` |
| Server enforce | Trigger `trg_guard_journal_entry_line_account` (migration objects) |
| Errors | Client toast for guard failures; DB `JOURNAL_ACCOUNT_*` mapped via `mapJournalAccountGuardError` |

---

## 2. Matrix

| Layer | Result |
|------|--------|
| Isolated PostgreSQL 15 | **PASS** (prior phase; unchanged) |
| JWT / PostgREST staging | **PASS** (prior + this phase stack) |
| Staging UI / app-path E2E (Cases A–G) | **PASS** |
| Browser React click-through | **UNVERIFIED** (no ERP UI wired to clone) |
| Live migration reconciliation | **PASS** |
| Ibrahim live state | **PASS** (2 lines on `AP-SUPZHD0026`) |
| Backup evidence | **PASS** (`run_id=ibrahim_v1_20260919143935` intact) |
| Accounting invariants | **PASS** |
| Held-scope fingerprint | **PASS** (ID LACE not implemented; DHL/KIRAN/SHAHMIM present, not in IBRAHIM package) |
| Unit (`npm run test:unit`) | **PASS** (204) |
| Client JE guard node tests | **PASS** (8) |
| GitHub Actions | **GITHUB_ACTIONS_UNVERIFIED** (workflow exists; API returned 0 runs for branch without auth) |

---

## 3. Cases A–G (staging clone only)

Evidence: VPS `/tmp/je_guard_ui_app_path_e2e_20260921.txt`  
Script: `deploy/staging-je-guard/run-ui-app-path-e2e.sh`

| Case | Result | Notes |
|------|--------|-------|
| A normal same-company | **PASS** | Persisted cash + AP leaf |
| B Ibrahim AP party leaf | **PASS** | `AP-SUPZHD0026`; no `210026` |
| C verified remap | **PASS** | Retired `210026` → persisted `AP-SUPZHD0026` |
| D retired no remap | **PASS** | HTTP 400 `JOURNAL_ACCOUNT_RETIRED`; **0** lines |
| E cross-company | **PASS** | HTTP 400 `JOURNAL_ACCOUNT_WRONG_COMPANY`; no line-count change |
| F JE edit | **PASS** | Valid account edit OK; cross-company edit blocked; description-only no remap |
| G non-AP leaves | **PASS** | Worker, courier, expense/cash all OK (not AP-only) |

---

## 4. Production read-only reconciliation

Evidence: VPS `/tmp/je_guard_prod_reconcile_20260921.txt`  
Script: `deploy/staging-je-guard/prod-readonly-reconcile-accounting.sql`

### Migration / ACL

- `resolve`, `public_core(uuid,uuid)`, remaps, repair, guard trigger: **PRESENT**
- ACL: authenticated resolve+public_core YES; anon NO; repair service_role YES / authenticated NO
- No catalog drift requiring action; signatures match repo (2-arg public_core)

### Ibrahim

| Line | JE | Debit | Account |
|------|-----|-------|---------|
| `677c74de-…` | JE-0137 | 19000.00 | `AP-SUPZHD0026` |
| `343c2586-…` | JE-0138 | 99275.00 | `AP-SUPZHD0026` |

Company `e08a04af-…`; contact IBRAHIM BNRS / SUP-ZHD-0026; non-void.

### Backup

- Schema `backup_coa_limited_ibrahim_v1` present
- `run_id=ibrahim_v1_20260919143935` (original; not overwritten)
- manifest=2, pre=2, post=2
- pre accounts `210026`; post `AP-SUPZHD0026`; live matches post; amounts match pre/post

### Accounting invariants

- JE-0137 / JE-0138: debit=credit, imbalance **0.00**, 2 lines each
- Ibrahim repaired debit sum **118275.00**; line count **2** (no duplicates)
- Company posted non-void GL imbalance **0.00**
- Only account attribution changed vs pre (amounts/JE ids unchanged)

### Held scopes

- ID LACE: **NOT IMPLEMENTED** (no id_lace function; package scope IBRAHIM only)
- DHL / KIRAN / SHAHMIM / ID LACE contacts still have their own AP/legacy distributions
- Held fingerprint (prod): `2e2a9c788c0a7e7575ab10b3857b5b7b` (informational; not mutated this phase)

---

## 5. Code changes this phase

- `mapJournalAccountGuardError` + wire into `AddEntryV2` catch
- `journalPartyPosting.node.test.ts` / `mapJournalAccountGuardError.node.test.ts`
- `deploy/staging-je-guard/run-ui-app-path-e2e.sh`
- `deploy/staging-je-guard/prod-readonly-reconcile-accounting.sql`
- This report

---

## 6. Graphify local status

Local Graphify modifications were **stashed** as `graphify-out-of-scope-ui-phase` and **not** committed/pushed.

---

## Next owner decision (separate)

Phrase for merge/deploy (example):  
`merge and deploy feat/party-je-guards-attributed-ledger to align clients with already-live JE guard`

Do **not** use “run production migration” or “apply IBRAHIM repair” — those already completed on 2026-09-19.
