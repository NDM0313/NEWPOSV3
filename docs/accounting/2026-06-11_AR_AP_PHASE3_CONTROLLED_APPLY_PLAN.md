# AR/AP Reconciliation Center — Phase 3 Controlled Apply Plan

**Date:** 2026-06-11  
**Status:** **Plan only — blocked until separately approved.** Do not implement or enable apply/post/relink/reverse.  
**Prerequisite:** Phase 2 signed off (2026-06-11). Apply paths remain disabled in production UI.

**Requires separate review before any work:** additive audit migration · dry-run hash · typed confirmation phrases · permission gates · rollback plan · controlled apply actions

---

## 1. Goals

Enable **explicit, auditable, reversible** repair apply for AR/AP Reconciliation Center actions:

- Post missing document JE (final sales/purchases only)
- Save relink contact mapping (audit + future line rollout)
- Journal reverse/repost / void (with reason)

**Non-negotiable:** No silent GL, payment, sale, purchase, or journal mutation.

---

## 2. Out of scope (unchanged surfaces)

Do **not** modify in Phase 3 unless explicitly scoped later:

- Trial Balance, Account Statements, Ledger Center V2 drill-down merge logic
- `accountingService` core posting merge paths (call existing engines only)
- RLS bulk replacement on money tables
- View/heuristic changes without additive migration story

---

## 3. Additive audit migration

**New migration** under `migrations/` (forward-only, no destructive DDL on money tables):

### Table: `ar_ap_repair_audit_log`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | RLS by company |
| `actor_user_id` | uuid | auth.uid() |
| `actor_role` | text | canon role at apply time |
| `action_type` | text | `post_document` \| `relink_contact` \| `void_journal` \| `reverse_repost` |
| `item_kind` | text | unposted \| unmapped_line \| manual_je |
| `item_key` | text | stable queue key |
| `dry_run_hash` | text | SHA-256 of canonical dry-run payload |
| `confirmation_phrase` | text | typed phrase (not secret — audit trail) |
| `before_snapshot` | jsonb | read-only trace at apply time |
| `after_snapshot` | jsonb | post-apply trace |
| `result_status` | text | `success` \| `failed` \| `rolled_back` |
| `error_message` | text | nullable |
| `journal_entry_ids_affected` | uuid[] | |
| `payment_ids_affected` | uuid[] | |
| `source_document_ids_affected` | uuid[] | |
| `created_at` | timestamptz | |

### Table: `ar_ap_repair_apply_tokens` (optional, short-lived)

| Column | Purpose |
|--------|---------|
| `token_hash` | One-time apply token bound to dry_run_hash + user + expiry (5–15 min) |
| `expires_at` | Prevent stale dry-run apply |

### Extend `ar_ap_reconciliation_review_items`

- Add `last_audit_log_id` uuid nullable FK
- Add `apply_note` text (from status modal / apply wizard)
- Optional new fix_status: `apply_pending`, `apply_failed` (additive enum check or text)

### RLS

- **SELECT:** admin, developer, super admin, accounting auditor (read-only for auditor)
- **INSERT:** via `SECURITY DEFINER` RPC only — no direct client insert
- **No UPDATE/DELETE** on audit log (append-only)

### RPCs (SECURITY DEFINER)

1. `ar_ap_repair_begin_apply(p_dry_run_hash, p_action_type, …)` → returns token + recap
2. `ar_ap_repair_commit_apply(p_token, p_confirmation_phrase, …)` → executes + writes audit
3. `ar_ap_repair_list_audit(p_company_id, filters)` → paginated read

Existing `upsert_ar_ap_reconciliation_item` remains for status-only workflow.

---

## 4. Dry-run hash

Before any apply button enables:

1. Build **canonical dry-run payload** (stable JSON):
   - action type, item key, proposed JE lines (account_id + dr/cr), void targets, relink before/after contact_id
   - exclude timestamps except document dates
   - sort lines by account_code
2. Compute `dry_run_hash = SHA-256(JSON.stringify(canonical))`
3. Display hash prefix in UI (e.g. first 12 chars) for user verification
4. Store hash in apply token row; commit rejects if payload drifted

**Implementation:** `src/app/services/arApRepairApplyService.ts` (new) — no changes to `accountingService` internals.

