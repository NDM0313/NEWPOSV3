# FINAL: Generic transaction mutation ledger + effective read model (Phase 4)

**Date:** 2026-04-10  
**Scope:** Append-only `transaction_mutations`, `journal_entries.economic_event_id`, read-only `v_unified_transaction_feed`, Day Book presentation (effective vs audit), Truth Lab Phase 4 tab, payment PF-14 wiring, rejection of single mutable transaction SOT.

---

## 1. Why a single mutable “master transaction” table was rejected

| Risk | Explanation |
|------|-------------|
| Silent history loss | Overwriting one row destroys prior economic state; auditors and period close need immutable facts. |
| Weak audit trail | Reversals, transfers, and deltas encode **intent**; a single mutable row collapses that into one ambiguous number. |
| Unsafe periods | Closed periods require explicit adjustment or controlled reverse/repost — mutable masters invite silent backdating. |
| False UX simplicity | “One row” feels easier but **hides** PF-14 transfer JEs that are real GL truth on cash accounts. |

**Accepted instead:** keep canonical business tables + immutable `journal_entries` / `journal_entry_lines`, add **append-only** `transaction_mutations`, and a **read-only** unified feed view for inspection and support.

---

## 2. `transaction_mutations` schema

**Migration:** `migrations/20260433_phase4_transaction_mutations_unified_feed.sql`

| Column | Purpose |
|--------|---------|
| `id` | UUID PK |
| `company_id`, `branch_id` | Tenant / branch scope |
| `entity_type` | `sale`, `purchase`, `payment`, `expense`, `journal`, `transfer` (CHECK) |
| `entity_id` | UUID of business row |
| `mutation_type` | `create`, `update_metadata`, `date_edit`, `amount_edit`, `qty_edit`, `account_change`, `contact_change`, `allocation_rebuild`, `reversal`, `void`, `restore`, `status_change` (CHECK) |
| `old_state`, `new_state` | JSON snapshots (partial) |
| `delta_amount` | Numeric delta when relevant |
| `source_journal_entry_id`, `adjustment_journal_entry_id` | Link to GL |
| `actor_user_id`, `reason`, `metadata` | Accountability + extensibility |
| `created_at` | Append-only timestamp |

**Indexes:** `(company_id, entity_type, entity_id, created_at)`, `(company_id, mutation_type, created_at)`.

**RLS:** Same enterprise pattern as `payments` (company + branch via `user_branches`).

**Backfill:** No automatic historical backfill from legacy data (unreliable). New edits after deploy record rows.

---

## 3. Entity edit policy matrix (explicit rules)

| Class | Business row | `transaction_mutations` | Journal |
|-------|--------------|-------------------------|---------|
| Cosmetic metadata | In-place update | `update_metadata` | None |
| Date (open period, no basis change) | In-place + optional JE date patch | `date_edit` | Patch only when allowed |
| Date (closed / protected) | Controlled flow | `date_edit` + `reason` | Adjustment or reverse/repost |
| Liquidity account change (receipt/payment) | `payments.payment_account_id` updated | `account_change` | PF-14 **transfer** JE only |
| Amount change | `payments.amount` / document totals updated | `amount_edit` | PF-14 **delta** JE only |
| Qty / price / charges (posted sale/purchase) | Same document id | `qty_edit` / related | Delta JE / stock as needed |
| Void / reversal | Explicit flags | `void` / `reversal` | Explicit reversal JE + audit |

---

## 4. `economic_event_id` (stable chain key)

- **Column:** `journal_entries.economic_event_id` (nullable UUID, indexed).
- **Backfill:** `payment_id` when set; `reference_id` for `payment_adjustment`; document id for common `reference_type` roots.
- **Writes (new):** PF-14 `postPaymentAmountAdjustment` / `postPaymentAccountAdjustment` set `economic_event_id = paymentId` on the adjustment JE (via `JournalEntry.economic_event_id` in `accountingService.createEntry`).

