# COA & accounting navigation — Figma execution pack (design phase)

**Date:** 2026-04-05  
**Phase:** Design execution (Figma) — **not** implementation, **not** DB cleanup  
**Authoritative inputs:** [FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md](./FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md), [COA_FIGMA_REDESIGN_BRIEF.md](./COA_FIGMA_REDESIGN_BRIEF.md), [COA_FIGMA_DESIGN_SPEC.md](./COA_FIGMA_DESIGN_SPEC.md)

---

## Non-negotiables

| Rule | Detail |
|------|--------|
| **Canonical truth** | `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries`, RPCs: `get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics` |
| **Never design as live truth** | `chart_accounts`, `account_transactions`, `ledger_master`, `ledger_entries`, backup tables (`backup_cr_*`, `backup_pf145_*`), or other legacy cluster tables in handoff docs |
| **Batch 5** | **NOT APPROVED** — no UI that assumes legacy drops or alternate books |
| **Shadow COA** | **Forbidden** — one COA mental model = **`accounts`** |

---

## 1. Screen map

### 1.1 Topology (desktop-first)

```
┌─────────────────────────────────────────────────────────────┐
│  [1] ACCOUNTING HUB                                          │
│  scope chip · basis chips on cards · nav to 2–6             │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┼────────┬──────────────┬─────────────┬──────────────┐
    ▼        ▼        ▼              ▼             ▼              ▼
 [2] COA   Journals  Receivables   Payables     Statements     Reports*
    │        │        (customer)   (supplier +   (GL activity)
    │        │                     worker split)
    ▼
 [3] ACCOUNT DETAIL
    │  tabs: GL activity | Operational context
    ▼
 [4] CONTROL DRILL-DOWN (AR / AP / Worker Payable / …)
    │
 [5] STATEMENT / GL ACTIVITY (full-width ledger-style)
    │
 [6] MOBILE COMPANION — parallel shallow map (hub → COA → account → CTA)
```

\*Reports: optional hub tile; keep same basis/scope rules.

### 1.2 Screen index

| # | Screen | Primary user goal |
|---|--------|---------------------|
| 1 | **Accounting Hub** | Orient, pick destination, read **labeled** executive metrics |
| 2 | **Chart of Accounts (tree/list)** | Browse **`accounts`**, find account, see hierarchy |
| 3 | **Account Detail** | Inspect one account: **GL** vs **operational/roll-up** context |
| 4 | **Control drill-down** | Understand **what rolls up**, posting rules, drill to detail |
| 5 | **Statement / GL activity** | Period **journal lines**, running balance, trace to source |
| 6 | **Mobile companion** | Quick status + browse; **honest** desktop handoff |

---

## 2. Component inventory

### 2.1 Global (every accounting money surface)

| ID | Component | Spec |
|----|-----------|------|
| G1 | **Scope chip** | `Company-wide` \| `Branch: {name}` — top-left of content or in sticky subheader |
| G2 | **Basis chip** | `GL` \| `Operational` \| `Contact roll-up` — on every KPI card and monetary table header |
| G3 | **Semantic strip** | One line: `Scope · Basis · Period` where period applies |
| G4 | **Breadcrumb** | `Accounting` → `COA` → `{code} {name}` → `Journal {ref}` → `Source` |
| G5 | **Primary nav** | Hub · COA · Journals · Receivables · Payables · Statements |
| G6 | **Filter bar / drawer** | Date, branch, basis, account type, status — **active filter chips** below |
| G7 | **Export / print header block** | Repeats scope, basis, period, generated time |

### 2.2 Screen 1 — Accounting Hub

| ID | Component |
|----|-----------|
| H1 | Page title + G1 scope + optional period selector |
| H2 | **Executive card grid** (3–4 cols desktop): each card = title, value, **G2 basis**, footnote link |
| H3 | **Quick links** — large tiles: COA, Journals, Receivables, Payables, Statements |
| H4 | Optional **legend** expander: “What GL / Operational / Contact roll-up mean” |
| H5 | Alerts / tasks strip (non-monetary or with chips if amounts) |

### 2.3 Screen 2 — COA tree/list

| ID | Component |
|----|-----------|
| C1 | Toolbar: search, filter trigger, sort, optional “Show balances” **toggle (GL only)** |
| C2 | **Category group** (accordion): Assets, Liabilities, Equity, Revenue, Expense, COGS/Production |
| C3 | **Tree row**: chevron, indent, **code** (mono), name, **type badge**, **Control/Detail badge**, **Active/Inactive/System** |
| C4 | **Balance column** (conditional): visible **only** when “Show balances” on **and** copy states `Basis: GL` |
| C5 | Row hover: secondary actions — View account, View GL activity |
| C6 | Summary line: “{n} accounts · scope: {branch\|company}” |

