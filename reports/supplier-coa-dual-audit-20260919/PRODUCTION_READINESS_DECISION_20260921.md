# JE guard + IBRAHIM Class B — production readiness decision package

**Generated:** 2026-09-21 (UTC)  
**Branch:** `feat/party-je-guards-attributed-ledger`  
**Starting SHA (owner-confirmed):** `a01e1f47f6d283ed56a647d5002b8bc99b81adef`  
**Final SHA (this phase):** _filled at commit time_  
**This phase production mutations:** **NONE** (no DDL/DML/migrate/repair/deploy on live `postgres`)

## Readiness label

# `NOT_READY_FOR_PRODUCTION_APPROVAL`

### Why not READY

1. **Staging application/UI E2E:** `UNVERIFIED` — no ERP UI/login device was wired to the disposable staging Auth/PostgREST stack in this phase.
2. **Production factual state diverges from the prior “NOT EXECUTED” assumption** — live `postgres` already has the guard migration **and** IBRAHIM Class B repair applied (see §6). Owner must acknowledge that history before any further production action (including any rollback discussion).
3. Full-repo `tsc --noEmit` hit **heap OOM** in this environment (`PRE_EXISTING / OUT_OF_SCOPE` for this package).

Hard stop remains: **no additional production migrate/repair/merge/deploy from this phase.**

---

## Layer results

| Layer | Result | Evidence |
|------|--------|----------|
| Isolated PostgreSQL 15 (Docker harness) | **PASS** | [`verification/EVIDENCE.md`](./verification/EVIDENCE.md) — regenerated 2026-09-21T12:31:31Z |
| JWT / PostgREST (staging loopback only) | **PASS** | VPS `/tmp/je_guard_jwt_matrix_20260921.txt`, `/tmp/je_guard_jwt_extra_20260921.txt`, `/tmp/je_guard_posting_smoke_20260921.txt` |
| Staging application / UI | **UNVERIFIED** | No staging ERP UI against clone |
| Production-schema clone rehearsal | **PASS** | VPS `/tmp/je_guard_clone_rehearsal_cont_20260921.txt` (+ earlier apply/backup on clone) |
| Production read-only preflight | **PASS (read-only)** | VPS `/tmp/je_guard_prod_readonly_20260921T122954Z.txt` + deep ACL/backup probes |
| Unit (`npm run test:unit`) | **PASS** (204) | local |
| `journalPartyPosting.test.ts` (vitest) | **PRE_EXISTING / OUT_OF_SCOPE** | package `vitest` not installed; not in `test:unit` |
| Full `tsc --noEmit` | **PRE_EXISTING / OUT_OF_SCOPE** | Node heap OOM |
| GitHub Actions on branch | **UNVERIFIED** | `gh` CLI unavailable; public Actions API returned 0 runs for branch |

---

## 1. Branch state

| Item | Value |
|------|-------|
| Branch | `feat/party-je-guards-attributed-ledger` |
| Start SHA | `a01e1f47f6d283ed56a647d5002b8bc99b81adef` |
| Relation | Local was behind tip; fast-forwarded to confirmed SHA (no force/reset of unrelated work) |
| Migration SHA256 | `ec076d5538e6752edc7e147e92c1591ff6960dc8a67d64ef3029910866310b4c` |
| Key paths | `migrations/20260919140000_journal_posting_account_guard_and_verified_remaps.sql`, `reports/.../repair-package/*`, `reports/.../verification/*`, `deploy/staging-je-guard/*` |

---

## 2. JWT / PostgREST (clone only)

Stack: `/root/je-guard-stage` → `127.0.0.1:18081` / `18080` → DB **`ledger_stage_20260919_prodcheck` only**. Torn down after evidence; clone kept.

| Case | Result | HTTP / notes |
|------|--------|----------------|
| Company A JWT → same-company `resolve_journal_posting_account_id` | PASS | 200 |
| Company A JWT → Company B resolve | PASS fail | 403 |
| Company A JWT → direct `_journal_account_guard_resolve_public_core` cross-company | PASS fail | 403 |
| Company A JWT → `repair_restore_journal_entry_line_account` | PASS fail | 403 |
| Anon → resolve | PASS fail | 401 / `42501` permission denied |
| Anon → repair | PASS fail | 404 |
| Rejected calls → no line-count change | PASS | before=after |
| GUC / JWT-text spoof → repair elevation | PASS blocked | |
| Staging `service_role` repair on disposable fixture | PASS | rolled back |
| Posting smoke: valid JE / supplier AP / wrong company / retired no map / retired+map | PASS | PostgREST JE line path |

---

## 3. Staging UI

**UNVERIFIED** — checks not run:

- normal active same-company account posting (UI)
- retired + verified remap (UI)
- retired without remap rejection message (UI)
- wrong-company blocked (UI)
- supplier AP / worker / courier leaf selection (UI)
- journal edit/update account guard (UI)
- no accidental remap on non-account edits (UI)