---

## 5. Unified read model: `v_unified_transaction_feed`

**Purpose:** One query surface for tracing — **not** a write source.

**Unions:** `payments`, `sales`, `purchases`, `expenses` (expense row uses `NULL` contact_id until a stable vendor FK is guaranteed on all envs).

**Flags per row:** `has_adjustments`, `has_reversal`, `has_transfer` (derived from `journal_entries` + fingerprints where applicable).

**Grants:** `SELECT` to `authenticated` (RLS on underlying tables applies).

---

## 6. Effective vs audit rendering rules

| Mode | Rule |
|------|------|
| **Audit** | Every journal line and voucher has equal visual weight; operators see full PF-14 stack. |
| **Effective** | Same lines; **transfer** and **amount delta** rows are **labeled** and (in Day Book) **dimmed** — narrative: one payment, multiple GL documents by design. |
| **Roznamcha** | Still **one row per `payments` row**; copy explains PF-14 does not duplicate receipts in the cash book. |

**Code:** `src/app/lib/journalLinePresentation.ts`, Journal Day Book (`DayBookReport.tsx`) — Presentation column + Audit/Effective toggle.

---

## 7. Salar / RCV chain (reference)

**Documented previously:** `447f4205-8578-4d0b-b04b-ab379d17146e` — primary `manual_receipt` JE + `payment_adjustment` transfer from Cash → CASH G140; amount 2,700. Further edits (2,700 → 27,000, NDM) follow the same pattern: **one `payments` row** (current amount/account), **additional delta/transfer JEs**, not new standalone receipts in operational summary.

**After Phase 4:** each successful PF-14 post can append `transaction_mutations` (`account_change`, `amount_edit`) with `adjustment_journal_entry_id` for support trace.

---

## 8. Read-model / UX bugs addressed

| Issue | Fix |
|-------|-----|
| PF-14 JEs felt like “duplicate receipts” | Day Book **Presentation** badges + Effective mode dimming + Roznamcha explainer |
| No first-class mutation history | `transaction_mutations` + Truth Lab **Entity mutations + feed** tab |
| No stable cross-JE grouping id in DB | `economic_event_id` on `journal_entries` (backfill + new writes) |
| Scattered inspection | `v_unified_transaction_feed` + existing deep trace |

---

## 9. Code touched (summary)

| Area | Files |
|------|--------|
| SQL | `migrations/20260433_phase4_transaction_mutations_unified_feed.sql` |
| Mutations API | `src/app/services/transactionMutationService.ts` |
| PF-14 + mutations | `src/app/services/paymentAdjustmentService.ts` |
| JE insert | `src/app/services/accountingService.ts` (`economic_event_id`) |
| Presentation | `src/app/lib/journalLinePresentation.ts`, `DayBookReport.tsx` |
| Truth Lab | `truthLabTraceWorkbenchService.ts`, `ArApTruthLabPage.tsx` |
| Roznamcha copy | `RoznamchaReport.tsx` |

---

## 10. Remaining risks

- **Migration not applied:** `transaction_mutations`, `v_unified_transaction_feed`, and `economic_event_id` queries will fail until SQL is run.
- **No backfill:** Old edits have no mutation rows until a new qualifying change occurs.
- **Sale/purchase/expense mutation logging:** Not fully wired in this pass (policy documented; payment PF-14 is wired).
- **Performance:** `v_unified_transaction_feed` uses correlated subqueries — acceptable for support; not a high-QPS API surface.

---

## 11. Build result

Run locally: `npm run build` (expected **exit 0** after this change set).

---

## 12. Closing

Phase 4 **rejects** a single mutable transaction master as accounting SOT, **preserves** immutable journals, and **adds** traceability (`transaction_mutations`, `economic_event_id`, unified feed view) plus **clearer** effective vs audit presentation on the Journal Day Book and Roznamcha guidance.
