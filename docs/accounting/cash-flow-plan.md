# Cash Flow Tab — Design Plan (Accounting Module)

**Date:** 2026-06-12  
**Product:** DIN Collection ERP  
**Status:** CF-1 read-only tab implemented (Accounting → Cash Flow). Phase B GL summary strip pending.  
**Related:** [transaction-actions-analysis.md](./transaction-actions-analysis.md) · [transaction-actions-plan.md](./transaction-actions-plan.md)

---

## 1. Recommendation

Add a **Cash Flow** tab **inside Accounting** (not a separate top-level module), using a **hybrid phased** approach:

| Phase | Deliverable | Data source |
|-------|-------------|-------------|
| **Phase A** | Operational cash movement grid (primary user value) | [`roznamchaService.ts`](../../src/app/services/roznamchaService.ts) patterns + cash/bank filter |
| **Phase B** | GL activity-class summary strip (Operating / Investing / Financing) | Existing [`getCashFlowStatement`](../../src/app/services/accountingReportsService.ts) (~lines 935–1068) |

Phase A ships first. Phase B adds summary cards above the grid without replacing operational rows.

**Current gap:** `getCashFlowStatement` exists, excludes void JEs, has **zero UI callers**. Roznamcha covers operational cash but lives as a separate tab without module tags or unified action panel.

---

## 2. Tab placement

**Location:** [`AccountingDashboard.tsx`](../../src/app/components/accounting/AccountingDashboard.tsx) `allTabs`

Insert **`cash_flow`** after **`roznamcha`**, before **`accounts`**:

```
Journal Entries | Day Book | Roznamcha | Cash Flow | Accounts | …
```

**Rationale:** Cash Flow is operational cash with enriched metadata; Roznamcha remains the classic cash book. Users who want GL-class totals get Phase B strip on the same tab.

Optional later: sub-link under [`ReportsDashboardEnhanced.tsx`](../../src/app/components/reports/ReportsDashboardEnhanced.tsx) financial section — **not required for Phase A**.

---

## 3. Tab structure (UX)

```
Accounting → Cash Flow
├── Filters: date range, branch, cash/bank account, source module, normal/audit
├── Summary cards: Opening | Cash In | Cash Out | Net | Closing
├── Phase B strip: Operating / Investing / Financing (GL indirect) — when enabled
└── Row grid: date, ref, party, module, in, out, balance, badges, action panel
```

### 3.1 Filters

| Filter | Default | Notes |
|--------|---------|-------|
| Date range | Current month | Same presets as Roznamcha |
| Branch | All / selected | Match Accounting branch context |
| Cash/bank account | All liquid accounts | Subset of chart (1100-class, bank accounts) |
| Source module | All | Sales receipt, purchase payment, expense, rental, transfer, manual JE |
| Normal / audit | Normal | See §5 |

### 3.2 Summary cards (Phase A)

| Card | Source |
|------|--------|
| Opening | Opening balance for filtered cash/bank accounts in range |
| Cash In | Sum of inflows in grid |
| Cash Out | Sum of outflows |
| Net | In − Out |
| Closing | Opening + Net |

**Opening/closing helper:** Compose from [`getArApGlSnapshot().cashBankNetDrMinusCr`](../../src/app/services/accountingReportsService.ts) or account ledger net for selected liquid accounts.

### 3.3 Phase B summary strip

Call existing `getCashFlowStatement(startDate, endDate, branchId?)`:

- **Operating** — net from P&L-linked activity classes
- **Investing** — asset purchase/sale patterns
- **Financing** — liability/equity movements

Display as three cards **above** the operational grid. Indirect method; void JEs already excluded in service.

---

## 4. Row fields

| Column | Description |
|--------|-------------|
| Date | Transaction date |
| Reference | RCV-*, PAY-*, JE-*, REN-* |
| Party / contact | Customer, supplier, worker, or — |
| Source module | sales, purchases, expenses, rentals, transfers, manual |
| Cash account | Which bank/cash GL account moved |
| In | Debit to cash (money in) |
| Out | Credit to cash (money out) |
| Running balance | Cumulative for filtered account(s) |
| Status badge | live / voided / reversed |
| Branch | Branch name or “—” |
| Links | payment_id, journal_entry_id (internal) |

**Enrichment:** Tag each roznamcha-style row with source module by joining payment reference_type, expense_id, rental_payment_id, or manual JE metadata.

---

## 5. Normal vs audit mode

| Mode | Behavior | Align with |
|------|----------|------------|
| **Normal** | Exclude `voided_at` and `is_void` | [`roznamchaService`](../../src/app/services/roznamchaService.ts) `includeVoidedReversed=false` |
| **Audit** | Include voided/reversed; show paired original + cancellation rows; read-only grid | Roznamcha audit toggle, Day Book audit mode |

**Future (Phase 4 of transaction actions):** Shared `reportAuditMode` helper so Cash Flow, Roznamcha, and Account Statements use the same contract.

In audit mode:

- Voided payments show badge **voided**
- PF-14 `correction_reversal` rows visible with **reversed** badge
- No mutation actions on voided rows (View Audit only)

