# Phase C — Completion Report (2026-06-06)

**Status:** Complete (C1–C6 read-only tabs shipped locally)  
**Scope:** Accounting Developer Center report trace diagnostics — no writes, no repair queue, no migrations.

---

## Summary

Phase C adds five read-only diagnostic tabs to **Accounting Developer Center**, on top of Phase B (COA Health + Transaction Trace). All tabs are navigable via URL query params (`?tab=<slug>&q=<reference>`).

| Step | Tab | Slug | Status |
|------|-----|------|--------|
| C1 | Tab shells + URL routing | — | Done (PR #4) |
| C2 | Roznamcha Trace | `roznamcha` | Done (+ build fix: `roznamchaDedupe.ts`) |
| C3 | Statement Trace | `statement` | Done |
| C4 | Day Book Diagnostics | `daybook` | Done |
| C5 | Payment Trace | `payment` | Done |
| C6 | Journal Integrity (browse-only) | `journal` | Done |

**Out of scope (unchanged):** Repair Queue, Opening Balance sync, Audit Log, void/repair buttons in Developer Center. Writes remain in **Developer Integrity Lab** only.

---

## What was broken after GitHub pull (PR #5)

PR #5 (`feat/c2-roznamcha-trace`) refactored `roznamchaService.ts` to import dedupe logic from a new module but **did not commit the module**:

- Missing: `src/app/services/roznamchaDedupe.ts`
- Missing: `src/app/services/roznamchaService.dedupe.test.ts`
- Missing export: `isRcvReference()` in `src/app/lib/rentalPaymentRef.ts`

This caused `npm run build` to fail with `ENOENT roznamchaDedupe`.

---

## Files added / updated (this session)

### Build fix (C2 completion)

| File | Purpose |
|------|---------|
| `src/app/services/roznamchaDedupe.ts` | Pure dedupe logic (entity keys, movement merge) |
| `src/app/services/roznamchaService.dedupe.test.ts` | 8 dedupe unit tests |
| `src/app/lib/rentalPaymentRef.ts` | Added `isRcvReference()` |

### C3 — Statement Trace

| File | Purpose |
|------|---------|
| `src/app/lib/statementTraceDiagnostics.ts` | Inclusion reasons, exclusion probes |
| `src/app/lib/statementTraceDiagnostics.test.ts` | Unit tests |
| `src/app/components/admin/developer-center/StatementTraceTab.tsx` | UI |
| `accountingDeveloperCenterService.ts` → `loadStatementTraceSnapshot()` | Read facade |

### C4 — Day Book Diagnostics

| File | Purpose |
|------|---------|
| `src/app/lib/dayBookDiagnostics.ts` | Period balance + unbalanced voucher detection |
| `src/app/lib/dayBookDiagnostics.test.ts` | Unit tests |
| `src/app/components/admin/developer-center/DayBookDiagnosticsTab.tsx` | UI |
| `accountingDeveloperCenterService.ts` → `loadDayBookDiagnostics()` | Read facade |

### C5 — Payment Trace

| File | Purpose |
|------|---------|
| `src/app/lib/paymentTraceDiagnostics.ts` | Payment-first layout over Transaction Trace |
| `src/app/lib/paymentTraceDiagnostics.test.ts` | Unit tests |
| `src/app/components/admin/developer-center/PaymentTraceTab.tsx` | UI |
| `accountingDeveloperCenterService.ts` → `loadPaymentTraceSnapshot()` | Read facade |

### C6 — Journal Integrity (browse-only)

| File | Purpose |
|------|---------|
| `src/app/components/admin/developer-center/JournalIntegrityTab.tsx` | Browse UI — no void/repair |
| `accountingDeveloperCenterService.ts` → `loadJournalIntegrityBrowse()` | Uses `fetchJournalExplorer` (read-only) |

### Wiring

| File | Change |
|------|--------|
| `AccountingDeveloperCenterPage.tsx` | All C2–C6 tabs live (removed PhaseCTabShell placeholders) |
| `package.json` | `test:unit` includes C3–C5 test files |

---

## Verification

```bash
npm run test:unit   # 40/40 pass
npm run build       # pass
```

### Manual smoke checks

| Tab | URL example | Expected |
|-----|-------------|----------|
| Roznamcha | `?tab=roznamcha&q=HQ-RCV-0006` | Pre/post dedupe candidates, inclusion reasons |
| Statement | `?tab=statement&q=HQ-RCV-0006` | Contact auto-resolve, statement rows + exclusion probes |
| Day Book | `?tab=daybook&q=JE-0188` | Period balance card, unbalanced vouchers table |
| Payment | `?tab=payment&q=HQ-RCV-0006` | Payment-first sections, report visibility summary |
| Journal | `?tab=journal&q=JE-0012` | Browse-only JE list, severity badges, no action buttons |

### Safety checks

- [x] `developerAccountingAccess.ts` — unchanged
- [x] No imports of `integrityRepairService`, `postingDuplicateRepairService`, or repair apply paths in new tabs
- [x] No void / sync / apply buttons in C3–C6 tab DOM
- [x] No new migrations

---

## Architecture notes

```
AccountingDeveloperCenterPage
  ├── CoaHealthTab          (Phase B)
  ├── TransactionTraceTab   (Phase B)
  ├── RoznamchaTraceTab     (C2) → roznamchaService + roznamchaDedupe
  ├── StatementTraceTab     (C3) → customerLedgerAPI + exclusion probes
  ├── DayBookDiagnosticsTab (C4) → journal_entries lines + dayBookDiagnostics lib
  ├── PaymentTraceTab       (C5) → runTransactionTrace + paymentTraceDiagnostics
  └── JournalIntegrityTab   (C6) → fetchJournalExplorer (browse-only)
```

All data loading goes through `accountingDeveloperCenterService.ts` read facades — single audit surface for forbidden imports.

---

## Next steps (optional, not Phase C)

| Item | Phase | Notes |
|------|-------|-------|
| Repair Queue dry-run tab | D | Local handoff exists; intentionally not merged (write-adjacent) |
| `rpc_roznamcha_trace_candidates` | Perf | Defer unless client fetch is slow |
| Git commit + PR | — | User to commit when ready |

---

## Related docs

- [05_PHASE_C_IMPLEMENTATION_PLAN.md](./05_PHASE_C_IMPLEMENTATION_PLAN.md) — original plan
- [README.md](./README.md) — Developer Center index
- [ROZNAMCHA_DATA_SOURCES_AND_DUPLICATES.md](../../ROZNAMCHA_DATA_SOURCES_AND_DUPLICATES.md) — dedupe policy reference
