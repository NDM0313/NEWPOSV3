# Phase C — Report trace tabs (read-only)

**Status:** Plan only — do not implement until approved after Phase B sign-off.  
**Prerequisite:** Phase B + B.1 Transaction Trace patch merged (`feat(accounting): add read-only accounting developer center`).

---

## 1. Goal

Enable the **placeholder tabs** on Accounting Developer Center as **read-only diagnostics** — deeper report-boundary explanation without repair queue, void, sync, or GL posting changes.

| Tab | Phase C deliverable |
|-----|---------------------|
| Roznamcha Trace | Why a ref appears / is deduped / excluded in Roznamcha for a date range |
| Statement Trace | Party statement row inclusion rules for a contact + ref |
| Day Book | Unbalanced JE panel + line-level Day Book inclusion |
| Journal Integrity | Read-only subset of Integrity Lab explorer (no void/repair) |
| Payment Trace | Alias/wrapper over Transaction Trace with payment-first layout |

**Still disabled in Phase C:** Repair Queue, Opening Balance sync, Audit Log writes, any apply/void/seed actions.

---

## 2. Hard boundaries (unchanged)

- No migrations unless perf-proven and additive-only (read RPCs).
- No edits to `record_payment_with_accounting`, GL triggers, or sale/rental finalize paths.
- No imports from `integrityRepairService`, `postingDuplicateRepairService`, `openingBalanceJournalService` apply paths.
- `canAccessDeveloperIntegrityLab` / `developerAccountingAccess.ts` — **unchanged**.
- Developer Integrity Lab remains the **only** write/repair surface.

---

## 3. Implementation sequence

| Step | Task | Files (indicative) |
|------|------|-------------------|
| C1 | Enable tab shells; wire query params `?tab=roznamcha&q=` | `AccountingDeveloperCenterPage.tsx` |
| C2 | **Roznamcha Trace** — reuse `roznamchaService` fetch + dedupe keys; show pre/post dedupe row list | `RoznamchaTraceTab.tsx`, extend `accountingDeveloperCenterService` |
| C3 | **Statement Trace** — party ledger ref rules + `customerLedgerApi` read paths | `StatementTraceTab.tsx` |
| C4 | **Day Book** — unbalanced JE list from `DayBookReport` logic (read-only) | `DayBookDiagnosticsTab.tsx` |
| C5 | **Journal Integrity** — embed read-only JE explorer (filter by ref/date; no void button) | `JournalIntegrityTab.tsx`, thin wrapper over `developerAccountingDiagnosticsService` |
| C6 | **Payment Trace** — composition of Transaction Trace sections payment-first | `PaymentTraceTab.tsx` or refactor `TransactionTraceTab` |
| C7 | Unit tests for new visibility/dedupe helpers; `npm run build` | `*.test.ts` |
| C8 | Manual verification matrix (HQ-RCV-0006, SL payment, expense PAY, OB JE) | `05_PHASE_C_VERIFICATION.md` |

**Recommended:** One PR per tab (C2–C6) after C1 shell, or single Phase C PR if scope stays read-only and &lt; ~800 LOC.

---

## 4. Service layer

Extend `accountingDeveloperCenterService.ts` only with **read** facades:

```text
loadRoznamchaTraceSnapshot(companyId, query, dateFrom, dateTo, branchId?)
loadStatementTraceSnapshot(companyId, contactId, query)
loadDayBookDiagnostics(companyId, dateFrom, dateTo)
loadJournalIntegrityBrowse(companyId, filters)  // no mutate exports
```

Forbidden imports: same list as Phase B facade audit.

---

## 5. Access & navigation

No change to `accountingDeveloperCenterAccess.ts` role matrix.  
Placeholder spans become `TabsTrigger` with `disabled={false}` only when tab component ships.

---

## 6. Verification (Phase C exit)

| Check | Method |
|-------|--------|
| Roznamcha Trace explains HQ-RCV-0006 dedupe | Manual + unit fixture from `roznamchaService.dedupe.test.ts` |
| Statement Trace shows contact_id gaps | Manual RCV/on_account sample |
| Day Book lists unbalanced JEs only | Compare with Day Book report |
| No repair/void buttons in DOM grep | CI script or manual |
| Integrity Lab access unchanged | `git diff developerAccountingAccess.ts` empty |
| `npm run test:unit` + `npm run build` | CI |

---

## 7. Rollback

Revert Phase C commit(s); Phase B tabs (COA Health, Transaction Trace) remain. No DB rollback.

---

## 8. Approval before coding

- [ ] User confirms Phase C tab priority order (Roznamcha → Statement → Day Book recommended)
- [ ] Confirm Journal Integrity tab is read-only browse only (no Integrity Lab redirect that widens write access)
- [ ] Confirm no RPC unless COA Health perf requires it (defer)