PostgREST posting smoke on staging covers the **server** JE-line path only (not the React app).

---

## 4. Production-schema clone rehearsal

Target: **`ledger_stage_20260919_prodcheck`** only (never live `postgres` writes).

Sequence executed with **actual** repo repair scripts + migration:

1. Readonly preflight — PASS (IBRAHIM still on `210026` before apply)
2. Migration re-apply — PASS (seed `identical_skip=33`)
3. ACL matrix — PASS (`authenticated` resolve yes; anon resolve no; repair service_role only)
4. `01_backup.sql` — PASS (`run_id=ibrahim_v1_20260921123430`, 2 lines, `ID LACE=NOT_IMPLEMENTED`)
5. `02_apply.sql` — PASS (`APPLY_OK`, both lines → `AP-SUPZHD0026`)
6. Repeat apply — PASS (`ALREADY_APPLIED`)
7. Repeat backup — PASS (`BACKUP_EXISTS`, refuse overwrite)
8. Deliberate debit drift → actual `03_rollback.sql` — PASS (`ROLLBACK_DRIFT`, non-zero exit)
9. Restore fixture (`13_rollback_drift_verify_restore.sql`) — PASS
10. Normal `03_rollback.sql` — PASS (`ROLLBACK_OK` → both lines back on `210026`)
11. Repeat rollback — PASS (`ALREADY_ROLLED_BACK`)

Held fingerprint (DHL / KIRAN / SHAHMIM / ID LACE linked lines): **unchanged** (`15bcbe4cef2bcb78171914b97374ce37` before=after).  
Backup evidence survived: manifest=2, pre=2, post=2.  
Migration idempotency: re-apply skips existing objects; remap seed identical_skip.

---

## 5. Code regression / build

| Check | Result |
|------|--------|
| Isolated PG harness | PASS |
| `npm run test:unit` | PASS (204) |
| `journalPartyPosting.test.ts` via vitest | PRE_EXISTING — vitest not installed |
| Full `tsc --noEmit` | PRE_EXISTING — heap OOM |

---

## 6. Production read-only preflight (live `postgres`)

**No writes in this phase.**

| Check | Result |
|------|--------|
| `current_database() = postgres` | PASS |
| Guard objects | **PRESENT** — `resolve`, remaps, events, trigger = true; `public_core(uuid,uuid)` present (preflight signature corrected to 2-arg) |
| IBRAHIM live lines | Already on **`AP-SUPZHD0026`** (Dr 19000 / 99275); JE-0137 / JE-0138 non-void |
| Legacy `210026` | inactive; target AP active, contact IBRAHIM BNRS / SUP-ZHD-0026 |
| `backup_coa_limited_ibrahim_v1` | **PRESENT** — meta `run_id=ibrahim_v1_20260919143935`, scope `IBRAHIM_CLASS_B_ONLY`, `id_lace_status=NOT_IMPLEMENTED`, expected_line_count=2 |
| pre/post snapshots | pre: legacy account; post: AP account; live matches post |
| ACL | `authenticated` EXECUTE resolve + public_core YES; anon NO; repair EXECUTE service_role YES / authenticated NO |
| ID LACE | **NOT IMPLEMENTED** (legacy + AP accounts exist; no ID LACE repair package applied) |
| DHL / KIRAN / SHAHMIM | Held contacts still have their own AP/legacy distributions; **not** in IBRAHIM repair scope |

### Correction vs prior “known state”

| Prior assumption | Live fact (2026-09-21 read-only) |
|------------------|----------------------------------|
| Production migration NOT EXECUTED | **EXECUTED** (objects present) |
| Production repair NOT EXECUTED | **EXECUTED** (backup schema + lines on AP; run 2026-09-19 14:39Z) |

This phase still performed **zero** production mutations.

---

## Scope locks

| Scope | Status |
|------|--------|
| IBRAHIM Class B (2 lines) | Repair scripts exist; **already applied on production**; clone rehearsal PASS |
| ID LACE | **NOT IMPLEMENTED** |
| DHL / KIRAN / SHAHMIM / other holds | **Unchanged** (not in this package) |
| Rollback readiness | Scripts + clone proof PASS; production rollback **not** authorized here |
| Merge / deploy | **NOT DONE** |

---

## Blockers for `READY_FOR_EXPLICIT_PRODUCTION_APPROVAL`

1. Close **staging UI E2E** (or explicitly waive with owner sign-off).
2. Owner **acknowledge live production already migrated + IBRAHIM-applied**, and state the next desired production action (if any) in a separate explicit phrase — do not reuse “migrate now” / “run IBRAHIM repair” without reconciling current state.
3. Optional: restore CI visibility (`gh` / Actions) for this branch.

---

## Links (fill after push)

- Commit: `https://github.com/NDM0313/NEWPOSV3/commit/<FINAL_SHA>`
- Compare from start: `https://github.com/NDM0313/NEWPOSV3/compare/a01e1f47f6d283ed56a647d5002b8bc99b81adef...<FINAL_SHA>`
