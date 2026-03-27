# ERP Reports — UI Behavior Specification

**Project:** NEWPOSV3  
**Last updated:** 2026-03-27  
**Audience:** Frontend engineers, QA, product, finance UAT  
**Purpose:** Contract for **what each report shows**, **how filters behave**, and **effective vs audit** presentation — not only formulas.

---

## Section 1 — Reporting philosophy

- **Raw GL** is correct for accountants; **most users** need **operational** clarity (invoice, payment, balance) without dumping every JE line.
- **Roll up** on Balance Sheet and TB **summary** modes for AR/AP families; **expand** only when user asks for subledger detail.
- **History** (reversals, voids, technical adjustments) belongs in **audit** toggles or dedicated Journal views — not default customer-facing statements.
- **Party-facing** PDFs should read like **statements**, not database exports.

---

## Section 2 — Trial Balance

| Aspect | Spec |
|--------|------|
| **Purpose** | Prove double-entry; list account totals for a period |
| **Data source** | `journal_entry_lines` + `journal_entries` + `accounts`; voided JEs excluded |
| **Flat mode** | One row per account with activity |
| **Summary mode** | AR family + AP family each **one** rolled row (`(subledger total)` label); **totals unchanged** vs flat |
| **Expanded mode** | AR block then AP block; control row + indented children |
| **Worker / cash** | **Roadmap:** same family pattern as AR/AP — until then, flat only for `2010`/`1180`/banks |
| **Double count** | User must **not** add a “subtotal row” that sums parent+children again; modes **replace** or **reorder**, not duplicate debits/credits |
| **Filters** | Date range, branch (with NULL-branch = company-wide rule) |
| **Export** | CSV/print: include mode in header |

---

## Section 3 — Balance Sheet

| Aspect | Spec |
|--------|------|
| **Purpose** | Position as at date: assets, liabilities, equity + NI to date |
| **Data source** | TB inception→as-of; grouping via `classifyBalanceSheetAsset` / `classifyBalanceSheetLiability` |
| **AR/AP** | **Single line** per control; **children omitted** from list; **rolled** balance |
| **Party drilldown** | From `1100`/`2000` row → breakdown modal / recon (not second BS line per party) |
| **Cash/bank** | Group label from BS asset group `cash_bank` |
| **Inventory** | Typically `1200` under inventory group |
| **No duplicate children** | Enforced in `getBalanceSheet` |

---

## Section 4 — Profit & Loss

| Aspect | Spec |
|--------|------|
| **Purpose** | Period performance: revenue − COGS − opex |
| **Revenue** | All accounts typed revenue/income |
| **Cost of sales** | Codes `5000`,`5010`,`5100`,`5110` (+ name hints) — **not** `5200`/`5300` |
| **Discount allowed / extra expense** | **Operating expenses** section |
| **Shipping income** | Revenue line from account **`4110`** |
| **Product revenue** | **`4000` and/or `4100`** until merge — show both lines if both used |
| **Adjustments** | Default view: **account totals** only; optional expand for `sale_adjustment` impact per roadmap |
| **Naming** | Use account **name** from COA; map code 4110 label “Shipping Income” in legend if needed |

---

## Section 5 — General Ledger / Journal / Day Book

| Aspect | Spec |
|--------|------|
| **Purpose** | Audit trail and running balance per account |
| **Behavior** | **Audit-first** — show void, reference_type, entry_no |
| **Sort** | `entry_date` ASC, then `created_at` / stable id tie-breaker |
| **Reversal** | Show reversal entries; link original where PF-14.3B root grouping exists |
| **Edit launch** | Use `resolveUnifiedJournalEdit` — **no** edit on void/correction_reversal |
| **Day Book / Roznamcha** | Roznamcha may be **payments-centric** per policy lock — label difference from pure JE list |

---

## Section 6 — Account statements (statement center)

| Aspect | Spec |
|--------|------|
| **Types** | GL account statement (journal), party statements (separate entry points) |
| **Selection** | Account picker + date range + branch |
| **Apply pattern** | Primary: account + dates **auto-run** or single **Apply** — match existing page (e.g. `AccountLedgerReportPage`) |
| **Summary cards** | Opening, debits, credits, closing — must match line math |
| **Footer** | Same totals as cards |

---

## Section 7 — Customer / supplier / worker statements

### 7.1 Principles

- **One business document = one effective row** (invoice, bill, rental charge as designed).
- **Payments** separate rows with method/ref.
- **Party name** from **`contacts`** / worker name — not synthetic-only display.
- **Closing balance** = opening + sum(aligned signed amounts); tolerance zero.

### 7.2 Customer

| Mode | Content |
|------|---------|
| **Operational** | Sales + payments + rentals per `customerLedgerAPI` rules |
| **GL (AR)** | Journal lines on party `AR-*` or fallback `1100` scoped to contact |

**Adjustments:** Effective: net or single net line per business decision; Audit: show `sale_adjustment` lines.

### 7.3 Supplier

