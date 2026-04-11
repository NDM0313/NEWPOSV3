# Final journal action policy lock and source-control closure

## Root cause

1. **Return and document JEs use `inferTransactionKind` → `generic_adjustment`**, not `document_total`. Until blocked explicitly in `resolveUnifiedJournalEdit`, the Transaction Detail modal could route those rows to the adjustment / quick-edit path instead of a clear “manage from source module” rule.

2. **Journal reversal policy did not treat “already has an active `correction_reversal` child” as terminal.** After someone posted a PF-07 reversal from Journal Entries, the **original** header row still looked like a normal `sale_return` / `purchase` / etc. row, so **Edit** and **Reverse** could still appear even though a reversing JE already existed. That violates ERP-safe “no second mutation path” expectations.

3. **Backend** already blocked new reversals for source-controlled types via `journalReversalBlockedReason` inside `createReversalEntry` (unless `bypassJournalSourceControlPolicy` is used for module voids). The remaining gap was consistent **terminal** treatment once a reversal exists, and **UI parity** (Journal list, Day Book, Transaction Detail).

## Policy matrix (implemented)

| Row kind | View | Open source | Edit amount/account from Journal | Reverse from Journal |
|----------|------|-------------|-----------------------------------|------------------------|
| Sale (document JE, no `payment_id`) | Yes | Yes | No | No |
| Purchase (document JE, no `payment_id`) | Yes | Yes | No | No |
| Sale return | Yes | Yes (Sales → Returns) | No | No |
| Purchase return | Yes | Yes (Purchases → Returns) | No | No |
| Customer receipt / supplier payment / manual receipt / manual payment / PF-14 adjustment (`payment_id` or payment reference) | Yes | Via payment editor | Only if **latest**, not void, not historical, **no active correction_reversal** | Same |
| Any row: void / historical chain / **active correction_reversal posted** | Yes | Where applicable | No | No |

**Module bypass:** `saleReturnService` and `purchaseReturnService` call `createReversalEntry(..., { bypassJournalSourceControlPolicy: true })` so void/cancel from Returns can still post the reversing JE while the Journal UI remains blocked for those types.

## Files changed (this closure)

- `src/app/lib/journalEntryEditPolicy.ts` — `hasActiveCorrectionReversal` on row; block edit/reverse; Day Book helper third argument.
- `src/app/lib/unifiedTransactionEdit.ts` — `has_active_correction_reversal` on `JournalTransactionLike`; block unified edit when set.
- `src/app/services/accountingService.ts` — `findActiveCorrectionReversalJournalId`; reuse in `createReversalEntry`.
- `src/app/context/AccountingContext.tsx` — batch-load reversal parents; `metadata.hasActiveCorrectionReversal` on each entry.
- `src/app/components/accounting/AccountingDashboard.tsx` — pass flag into `journalReversalBlockedReason` (grouped + flat).
- `src/app/components/reports/DayBookReport.tsx` — same reversal batch; `allowsDayBookUnifiedEdit(..., hasActiveCorrectionReversal)`.
- `src/app/components/accounting/TransactionDetailModal.tsx` — load reversal flag; unified policy object; banners / buttons.
- `src/app/components/sales/SalesPage.tsx` — `pendingAccountingOpen_saleReturnId` → open return detail from Accounting “Open source”.
- `src/app/components/purchases/PurchasesPage.tsx` — `pendingAccountingOpen_purchaseReturnId` → open purchase return detail.

## Live data repair

**No hard deletes.** Terminal behaviour for “already reversed” is derived at read time: existence of a non-void `journal_entries` row with `reference_type = 'correction_reversal'` and `reference_id = <original journal id>`. No destructive migration was required for policy enforcement.

If operators created **duplicate** active reversals (data anomaly), use accountant review; optional tooling is described in `scripts/repair_terminal_document_action_states.sql` (commented / diagnostic only by default).

## Before / after behaviour

- **Before:** A `sale_return` JE could show **Edit** / **Reverse** after a `correction_reversal` was already posted; Day Book could still offer edit for the same logical state.
- **After:** Any JE with an active reversing child is **view-only** for Journal edit/reverse and unified edit; source-controlled document types remain blocked from Journal reversal regardless; Returns void still works via bypass.

## Regression checks (manual)

1. **Sale document JE** — Journal: no edit/reverse; open source opens sale.
2. **Purchase document JE** — same.
3. **Sale return** — Journal: no edit/reverse; open source opens return; void from Returns still posts reversal; repeated void is idempotent on return status.
4. **Purchase return** — same pattern.
5. **Payment chain** — tail row: edit/reverse per existing PF-14 rules; historical tail: locked; row with active correction_reversal: locked.
6. **Transaction detail** — same policy as list; no unified amount edit for blocked resolutions.

## Automated / SQL proof

- `npm run build` — passes locally after these changes.
- `scripts/verify_journal_action_policy_lock.sql` — read-only integrity and policy-supporting counts.

## Deploy

Production deploy uses `bash deploy/deploy.sh` on the VPS after `git pull` on the tracked branch (see `deploy/deploy.sh`). Ensure commits are pushed to `origin` before deploying so the VPS reset matches this closure.

**Shipped commits (main):** `99023d5` (policy + context + services + UI), `c9a674d` (`journalLinePresentation` + `accountFlowPresentation` required by Day Book), `1dfe2d3` (minimal `truthLabTraceWorkbenchService` stub so Docker `vite build` succeeds — Transaction Detail “Full payment trace” sheet loads empty counts until the full workbench module and its dependencies are committed).

**Note:** One deploy migration logged `ERROR: must be owner of view v_accounting_tb_company_totals` (pre-existing ownership); deploy script still completed with exit code 0.

## Full Truth Lab workbench (optional follow-up)

If you had a local-only `truthLabTraceWorkbenchService.ts` (~1.2k lines) with `transactionMutationService` / `arApTruthLabService` wiring, restore it from your backup or IDE history and commit it together with those services so the Payment / GL trace sheet is populated again in production.
