# 45. Worker Balance Source-of-Truth — Formal Decision

**Date:** 2026-04-12  
**Resolution:** Dual-source architecture is formally accepted; no single canonical source for all contexts

---

## The Two Sources

### Source A — Operational Ledger: `worker_ledger_entries`

**Access method:** `studioService.getWorkersWithStats().pendingAmount`  
**Computation:** `SUM(amount) WHERE status != 'paid'` per worker  
**Used by:**
- `StudioWorkflowPage.tsx` — "Pending Payments" card with explicit disclaimer
- `StudioWorkflowPage.tsx` — Per-worker "Due Balance" column
- `ContactsPage.tsx` Phase 1 worker balances (post Task 4 cutover)

**What it represents:** "What does the studio operationally owe this worker for completed stages, net of payments recorded in the worker ledger?"  

**Advantages:** Fast, no GL join needed, tracks stage-level job allocation

**Diverges from GL when:**
- Stage cost is edited after completion (GL updated via reversal JE; ledger not automatically synced)
- Manual GL corrections affect account 2010 (no ledger counterpart)
- Pay-Now-Full shortcut path skips a ledger payment row insertion

---

### Source B — GL Account 2010 (Worker Payable): `journal_entry_lines`

**Access method:** `studioCostsService.getStudioCostsFromJournal()` → reads account 2010 net  
**Computation:** `SUM(Cr 2010) - SUM(Dr 2010)` from active JEs, reference_type = studio_production_stage  
**Used by:**
- `WorkerDetailPage.tsx` — "Remaining Due (Payable)" card (primary source, ledger as fallback)
- Finance/accounting reconciliation

**What it represents:** "What is the posted GL liability for this worker in the chart of accounts?"

**Advantages:** Authoritative for audit, accounts for reversals, GL-balanced

**Diverges from operational ledger when:** (same scenarios above, plus)  
- Worker advance (account 1180) partially offsets the payable — ledger doesn't track advance allocation

---

## Decision

**Both sources are valid for their context.** This is a deliberately layered model:

| Context | Source | Label in UI |
|---------|--------|-------------|
| Studio workflow / pipeline operations | `worker_ledger_entries` | "Studio Due" / "Pending Stages" |
| Accounting / finance reconciliation | GL account 2010 | "GL Payable" / "Accounting Payable" |
| Worker detail page | GL (primary), ledger (fallback) | "Remaining Due (Payable)" |
| Contacts page (worker payables) | `worker_ledger_entries` (Phase 1) → RPC (Phase 2) | "Payable" |

**The system MUST NOT claim either source is universally accurate.** Both can diverge.

---

## Current UI State (No Changes Required)

### `StudioWorkflowPage.tsx` — ✅ Already correctly labeled

Lines 332-338 show:
```
"Pending Payments"  [heading]
"Rs {totalPendingAmount}"
"Sum of unpaid worker_ledger_entries (studio operational). 
 Not GL 2010 / not Contacts payables — use Worker ledger 
 or party GL for journal tie-out."  [disclaimer]
```
This is the correct label + disclaimer combination. No change needed.

### `WorkerDetailPage.tsx` — ✅ Already using GL as primary

Lines 432-452 show "Remaining Due (Payable)" sourced from `studioCostsService.getWorkerCostSummaries()` (GL-based) with ledger as fallback. No change needed.

### `ContactsPage.tsx` — ✅ Fixed in Task 4

Phase 1 now reads from `worker_ledger_entries` (operational). Phase 2 canonical RPC overwrites. Consistent with the operational ledger decision for workflow contexts.

---

## Known Reconciliation Gaps

| Gap | Impact | Resolution |
|-----|--------|-----------|
| Stage cost edit: GL reversal + new JE; ledger NOT updated | Ledger shows old amount; GL shows new | Accept for now; document for future sync job |
| Pay-Now-Full: GL updated; ledger may skip payment row | Ledger still shows owed; GL shows settled | `markStageLedgerPaid()` call covers this in most paths |
| Manual GL correction (account 2010): no ledger counterpart | GL and ledger permanently diverge | Use GL (studioCostsService) as authoritative |
| Worker advance (1180) settlement: partial GL offsets | GL net = correct; ledger = original amounts | Ledger doesn't track advance allocation |

---

## Guidance for Future Screens

- **Production cost reporting** → Use `studioCostsService.getStudioCostsFromJournal()` (GL truth)
- **Worker payment workflow** → Use `worker_ledger_entries` for pending stage list; GL for total payable confirmation
- **AP subledger / supplier payables** → Use party subledger GL accounts (not worker ledger)
- **Payroll export** → Use `worker_ledger_entries` for per-stage breakdown; GL for totals

If a future screen needs the two sources reconciled in real-time, implement a reconciliation view that compares `studioCostsService` output vs `getWorkersWithStats()` and flags divergence > threshold.

---

## Service JSDoc Updates

The following service methods should have their JSDoc updated to reflect the source:

- `studioService.getWorkersWithStats()`: Add note "Source: worker_ledger_entries operational ledger. Not GL account 2010."
- `studioCostsService.getStudioCostsFromJournal()`: Add note "Source: journal_entry_lines (GL account 5000/2010). Authoritative for audit."

These JSDoc updates are low-priority and can be done in a maintenance pass.
