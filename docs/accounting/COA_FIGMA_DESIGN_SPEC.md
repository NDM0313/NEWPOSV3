# Chart of Accounts & accounting navigation — Figma design specification

**Date:** 2026-04-05  
**Audience:** Design (Figma), product, engineering alignment  
**Canonical truth:** See [FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md](./FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md) and [COA_FIGMA_REDESIGN_BRIEF.md](./COA_FIGMA_REDESIGN_BRIEF.md).

This document translates engineering-verified architecture into **screen architecture**, **components**, **flows**, and **Figma framing** for a premium ERP-grade COA redesign (desktop + mobile planning).

**Design execution (Figma build):** Use **[COA_FIGMA_EXECUTION_PACK.md](./COA_FIGMA_EXECUTION_PACK.md)** for the consolidated **screen map**, **component inventory**, **annotated frame list**, **desktop/mobile layout notes**, **semantic labels**, and **resolved ambiguities** checklist.

---

## Canonical vs legacy (design non-negotiables)

| Use as live truth | Do **not** use for live UX |
|-------------------|----------------------------|
| `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries` | `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`, `accounting_settings`, `ledger_master`, `ledger_entries`, `backup_cr_*`, `backup_pf145_*` |
| RPCs: `get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics` | Any shadow COA or duplicate posting story |

---

## 1. Screen architecture

### 1.1 Primary map (desktop)

```
Accounting Hub (overview)
├── Chart of Accounts (tree / list)
├── Account Detail (per account)
├── Control drill-down (AR | AP | Worker Payable | …)
├── Journals (list / entry)
├── Statements / GL activity view
├── Receivables (customer — operational + roll-up context)
├── Payables (supplier + worker slices — labeled)
└── Executive / dashboard entry (cards with basis chips — existing RPC semantics)
```

### 1.2 Information hierarchy (always visible somewhere)

1. **Scope:** Company | Branch (chip, persistent on accounting surfaces).  
2. **Basis:** GL | Operational due | Contact roll-up (chip on every KPI/table that shows money).  
3. **Context:** Account code + name + type (never code alone for money decisions).

### 1.3 Mobile companion scope (not full ERP)

- **In:** Hub snapshot, COA browse (collapsed tree), account detail summary + last GL lines, receivables/payables **summary** with basis chips, alerts / quick drill to web.  
- **Out:** Full statement reconciliation, bulk journal entry, complex multi-filter analysis (defer or simplify to presets).

---

## 2. Component list

### 2.1 Global / shell

| Component | Purpose |
|-----------|---------|
| **App shell — accounting** | Left nav or top tab group: Hub, COA, Journals, Receivables, Payables, Statements. |
| **Scope chip** | `Company-wide` \| `Branch: {name}`; ties to branch filter state. |
| **Basis chip** | `GL` \| `Operational` \| `Contact roll-up`; color-coded, not decorative. |
| **Semantic strip** | Optional row under page title: scope + basis + period. |
| **Breadcrumb** | Hub → COA → {Account} → Journal → Source doc. |

### 2.2 COA tree / list

| Component | Purpose |
|-----------|---------|
| **Summary header** | Filtered total accounts, optional “GL net” only when basis = GL. |
| **Category group** | Collapsible: Assets, Liabilities, Equity, Revenue, Expense, COGS / Production (map to real `accounts` taxonomy). |
| **Tree row** | Indent, expand chevron, code, name, type badge, control/detail badge, active/inactive, optional balance column (only if basis = GL). |
| **Row actions** | Kebab: View detail, View GL activity (not “open legacy ledger”). |
| **Toolbar** | Search (code/name), filters (type, control/detail, active), sort (code, name, type). |
| **Empty state** | “No accounts in this branch scope” vs “No search results.” |

### 2.3 Account detail

| Component | Purpose |
|-----------|---------|
| **Summary card** | Code, name, type, parent link, control/detail, system/inactive badges, **GL balance** (if applicable) with `Basis: GL` chip. |
| **Tab: GL activity** | Journal lines table, period filter, running balance column, link to journal entry. |
| **Tab: Operational context** | Only for AR/AP/worker-related accounts: show **operational** or **contact roll-up** with correct basis chip; no mixing in one column without sub-rows. |
| **Linked documents** | From journal line → sale, purchase, payment, allocation as applicable. |

### 2.4 Control account drill-down

