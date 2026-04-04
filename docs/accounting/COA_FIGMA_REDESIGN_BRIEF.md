# Chart of Accounts (COA) — Figma / UI redesign brief

**Date:** 2026-04-05  
**Depends on:** [FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md](./FINAL_ACCOUNTING_STABILIZATION_HANDOFF.md)  
**Constraints:** Documentation / design planning only — **no** DB mutation, **no** Batch 5, **no** legacy table drops. **Batch 5 remains NOT APPROVED.**

---

## 1. Purpose

Redesign the **Chart of Accounts** and related accounting navigation so operators and finance users see **one coherent model** aligned to the **canonical** `accounts` + GL + payments spine, with **explicit semantics** for receivables, payables, workers, suppliers, and branches.

This brief is input for **Figma** exploration and product specs — not an implementation ticket.

---

## 2. Canonical truth (design must align here)

All COA and GL-facing UX should assume:

- **COA rows** = **`accounts`** (types, codes, parent links, active flags — as implemented in app/DB).
- **Posted activity** = **`journal_entries` / `journal_entry_lines`** with **`journal_entry_lines.account_id` → `accounts.id`**.
- **Cash / payment flows** = **`payments`** + **`payment_allocations`** where applicable.
- **Worker studio payables** = **`worker_ledger_entries`** (distinct from legacy **`ledger_entries`**).
- **Customer ledger / executive roll-ups** = Phase 2A RPCs (`get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics`) — **labeled** by scope and basis in UI.

**Never** design “source of truth” flows around `chart_accounts`, `account_transactions`, `ledger_master`, `ledger_entries`, or backup tables.

---

## 3. Information architecture — hierarchy and parties

### 3.1 Parent / child / roll-up

- Show **tree or grouped list** with **clear parent→child** relationship for `accounts`.
- When a **control account** aggregates detail accounts, the UI must state **what is included** (e.g. by type, by “posting allowed” flag, by branch).
- **Parent totals** must **reconcile** to visible children **or** show an explicit “other / unallocated / out of scope” explanation — avoid silent mismatch.

### 3.2 Party and subledger semantics (labeling, not new tables)

Design screens so users can distinguish:

| Concept | Typical data / behavior | UX label examples |
|---------|-------------------------|-------------------|
| **Customer receivable** | Sales / invoices, customer ledger RPC, allocations | “Customer balance (operational)” |
| **Supplier payable** | Purchases, supplier payments, contact summary | “Supplier payable (operational)” |
| **Worker payable** | `worker_ledger_entries`, worker payment posting | “Worker / studio payable” |
| **GL balance** | Sum of journal lines on `accounts` | “GL / trial balance” |

Avoid a single word **“ledger”** without qualifier.

---

## 4. Control account behavior

- **Definition:** Control accounts (AR/AP/VAT/bank control, etc.) should have **obvious** rules: who can post directly, which sub-accounts roll up, and what reports expand them.
- **Drill-down:** Clicking a control account leads to **either** detail accounts **or** filtered journal lines — spec which applies per account type.
- **Empty / zero state:** Explain “no activity” vs “not configured” vs “wrong branch scope.”

---

## 5. Receivables vs payables separation

- **Separate** navigation or **tabs** for “money in / owed to us” vs “money out / we owe” where it reduces confusion.
- **Filters** default to one side; **cross-foot** summaries (if any) must be **labeled** as mixed semantic (e.g. net working capital) not as a single “due” number.
- Align with Phase 2A learning: **executive payables** can include **worker/studio** slice from contact summary — if a screen shows “supplier payables only,” **say so**.

---

## 6. GL vs operational semantics (mandatory labels)

Every aggregate card or table should declare **basis**:

- **GL (posted journals)** — debits/credits on `accounts`.
- **Document operational** — e.g. `due_amount` on sales/purchases.
- **Contact / party roll-up** — RPC-based AR/AP for parties.

**Design requirement:** Use **persistent sublabels**, **tooltips**, or **info icons** — not one-off training notes.

---

## 7. Branch-aware / company-aware behavior

- **Scope chip** or **filter**: Company-wide vs branch (match RPC and screen behavior already verified in Phase 2A for customer ledger / dashboard).
- When branch scope changes, **empty states** should say “no data in this branch” vs “API error.”
- COA list: clarify if **accounts** are global per company or branch-specific if the product supports branch dimensions on accounts (mirror actual schema).

---

## 8. Statement and drill-down consistency

- **Same account** from COA, trial balance, P&L line, and journal detail should use **consistent naming and code**.
- **Drill path:** Summary → account → period → journal entry → lines → source document (sale, purchase, payment) where applicable.
- **Breadcrumbs** should include **scope** (company / branch) and **basis** (GL vs operational) when crossing semantic boundaries.

---

## 9. Account badges, categories, and types

- **Badges:** e.g. Bank, Cash, Control, Detail-only, System, Inactive — driven from real `accounts` fields, not decorative.
- **Categories / types:** Map 1:1 to backend enums or types; no duplicate “category” in UI that does not exist in `accounts`.
- **Color and icon** system: accessible, not solely color-dependent; consistent across web and mobile later.

---

## 10. Filters and summaries — no silent mixing

**Hard UX rules:**

- Filters must show **active filter summary** (“Branch: Lahore · Basis: GL · Period: MTD”).
- **Export** and **print** views repeat the same basis/scope metadata.
- **Do not** provide a single “total due” that **blends** unrelated sources without breakdown rows.
- **Saved views** (if spec’d) store **basis + scope** so users do not save a misleading combination.

---

## 11. Do not repeat old mistakes (design checklist)

- [ ] No wireframe calls `chart_accounts` or legacy `ledger_entries` as data source for live screens.
- [ ] No screen titled “Chart of Accounts” that implies a second table or shadow COA.
- [ ] No parent total that **equals** something other than the sum of shown children **without** explanation.
- [ ] No mixing GL and operational **without** labels on **every** chart and KPI tile.
- [ ] Worker payable and supplier payable are **visually** and **navigationally** distinguishable.
- [ ] Branch and company scope visible on **every** accounting summary screen.

---

## 12. Suggested Figma deliverables (for design team)

1. **COA tree / list** — desktop + mobile density study.
2. **Account detail** — GL activity vs linked operational docs (tabs).
3. **Control account drill-down** — happy path + empty states.
4. **AR vs AP hub** — entry points and cross-links to COA.
5. **Annotation layer** — mapping each frame to **canonical** objects (`accounts`, `journal_*`, `payments`, RPC names).

---

## 13. Detailed Figma specification (screens, components, flows)

For **screen architecture**, **component inventory**, **user flows**, **Figma frame naming**, and **resolved ambiguities**, use **[COA_FIGMA_DESIGN_SPEC.md](./COA_FIGMA_DESIGN_SPEC.md)**.

---

## 14. Explicit statement

**Batch 5 remains NOT APPROVED.** This brief does **not** authorize legacy table drops or schema destruction. Engineering handoff for any DB change remains under **PHASE2B_DROP_CANDIDATES_REVIEW.md** and **PHASE2B_ROLLBACK_AND_SAFETY.md**.