---

## 5. Typed confirmation phrases

Per action type, user must type exact phrase (case-sensitive or normalized — pick one and document):

| Action | Example phrase |
|--------|----------------|
| Post document | `APPLY POST SL-0005` (includes document_no) |
| Relink contact | `APPLY RELINK RCV-0017` |
| Void journal | `VOID JE RCV-0017` |
| Reverse/repost | `REVERSE REPOST RCV-0017` |

Rules:

- Phrase includes **document/JE ref** from dry-run recap
- Button disabled until exact match
- Phrase stored in audit log (not treated as secret)
- Wrong phrase → no RPC call

---

## 6. Permission gates

Extend `resolveArApReconciliationAccess`:

| Role | Phase 3 apply |
|------|----------------|
| Super Admin | All apply actions |
| Admin / Owner | Post + relink audit; void/repost only if `ready_to_reverse_repost` |
| Developer | All apply + bypass with extra audit flag |
| Accounting Auditor | Read audit log only |
| Salesman / Staff | No access (unchanged) |

Server-side RPC **must re-check role** — UI gate is not sufficient.

`canApplyRepair` becomes true only when Phase 3 flag enabled **and** role permits action type.

---

## 7. Apply flow (UI)

Replace disabled Phase 2 buttons with **Apply wizard** (final step only):

1. Recap dry-run (same as Phase 2 steps)
2. Show dry-run hash + affected tables list
3. Type confirmation phrase
4. **Apply** → `begin_apply` → `commit_apply` → refresh queues + audit entry
5. On success: if row still in SQL view, fix_status → `reviewed` not `resolved`

Wire existing services at commit only:

- `validateAndPostUnpostedDocument` (post)
- `saveJournalPartyContactMapping` (relink)
- `executeReverseRepostWizard` (void/repost)

Each wrapped by audit RPC; failures write `result_status=failed` with error.

---

## 8. Audit log UI

New tab or drawer on Reconciliation Center:

- Filter by action, date, actor, item_key
- Expand row: before/after JSON, hash, phrase, affected JE ids
- Link to Developer Integrity Lab for deep trace

Export CSV (Phase 5 optional).

---

## 9. Rollback plan

Phase 3 is **not** auto-rollback. Documented manual rollback per action:

| Action | Rollback strategy |
|--------|-------------------|
| Post document | Void new document JE via existing void RPC + audit entry `manual_rollback` note |
| Relink | Delete mapping row (new RPC `ar_ap_repair_rollback_relink` with audit) — GL still unchanged until party_contact_id rollout |
| Void journal | **Irreversible** without repost — require Super Admin + new repost apply with separate phrase |
| Reverse/repost | Void new JE + restore from before_snapshot guidance (manual, developer-assisted) |

**Pre-apply snapshot** in audit log enables support to reconstruct state.

**Feature flag:** `VITE_AR_AP_REPAIR_APPLY_ENABLED=0` default off in production until cutover checklist signed.

---

## 10. Safety checklist (pre-merge)

- [ ] Migration applied on staging VPS; RLS verified
- [ ] Apply RPC rejects non-final sale post (same gate as Phase 2)
- [ ] False-positive rows default to review-only, not relink apply
- [ ] No code path calls apply without audit RPC
- [ ] Phase 1 baseline re-run shows expected deltas only for intentional test applies
- [ ] Rollback runbook tested on one post + one relink in staging

---

## 11. Implementation order (when approved)

1. Migration + RLS + audit RPCs
2. `arApRepairApplyService` + hash helper + tests
3. Enable apply buttons in existing wizards (Posting, Relink, Journal)
4. Audit log UI tab
5. Staging apply test + updated docs
6. Production flag enable

---

## 12. Related docs

- Phase 1: [`2026-06-11_AR_AP_CENTER_BASELINE_AUDIT.md`](2026-06-11_AR_AP_CENTER_BASELINE_AUDIT.md)
- Phase 2: [`2026-06-11_AR_AP_PHASE2_SAFE_UI_REPORT.md`](2026-06-11_AR_AP_PHASE2_SAFE_UI_REPORT.md)
- Screenshots: [`../screenshots/ar-ap-phase2/`](../screenshots/ar-ap-phase2/)