| Component | Purpose |
|-----------|---------|
| **Control header** | “Accounts Receivable (control)” + explainer: “Rolls up: customer detail accounts” + **Direct posting: Allowed / Not allowed** (per product rules). |
| **Sub-account list** | Detail accounts under control; each row balance with basis chip. |
| **Party lens (optional tab)** | Customer receivable → list by contact with **Contact roll-up** basis; Worker payable → **Worker payable** label, not generic “payables.” |

### 2.5 Accounting hub

| Component | Purpose |
|-----------|---------|
| **Quick links grid** | COA, Journals, Receivables, Payables, Statements, Reports. |
| **Executive cards row** | Each card: title + value + **basis chip** + scope chip + “View breakdown.” |
| **Semantic legend** | Compact “What these numbers mean” expandable. |

### 2.6 Statement / GL ledger view

| Component | Purpose |
|-----------|---------|
| **Statement header** | Title, period, scope chip, basis chip (always GL here). |
| **Running balance table** | Date, doc ref, description, debit, credit, balance, source link. |
| **Footer** | Period totals, reconciliation hint. |

### 2.7 Filters & export

| Component | Purpose |
|-----------|---------|
| **Filter drawer / bar** | Date range, branch, basis, account type, status. |
| **Active filter chips** | Removable tags mirroring selections. |
| **Export / print** | Repeats scope, basis, period, generated timestamp in header block. |

### 2.8 Badges (visual system)

| Badge | Use |
|-------|-----|
| **Control** | Aggregates detail accounts. |
| **Detail** | Posting target under a control. |
| **Cash / Bank** | Liquidity accounts. |
| **Revenue / Expense / Asset / Liability / Equity** | Type taxonomy. |
| **Inactive** | Non-posting or hidden from default lists. |
| **System** | Seeded / protected configuration. |

**Style:** Outline + subtle fill, 4.5:1 contrast on dark backgrounds; pair **icon + text** for type badges where space allows.

---

## 3. User flow

### 3.1 Primary: Explore COA → GL → source

1. User opens **Accounting Hub** → sees scope + executive cards (each labeled by basis).  
2. Taps **Chart of Accounts** → tree grouped by category; search narrows rows.  
3. Opens **Account detail** → **GL activity** tab default for balance accounts; sees journal lines + running balance.  
4. Clicks journal line → **Journal entry** detail → **Source document** (sale, payment, etc.).  

### 3.2 Receivables / payables (operational vs GL)

1. From Hub → **Receivables** → default basis **Operational** or **Contact roll-up** (per screen purpose); chip locked or user-switchable **only** with table column reset.  
2. From Hub → **Payables** → separate entry or sub-nav for **Supplier payable** vs **Worker / studio payable** (never one unlabeled list).  
3. Optional “Compare to GL” secondary action opens **split view** or modal with **two** columns, each with its own basis chip.

### 3.3 Control drill-down

1. User opens **Accounts Receivable (control)** from COA or Hub shortcut.  
2. Sees **detail accounts** list + optional **By customer** view (contact roll-up).  
3. Drills to customer → invoice list (operational) **or** GL lines on AR account (GL) — user explicitly chooses lens or tabs are labeled.

### 3.4 Branch switch

1. User changes **Branch** in scope chip.  
2. All visible totals refresh; empty state if no data in branch.  
3. Breadcrumb retains “Branch: X” on drill-down pages.

### 3.5 Mobile

1. Hub → COA (compact tree, sticky search).  
2. Account detail → summary + last N GL lines → “Open full journal on desktop” CTA if needed.  
3. Receivables/Payables **summary** cards with basis + scope only; deep work deferred to desktop.

---

## 4. Notes on semantics / labeling

| Term in UI | Meaning |
|------------|---------|
| **Chart of Accounts** | Data from **`accounts`** only. |
| **GL balance / Trial balance** | From **`journal_entry_lines`** on `accounts`; basis = **GL**. |
| **Amount due (operational)** | From documents (e.g. sales/purchases `due_amount`); basis = **Operational**. |
| **Customer balance (roll-up)** | From **`get_contact_balances_summary`** / customer ledger RPCs; basis = **Contact roll-up**. |
| **Supplier payable** | Payables owed to vendors; label explicitly; not mixed with worker. |
| **Worker / studio payable** | From **`worker_ledger_entries`** + payment chain context; never call it only “ledger.” |
| **Journal** | **`journal_entries` / `journal_entry_lines`** — posted accounting. |
| **Payment** | **`payments`** + **`payment_allocations`** — settlement. |

**Forbidden patterns:** “Ledger” alone; “Balance” without basis; one KPI tile combining GL + operational without breakdown.

---

## 5. Figma frame recommendations

### 5.1 File structure

