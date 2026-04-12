# Final: Account flow visibility and effective-mode stabilization

This document records the **read-only UX stabilization** for PF-14–aware ledgers: where money moved, which row is primary vs adjustment, and how **audit** vs **effective** presentation works. **No core posting logic was changed** in this pass; `journal_entry_totals` trigger (`20260434`) and payment services were not modified.

## Context (read first)

- `docs/accounting/FINAL_PAYMENT_EDIT_REPAIR_AND_EFFECTIVE_LEDGER_CLOSURE.md`
- `docs/accounting/FINAL_EDIT_FLOW_AUDIT_AND_DUPLICATE_POSTING_REPORT.md`
- `docs/accounting/PF14_TRANSACTION_CHANGE_TRACE_AND_REPAIRS.md`
- `migrations/20260434_journal_entry_totals_sync_trigger.sql`

## Screens changed

| Area | File(s) | What changed |
| --- | --- | --- |
| Shared helpers | `src/app/lib/accountFlowPresentation.ts` | **New**: `deriveFromToForLedgerLine`, `netEconomicMeaning`, `classifyAccountFlowBadge`, `editTargetTypeLabel`, `looksLikeHistoricalRepair`, badge styling helpers. |
| GL data | `src/app/services/accountingService.ts` | `getAccountLedger`: loads `account:accounts(name, code)`, `economic_event_id` on JE header; maps `account_name`, `document_type`, `economic_event_id` on `AccountLedgerEntry`. |
| Journal metadata | `src/app/context/AccountingContext.tsx` | `metadata.actionFingerprint`, `metadata.economicEventId` on `AccountingEntry` for future journal-list use. |
| Account Ledger (full page) | `src/app/components/accounting/AccountLedgerPage.tsx` | Columns: **Presentation**, **Account flow** (From → To), **Economic meaning**, EE hint; **Audit / Effective** switch (dims PF-14 transfer & amount-delta rows; **running balance unchanged**). Edit CTA: **Edit payment** when `payment_id` set. |
| Account Statements | `src/app/components/reports/AccountLedgerReportPage.tsx` | Extra columns: **Counter (GL)**, **From → To**, **Economic meaning**, **Economic event**, **Source type**, **Edit target**, renamed settlement column; export updated; **Edit payment** when linked. |
| Day Book / Roznamcha (journal lines) | `src/app/components/reports/DayBookReport.tsx` | Per **line**: **From / To** from sibling lines in the same JE; **Economic meaning**; export columns extended; **Edit payment** when `paymentId` set; existing audit/effective switch retained. |
| Transaction detail | `src/app/components/accounting/TransactionDetailModal.tsx` | **Full payment trace** side sheet: `fetchPaymentDeepTrace` + `buildPaymentPostingExpectedVsActual` narrative, counts, link to **AR/AP Truth Lab** (`/test/ar-ap-truth-lab`). |
| Contacts | `src/app/components/contacts/ContactsPage.tsx` | `title` on “Balance & GL notes” summarizing **two RPC families** and why they may differ. |

## Columns / badges added (summary)

- **Presentation**: existing `journalLinePresentation` labels (Document, Amount delta (PF-14), Transfer (PF-14), Reversal, Journal, …) plus product badge styling via `classifyAccountFlowBadge` (Primary / PF-14 / Reversal / Manual / Historical repair heuristic from description).
- **From → To**: derived for the **viewed line**: debit on this book → From = counterparty aggregate, To = this account; credit → reverse.
- **Economic meaning**: short phrase (e.g. “Amount edited (PF-14 delta)”, “Liquidity account changed”, “Receipt from customer”).
- **Economic event**: `journal_entries.economic_event_id` when present (truncated in UI).
- **Source type**: raw `je_reference_type`.
- **Edit target**: maps header type to “Payment”, “Sale”, “Purchase”, etc.

## Effective vs audit behavior

| Surface | Audit | Effective |
| --- | --- | --- |
| Account Ledger page | Switch **Audit (full weight)** on | Off: PF-14 **transfer** and **amount delta** rows **dimmed** (opacity); balance column still full GL truth. |
| Account Statements | **Row presentation: audit (full weight)** on (existing) | Off: same dimming for PF-14 rows (unchanged behavior, documented here). |
| Day Book | **Audit mode** on | Off: PF-14 transfer/delta lines dimmed (existing). |

**No GL lines are hidden** in any mode; dimming is presentation only.

## Transaction trace UX

- From **Transaction details**, payment-linked JEs: **Full payment trace** opens a sheet with payment id, `payment_account_id`, heuristic **expected vs actual** narrative, and counts of JEs / lines / mutations / allocations; **Open AR/AP Truth Lab** navigates to `/test/ar-ap-truth-lab`.
- Truth Lab already had repair / duplicate / effective-vs-audit blocks; no replacement of that UI.

## Routing / edit labels

- Where a row is payment-linked, primary edit CTA text is **Edit payment** (Account Ledger page, Account Statements actions, Day Book).
- Unified edit resolution remains in `unifiedTransactionEdit.ts` / `TransactionDetailModal` (payment editor vs document editor).

## Journal Entries list (Accounting → Journal Entries)

- **Unchanged layout** in this pass: the list still shows the existing **Debit → Credit** account pair column and type badges. **`metadata.actionFingerprint` / `economicEventId`** are now available on `AccountingEntry` for a future column without another API change.
- **Recommendation**: add a **Presentation** column in a follow-up using `journalEntryPresentationFromHeader(metadata.referenceType, metadata.actionFingerprint)`.

## Account Ledger dialog (Trial Balance drill-down)

- `AccountLedgerView.tsx` (modal) was **not** expanded in this pass; the **full Account Ledger page** is the canonical enriched view. Follow-up: align columns or embed the same table component.

## Remaining limitations

- **From / To** on multi-line JEs with **more than one counter account** shows **aggregated** counterparty labels (joined with ` · `). Expandable per–journal line detail remains a future enhancement.
- **Historical repair** detection uses **description heuristics** (`repair`, `live sql`, `PF-14 repair`, `corrective`) — not a DB flag.
- Party / supplier **statement RPC** rows may omit `economic_event_id` if not selected in those RPCs; UI shows **—** when missing.
- **Truth Lab navigation** from the trace sheet uses `history.pushState` + `popstate`; if the host shell does not react to `popstate` for test routes, use the sidebar link manually.

## Build result

```bash
npm run build
```

**Result (local):** exit code **0**. Vite production build completed in **~16s** (chunk size warnings only; PWA `generateSW` succeeded).

---

*Screenshots: add before/after captures of Account Ledger page and Account Statements when available.*