---

## 6. Transaction actions on cash flow rows

Row click opens shared **`TransactionActionPanel`** from [transaction-actions-plan.md](./transaction-actions-plan.md):

| Row type | Actions |
|----------|---------|
| Document-sourced (sale/purchase invoice JE) | Open Source Document, View Trace — **read-only** |
| Payment / expense / manual JE / transfer | Full panel: Edit, Cancel, Undo, Fix Link, View Audit |

**Cross-link:** View Trace → Developer Center `?tab=payment&q=RCV-…` pattern from [`FinancialTraceCenterPage`](../../src/app/components/accounting/FinancialTraceCenterPage.tsx).

Context passed to `getTransactionActions`: `context: 'cash_flow'`.

---

## 7. Data layer (future)

### 7.1 New thin service

**File (future):** `src/app/services/cashFlowReportService.ts`

Responsibilities:

1. Call roznamcha row builder with cash/bank account filter
2. Enrich rows with `sourceModule` tag
3. Compute opening/closing from GL snapshot or ledger net
4. Optional Phase B: delegate to `getCashFlowStatement` for summary strip
5. Apply [`roznamchaDedupe.ts`](../../src/app/lib/roznamchaDedupe.ts) — **prevent double-count** when payment and JE both appear

### 7.2 Reuse (no duplication)

| Existing | Reuse for |
|----------|-----------|
| `roznamchaService.getRoznamcha` | Row stream |
| `roznamchaDedupe` | Dedup payment vs JE legs |
| `paymentVoidVisibility` | Normal mode hiding |
| `FinancialReportPrintLayout` | Print layout |
| `financialTraceExport.ts` | CSV export patterns |

---

## 8. Edge cases

| Case | Handling |
|------|----------|
| **Voided payment still linked to live rental_payment** (REN-0002 class — Financial Trace D4/D5) | Audit mode shows both; normal hides voided leg; Fix Link suggestion on metadata mismatch |
| **PF-14 correction_reversal rows** | Audit mode only; badge **reversed**; no Edit |
| **Branch null** on payment/JE | Show row; suggest **Fix Branch** in action panel (metadata) |
| **Contact null** on payment | Show row; suggest **Fix Customer/Supplier Link** |
| **Transfers / manual JE** touching cash | Include via journal liquidity legs (roznamcha journal stream) |
| **Double-count prevention** | `roznamchaDedupe` — same rule as Roznamcha tab |
| **Multi-account filter** | Running balance per account or combined — **default: single account** for meaningful running balance |
| **Walk-in / unmapped party** | Show reference; link to Financial Trace classification |

---

## 9. Files to touch (implementation phase — not changed now)

| File | Change |
|------|--------|
| **New** `src/app/components/reports/CashFlowReportPage.tsx` | Tab content component |
| **New** `src/app/services/cashFlowReportService.ts` | Data composition |
| [`AccountingDashboard.tsx`](../../src/app/components/accounting/AccountingDashboard.tsx) | Add `cash_flow` to `allTabs` + render block |
| [`transactionActionRules.ts`](../../src/app/lib/transactionActionRules.ts) | `cash_flow` context (Phase 1 of actions plan) |
| Optional: [`ReportsDashboardEnhanced.tsx`](../../src/app/components/reports/ReportsDashboardEnhanced.tsx) | Financial sub-tab link |

**No migrations required** for Phase A or Phase B (read-only reports + existing services).

---

## 10. Phased delivery

| Step | Scope | Depends on |
|------|-------|------------|
| CF-1 | `CashFlowReportPage` + tab wiring + Phase A grid | Approval of this doc |
| CF-2 | Summary cards (opening/closing) | CF-1 |
| CF-3 | Source module column + filters | CF-1 |
| CF-4 | Row click → `TransactionActionPanel` | Transaction actions Phase 1 |
| CF-5 | Phase B GL summary strip | CF-1 |
| CF-6 | Print / CSV export | CF-1 |

**Risk:** Low–medium. Read-only data composition; action panel is label/handler wiring only.

---

## 11. Differentiation from Roznamcha

| Aspect | Roznamcha | Cash Flow |
|--------|-----------|-----------|
| Primary audience | Classic cash book | Management view with module breakdown |
| Module tag | No | Yes (sales, expense, rental, …) |
| GL summary | No | Phase B Operating/Investing/Financing |
| Action panel | Limited | Shared `TransactionActionPanel` |
| Filters | Date, branch, audit | + cash account, source module |

Both tabs may coexist; Cash Flow is the **enriched operational view**, not a replacement for Roznamcha in Phase A.

---

## 12. Approval gate

**Do not implement until:**

1. [transaction-actions-plan.md](./transaction-actions-plan.md) Phase 1 approved (for row actions), **or** CF-1 shipped read-only without actions
2. This cash-flow plan approved

**This documentation phase:** no code, no migrations, no deploy.

See [transaction-actions-analysis.md](./transaction-actions-analysis.md) for current report filtering and roznamcha/cash-flow backend inventory.