- **Page: _Design system — Accounting**  
  - Color tokens (light + dark), type scale (tabular nums for money), spacing, elevation, badge components, chips (scope/basis).  
- **Page: Desktop — COA & Hub**  
  - Frames: Hub, COA tree, Account detail (tabs), Control AR/AP/Worker, Statement view, Filter drawer.  
- **Page: Desktop — Flows**  
  - Prototype links: Hub → COA → Account → Journal → Source.  
- **Page: Mobile — Companion**  
  - Frames: Hub mobile, COA mobile, Account summary mobile, Payables split summary.

### 5.2 Frame sizes

- **Desktop:** 1440 × 900 baseline; key frames also 1280 and 1920 for density check.  
- **Mobile:** 390 × 844 (iOS) + 360 × 800 (Android) for one critical path each.

### 5.3 Naming convention

`ACC / Desktop / COA — Tree — Branch: Lahore — Basis: GL`  
`ACC / Mobile / Account Detail — Summary`

### 5.4 Annotation layer

- On each money frame: sticky note **Data: accounts | journals | RPC name** (no legacy tables).  
- Red “DO NOT” callout component for frames that must not imply `chart_accounts`.

### 5.5 Components as Figma variants

- **Badge:** property `type` = Control | Detail | Cash | Bank | Revenue | Expense | Asset | Liability | Equity | Inactive | System.  
- **Chip:** property `semantic` = Scope | Basis (variant values per type).  
- **Tree row:** property `depth` = 0–3, `hasBalance` = true/false.

---

## 6. Risky ambiguities intentionally resolved

| Ambiguity | Resolution |
|-----------|------------|
| **Two COAs** | UI copy and IA always equate COA with **`accounts`**; no second tree, no “prototype chart.” |
| **“Ledger”** | Replaced by **GL activity**, **Journal lines**, **Customer activity**, **Worker payable** — never unqualified “ledger.” |
| **Same number, different meaning** | AR total in GL vs sum of customer roll-ups vs sum of invoice dues — **three** possible numbers; design **never** shows one without basis chip or tab separation. |
| **Parent ≠ sum of children** | Either enforce equal in UI spec with “included accounts” explainer, or show **Reconciliation delta** row with tooltip (product rule). |
| **Worker vs supplier payables** | Separate hub entries, separate badges, optional separate colors in payables hub; shared “Payables” parent only if children are labeled. |
| **Branch vs company** | Scope chip is **mandatory** on Hub, COA header, statements, executive cards; switching branch **clears** mixed-basis compare modals. |
| **Control account posting** | Explicit **Direct posting allowed / blocked** per control type in drill-down header — avoids user guessing. |
| **Legacy data fear** | Design annotations state **RPC/table source** for each prototype frame so engineering review catches wrong assumptions early. |
| **Mobile parity trap** | Mobile spec is **companion**: summary + browse + deep link; full reconciliation stays desktop-first with honest CTA. |

---

## 7. Screen deliverables checklist (A–F mapping)

| ID | Screen | Key frames in Figma |
|----|--------|---------------------|
| **A** | COA list / tree | Category groups, tree, header summary, search/filters/sort, badges |
| **B** | Account detail | Summary card, GL tab, operational context tab, links |
| **C** | Control drill-down | AR, AP, Worker Payable templates |
| **D** | Accounting hub | Entry grid, executive cards with chips |
| **E** | Statement / GL view | Breadcrumb, scope, basis, running balance, doc links |
| **F** | Mobile companion | Hub, COA, account summary, payables/receivables snapshot |

---

## 8. Style direction (Figma tokens)

- **Look:** Premium, minimal, generous whitespace, clear vertical rhythm.  
- **Dark mode:** Test all badges/chips on `#121212`–`#1E1E1E` surfaces; avoid low-contrast grays on amounts.  
- **Typography:** One display face for headings; **tabular figures** for all currency and quantities.  
- **Trust cues:** Subtle borders, restrained color (semantic green/red only for signed deltas or alerts, not decoration).  
- **Density:** Desktop information-dense but not cluttered; mobile reduces columns, not semantics.

---

## Related docs

- [COA_FIGMA_REDESIGN_BRIEF.md](./COA_FIGMA_REDESIGN_BRIEF.md) — product rules and checklist.  
- [FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md](./FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md) — engineering handoff.  
- [PHASE2B_DB_INVENTORY_REPORT.md](./PHASE2B_DB_INVENTORY_REPORT.md) — live FK truth (`journal_entry_lines` → `accounts`).

**Batch 5 (destructive DB cleanup) remains NOT APPROVED** — design does not depend on dropping legacy tables.
