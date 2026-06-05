# Phase C — Report trace tabs (read-only)

**Status:** Priorities **approved** — **do not implement until Phase B PR is opened, reviewed, and merged.**  
**Prerequisite:** Phase B + B.1 merged (`feat(accounting): add read-only accounting developer center` on `feat/accounting-developer-center`).

---

## 1. Goal

Enable the **placeholder tabs** on Accounting Developer Center as **read-only diagnostics** — deeper report-boundary explanation without repair queue, void, sync, or GL posting changes.

### Approved tab priority (ship order)

| # | Tab | Phase C deliverable |
|---|-----|---------------------|
| 1 | **Roznamcha Trace** | Why a ref appears / is deduped / excluded in Roznamcha for a date range |
| 2 | **Statement Trace** | Party statement row inclusion rules for a contact + ref |
| 3 | **Day Book Diagnostics** | Unbalanced JE panel + line-level Day Book inclusion |
| 4 | **Payment Trace** | Payment-first layout (composition over Transaction Trace data) |
| 5 | **Journal Integrity** | Browse-only JE explorer (filter by ref/date; **no void/repair**) |

**Permanently out of scope:** Repair Queue, Opening Balance sync, Audit Log writes, void, sync, seed, archive, OB sync, numbering fix, or apply buttons.

---

## 2. Strict boundaries

- **Read-only diagnostics only** — no write paths from Developer Center tabs.
- No Repair Queue.
- No void, sync, seed, archive, OB sync, numbering fix, or apply buttons.
- No GL posting changes.
- No `record_payment_with_accounting` changes.
- No migrations unless performance proves an **additive read-only RPC** is required.
- No repair service imports (`integrityRepairService`, `postingDuplicateRepairService`, `openingBalanceJournalService` apply paths, `PartyTieOut` repair panels, etc.).
- `developerAccountingAccess.ts` — **must remain unchanged**.
- **Journal Integrity** — browse-only; must **not** widen access to old write tools or redirect into Integrity Lab repair flows.
- Developer Integrity Lab remains the **only** write/repair surface.

---

## 3. Recommended workflow

### PR strategy

| PR | Scope | Gate |
|----|-------|------|
| **C1** | Tab shells only — enable placeholders, wire `?tab=roznamcha&q=` query params; tabs show “coming soon” or empty read-only shell | Phase B merged |
| **C2** | Roznamcha Trace (first live tab) | C1 merged |
| **C3** | Statement Trace | C2 merged |
| **C4** | Day Book Diagnostics | C3 merged |
| **C5** | Payment Trace | C4 merged |
| **C6** | Journal Integrity browse-only | C5 merged |

**One PR per tab** after C1. Do not batch multiple live tabs in a single PR unless explicitly re-scoped.

### Per-tab exit criteria (required every PR)

- [ ] Unit tests for new helpers / visibility / dedupe logic
- [ ] `npm run test:unit` pass
- [ ] `npm run build` pass
- [ ] Manual verification notes in PR description (refs + expected behavior)
- [ ] `git diff` — no repair service imports; `developerAccountingAccess.ts` unchanged
- [ ] DOM / UI grep — no void, repair, sync, seed, archive, apply buttons on new tab

---

## 4. Implementation sequence

| Step | Task | Files (indicative) |
|------|------|-------------------|
| **C1** | Tab shells; query params `?tab=roznamcha&q=`; placeholders → navigable shells (content deferred) | `AccountingDeveloperCenterPage.tsx` |
| **C2** | **Roznamcha Trace** — reuse `roznamchaService` fetch + dedupe keys; pre/post dedupe row list | `RoznamchaTraceTab.tsx`, extend `accountingDeveloperCenterService` |
| **C3** | **Statement Trace** — party ledger ref rules + `customerLedgerApi` read paths | `StatementTraceTab.tsx` |
| **C4** | **Day Book Diagnostics** — unbalanced JE list from `DayBookReport` logic (read-only) | `DayBookDiagnosticsTab.tsx` |
| **C5** | **Payment Trace** — payment-first composition of Transaction Trace sections | `PaymentTraceTab.tsx` |
| **C6** | **Journal Integrity** — read-only JE browse via `developerAccountingDiagnosticsService` (no void button, no Integrity Lab write redirect) | `JournalIntegrityTab.tsx` |

---

## 5. Service layer

Extend `accountingDeveloperCenterService.ts` only with **read** facades (add per tab PR):

```text
loadRoznamchaTraceSnapshot(companyId, query, dateFrom, dateTo, branchId?)   # C2
loadStatementTraceSnapshot(companyId, contactId, query)                       # C3
loadDayBookDiagnostics(companyId, dateFrom, dateTo)                           # C4
loadPaymentTraceSnapshot(companyId, query)                                    # C5
loadJournalIntegrityBrowse(companyId, filters)                                # C6 — no mutate exports
```

Forbidden imports: same list as Phase B facade audit.

---

## 6. Access & navigation

No change to `accountingDeveloperCenterAccess.ts` role matrix.  
C1: placeholder `TabsTrigger` elements become navigable shells.  
C2–C6: enable tab content only when that tab’s PR merges (`disabled={false}` when component ships).

---

## 7. Verification matrix (Phase C exit)

| Check | Method | Tab |
|-------|--------|-----|
| Roznamcha Trace explains HQ-RCV-0006 dedupe | Manual + unit fixture from `roznamchaService.dedupe.test.ts` | C2 |
| Statement Trace shows contact_id / ref gaps | Manual RCV / on_account sample | C3 |
| Day Book lists unbalanced JEs only | Compare with Day Book report | C4 |
| Payment Trace payment-first layout | Manual RCV-0005, expense PAY sample | C5 |
| Journal Integrity browse-only (no void/repair) | Manual JE-0012, JE-0193; confirm no write UI | C6 |
| No repair/void buttons in DOM | CI script or manual grep | all |
| Integrity Lab access unchanged | `git diff developerAccountingAccess.ts` empty | all |
| `npm run test:unit` + `npm run build` | CI | all |

Optional doc: `06_PHASE_C_VERIFICATION.md` per tab PR notes.

---

## 8. Rollback

Revert Phase C commit(s); Phase B tabs (COA Health, Transaction Trace) remain. No DB rollback.

---

## 9. Approvals (recorded)

- [x] Tab priority: Roznamcha → Statement → Day Book → Payment → Journal Integrity (browse-only)
- [x] Journal Integrity is browse-only only (no Integrity Lab redirect that widens write access)
- [x] No RPC unless perf-proven additive read-only need (defer)
- [x] Workflow: C1 shell PR first, then one PR per tab
- [ ] Phase B PR merged (gate before any C1 coding)