### 2.4 Screen 3 — Account detail

| ID | Component |
|----|-----------|
| A1 | **Summary card**: code, name, type badges, parent link, control/detail, system/inactive, **GL balance** + `Basis: GL` |
| A2 | **Tabs**: `GL activity` \| `Operational context` (hide operational tab if N/A for account type) |
| A3 | GL tab: table — date, journal ref, description, debit, credit, **running balance**, link icon |
| A4 | Operational tab: basis chip + table or cards **separate** from GL columns |
| A5 | **Linked source** column or slide-over: payment, sale, purchase, allocation |
| A6 | Sticky subheader: G1 + account identifier |

### 2.5 Screen 4 — Control drill-down

| ID | Component |
|----|-----------|
| D1 | **Control hero**: account code + name + **Control** badge |
| D2 | **Roll-up explainer** block: “Includes: {list or rule}” — **What rolls up here** |
| D3 | **Posting policy** row: `Direct posting: Allowed` \| `Blocked` (per product rules) |
| D4 | Sub-table: detail accounts (code, name, GL balance with basis chip) |
| D5 | **Secondary lens** (tabs or toggle): `By detail account` \| `By customer` \| `By supplier` \| `Worker payable` — each lens has correct basis |
| D6 | AR / AP / Worker Payable = **three frame variants** sharing D1–D6 with different D5 defaults |

### 2.6 Screen 5 — Statement / GL activity

| ID | Component |
|----|-----------|
| S1 | Title + **Period** selector + G1 + **Basis: GL** (fixed for this screen) |
| S2 | Account context (if filtered): code + name |
| S3 | Table: date, doc #, description, debit, credit, **balance**, actions → journal → source |
| S4 | Footer: opening, movement, closing (GL) |
| S5 | Empty: “No GL lines in this period/scope” |

### 2.7 Screen 6 — Mobile companion

| ID | Component |
|----|-----------|
| M1 | **Compact hub**: 2×2 tiles + 1–2 executive **mini-cards** with basis text (not tiny illegible chips — use label + chip) |
| M2 | **COA**: single-column list, collapsible categories, reduced badges |
| M3 | **Account summary**: code, name, key badges, **one** GL balance with `GL` label |
| M4 | **Recent GL lines** (5–10 rows), link “View all GL activity” |
| M5 | **CTA** button: “Open full accounting on desktop” / “Continue in browser” |
| M6 | Receivables/Payables: **separate** list entries or tabs — worker vs supplier **never** one unlabeled list |

### 2.8 Badge system (variants)

Control · Detail · Cash · Bank · Revenue · Expense · Asset · Liability · Equity · Inactive · System — **outline + subtle fill**, WCAG-friendly on **dark** surfaces.

---

## 3. Annotated frame list (Figma)

Use a dedicated **Annotations** layer on every money frame. Prefix: `ACC`.

| Frame name (example) | Annotation (sticky) |
|----------------------|----------------------|
| `ACC / 01 Hub / Desktop / Default` | `Data: get_financial_dashboard_metrics, get_dashboard_metrics, get_contact_balances_summary` — **Each card: basis chip required** |
| `ACC / 01 Hub / Desktop / Branch selected` | `Scope: branch filter propagates to child prototypes` |
| `ACC / 02 COA / Desktop / Tree collapsed` | `Data: accounts` — **NO chart_accounts** |
| `ACC / 02 COA / Desktop / Balances on` | `Balance column = GL only · show Basis: GL in column header** |
| `ACC / 03 Account / Desktop / GL tab` | `Data: journal_entry_lines + journal_entries → accounts` |
| `ACC / 03 Account / Desktop / Operational tab` | `Data: operational due OR contact roll-up RPC — **separate from GL**` |
| `ACC / 04 Control / AR` | `Roll-up: customer detail AR accounts · Posting rule: …` |
| `ACC / 04 Control / AP` | `Supplier payable lens · NOT worker` |
| `ACC / 04 Control / Worker Payable` | `worker_ledger_entries + payments context · NOT ledger_entries table` |
| `ACC / 05 Statement / Desktop / GL` | `Basis: GL only · journal_entry_lines` |
| `ACC / 06 Mobile / Hub` | `Companion only · executive cards max 2 monetary` |
| `ACC / 06 Mobile / Account` | `Recent GL lines · CTA desktop` |
| `ACC / _DO NOT` (red component) | `Never: chart_accounts, ledger_master, ledger_entries as data source` |

**Prototype flows:** Hub → COA → Account (GL) → Journal → Source; Hub → Payables → Supplier vs Worker paths.

---

## 4. Desktop layout suggestions

| Screen | Layout | Notes |
|--------|--------|-------|
| **Hub** | **12-col grid**, 1440px: row1 sticky scope + period; row2 cards **equal height**, 3–4 columns; row3 quick links **2×3** tiles; min **48px** touch targets on links |
| **COA** | **Left 260px** optional filter panel **or** top toolbar; main: category stacks full width; tree row **56px** min height; **mono** code column **80–96px** |
| **Account detail** | **Top**: summary card full width; **tabs** below; table **zebra** optional; **right rail** optional for metadata |
| **Control drill-down** | **Hero** full width; **two-column** below: left detail accounts table, right **explainer** card sticky on scroll |
| **Statement** | **Full-width table**; sticky header with scope + period; numeric columns **right-aligned**, tabular nums |
| **Density** | Premium = **generous** padding (16–24px cards), **no** more than ~7 columns visible without horizontal scroll on 1280 |

**Dark mode:** Surfaces `#121212` / `#1E1E1E`; chips **2px border** + fill 8–12% opacity; **never** gray-on-gray for amounts.