**Operational** may use `ledger_master` paths — **label** “non-GL” if not journal-only.

### 7.4 Worker

**Operational:** `worker_ledger_entries`.  
**GL:** lines on `2010`/`1180` + `worker_payment` refs.  
**Do not** present both as one engine without tabs.

### 7.5 Opening balance

Show **explicit opening row** when opening-balance JEs or contact opening exists.

---

## Section 8 — Cash / bank statements

- Filter by **account** (`1000`/`1010`/`1020` or extra bank children).
- **Source label:** Payment, transfer, manual JE — from `reference_type` + payment link.
- **Transfers:** Two lines (out + in) or one paired JE — show **clear contra** in audit.
- **Reversals:** Voided payment **excluded** from effective running balance.

---

## Section 9 — Receivables / payables / aging

| View | Source | Notes |
|------|--------|-------|
| Receivables summary | Sales dues + optional GL `1100` tie-out strip | Show **variance** if recon enabled |
| Payables summary | Purchases dues + GL `2000` |
| Aging | **Recommended:** document-based (invoice due date) | Footnote GL AR control |

**Voided payments:** Excluded from “collected” in effective aging.

---

## Section 10 — Filter rules

| Selector | Behavior |
|----------|----------|
| Statement type | **Auto-fetch** on change |
| Account / contact | **Auto-fetch** when primary context |
| Branch / date range | **Auto-fetch** or Apply per page consistency |
| Module, polarity, search | **Apply** (secondary) |
| Include reversals / void / adjustments | **Apply**; default **off** on party printable |
| Include manual JEs | **Apply** toggle on audit GL |

---

## Section 11 — Sorting rules

Global order:

1. **Business date** (`entry_date` / `invoice_date` / `payment_date`)  
2. **Time** (`created_at` / posted time) if present  
3. **Stable id** (`id` UUID) as final tie-breaker  

Apply to: journal list, day book, ledger lines, payment history, merged statements.

---

## Section 12 — Adjustment / reversal presentation

| Rule | Detail |
|------|--------|
| **Truth** | Hiding rows in **effective** mode does **not** change stored journals |
| **Effective** | Net amounts into main document/payment story |
| **Audit** | Full detail; void clearly marked |
| **Balance** | Running balance in effective view must equal **closing** derived from same rules |

---

## Section 13 — Edit from reports

| Surface | Edit? | Resolver |
|---------|-------|----------|
| Statement row | **Launch only** | Opens source document or payment editor |
| Journal row | Yes | `resolveUnifiedJournalEdit` |
| Transaction detail modal | Yes | Same resolver |
| Derived “total” row | **No** | Disabled or hidden |

---

## Section 14 — Export / print

| Doc | Print |
|-----|-------|
| Customer effective | Invoices + payments + **closing balance**; hide voided payments |
| Customer audit | Optional second PDF with JE refs |
| Supplier shareable | Same pattern |
| TB/BS/P&L | Include company name, period, branch footnote |

---

## Section 15 — UX cleanup recommendations

- Prefer **dense tables** over decorative charts on accounting pages.  
- Badges: `Void`, `Adjusted`, `On-account`, `GL`, `Operational`.  
- **Expand** row for JE detail on hover/click optional.  
- TB mode: clear radio **Flat | Summary | Expanded** with short tooltip.

---

## Section 16 — Deliverable quality

This spec is the **contract** for:

- Implementing **consistent** filters and modes.  
- QA **acceptance** (“effective statement balance matches footer”).  
- Debugging **“wrong total”** (check mode, void filter, operational vs GL).

---

## Per-report quick index

| # | Report | Primary spec section |
|---|--------|----------------------|
| 1 | Trial Balance | §2 |
| 2 | Balance Sheet | §3 |
| 3 | P&L | §4 |
| 4 | General Ledger | §5 |
| 5 | Journal Entries | §5 |
| 6 | Day Book / Roznamcha | §5 + policy doc |
| 7 | Account statements | §6 |
| 8 | Customer statement | §7.2 |
| 9 | Supplier statement | §7.3 |
| 10 | Worker statement | §7.4 |
| 11 | Cash/Bank | §8 |
| 12 | Receivables summary | §9 |
| 13 | Payables summary | §9 |
| 14 | Aging | §9 |
| 15 | Drilldown/export | §14 |

---

## Reports still needing deeper dedicated specs

- **Inventory valuation vs BS inventory** — reconciliation UI contract (`REPORTING_RECONCILIATION.md` extended per screen).  
- **Studio production costing report** — if exposed as standalone report.  
- **Commission report** — filter and “posted vs pending” spec when batch posting varies.

## Legacy UI / parity

- **`CustomerLedgerTestPage` / test harness** — not canonical for prod behavior.  
- **GenericLedgerView** supplier paths — legacy naming until unified with GL tab.  
- **TB worker/cash expanded** — **legacy gap** until parity with AR/AP modes; document “flat only” in release notes until shipped.

---

*End of UI behavior spec.*