---

## 5. Mobile layout suggestions

| Screen | Layout |
|--------|--------|
| **Hub** | Single column; **scope** on first row; **scroll** horizontal **pills** for basis on cards **or** stack cards vertically with basis **text** under title |
| **COA** | **Sticky** search; one column tree; **floating** filter icon |
| **Account** | Summary **card**; **tabs** as **segmented control**; table → **cards** for each GL line (date, amount, link) |
| **Statement** | **Defer** full statement or show **last 10** + CTA |
| **Navigation** | Bottom **3–4** tabs max: Hub · COA · More (journals/payables) |

**Thumb zone:** Primary actions bottom **1/3**; scope visible **top** sticky.

---

## 6. Notes on semantic labels

### 6.1 Required copy patterns

| UI element | Label pattern |
|------------|----------------|
| COA screen title | **Chart of Accounts** (subtitle optional: “Company accounts”) |
| Posted activity | **GL activity** / **Journal lines** — not “Ledger” |
| Customer side | **Customer receivable** / **Customer balance (roll-up)** |
| Vendor side | **Supplier payable** |
| Workers | **Worker payable** / **Studio payable** |
| Settlement | **Payments** / **Allocations** |
| RPC-backed summary | **Contact roll-up** (chip) + tooltip with short definition |

### 6.2 Chip text (exact)

- **Scope:** `Company-wide` · `Branch: {Name}`  
- **Basis:** `GL` · `Operational` · `Contact roll-up`

### 6.3 Column headers when mixed context is forbidden

- Single table = **one** basis. If two bases needed → **two** tables or **tabs**, each with its own chip in the tab label.

### 6.4 Worker vs supplier (visual)

- **Different** entry tiles on Hub (color/icon family distinct) **or** Payables hub with **two** child destinations  
- **Never** merge into “Outstanding payables” without sub-rows labeled **Supplier** vs **Worker**

---

## 7. Risky ambiguities resolved in this design

| Ambiguity | Design resolution |
|-----------|-------------------|
| Two COAs | Only **`accounts`** in IA and annotations; no alternate tree |
| “Ledger” | **Banned** unqualified; use **GL activity**, **journal lines**, **customer activity**, **worker payable** |
| Same amount, different meaning | **Basis chip** + **separate tabs/tables**; no single “Total” without breakdown |
| Parent ≠ children | **Explainer block** + optional **Reconciliation delta** row on control screens |
| GL vs invoice due | **Never** one KPI without label; Hub cards **each** show basis |
| Worker vs supplier | **Distinct** nav, badges, and default **control drill-down** frames |
| Branch vs company | **G1** on every monetary surface; prototype states for both |
| Balance on COA | **Toggle** + header text **“Balances shown: GL”**; hide column when off |
| Mobile parity | **Explicit CTA** to desktop; no implied full reconciliation |
| Legacy tables | **Red DO NOT** component in Figma library for wrong data sources |
| Batch 5 | **No** UI for “cleanup” or “migrate legacy COA” in this phase |

---

## Cross-references

- Rules & checklist: [COA_FIGMA_REDESIGN_BRIEF.md](./COA_FIGMA_REDESIGN_BRIEF.md)  
- Expanded architecture & flows: [COA_FIGMA_DESIGN_SPEC.md](./COA_FIGMA_DESIGN_SPEC.md)  
- Engineering truth: [FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md](./FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md)

**Batch 5 remains NOT APPROVED.**
