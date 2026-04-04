# Final accounting stabilization handoff (Phase 2A / 2B → design)

**Date:** 2026-04-05  
**Audience:** Product, design (Figma), engineering leads  
**Mode:** Documentation only — **no** DB mutation, **no** destructive SQL, **no** Batch 5, **no** legacy table drops in this pass.

**Source of truth (read first):**

- [PHASE2A_SIGNOFF.md](./PHASE2A_SIGNOFF.md), [PHASE2A_QA_EVIDENCE.md](./PHASE2A_QA_EVIDENCE.md)
- [PHASE2B_EXECUTION_REPORT.md](./PHASE2B_EXECUTION_REPORT.md), [PHASE2B_DB_INVENTORY_REPORT.md](./PHASE2B_DB_INVENTORY_REPORT.md)
- [PHASE2B_DROP_CANDIDATES_REVIEW.md](./PHASE2B_DROP_CANDIDATES_REVIEW.md), [PHASE2B_LEGACY_INVENTORY.md](./PHASE2B_LEGACY_INVENTORY.md)
- [PHASE2B_CLEANUP_BATCHES.md](./PHASE2B_CLEANUP_BATCHES.md), [PHASE2B_ROLLBACK_AND_SAFETY.md](./PHASE2B_ROLLBACK_AND_SAFETY.md)

**Explicit gate:** **Batch 5 remains NOT APPROVED.** Legacy DB cleanup is **out of scope** for this handoff.

---

## 1. Executive summary

Phase **2A** delivered a **verified** live accounting spine (posting, payments, allocations, worker ledger, branch-aware customer ledger and dashboard AR/AP semantics). Phase **2B** completed **safe** repo cleanup (dead mobile accounting mock, removal of unused legacy ledger stub) and a **read-only** DB inventory (**Batch 4 COMPLETE**). The **critical** live finding: **`journal_entry_lines.account_id` references `accounts.id`**, not `chart_accounts.id` — the GL spine is **not** FK-tied to the duplicate prototype COA table.

**Next phase** should focus on **Chart of Accounts (COA) UX redesign** in Figma and product planning, aligned to **`accounts` + journals + payments** as truth — **without** reintroducing legacy tables or duplicate “second books.”

Companion brief: [COA_FIGMA_REDESIGN_BRIEF.md](./COA_FIGMA_REDESIGN_BRIEF.md).

---

## 2. Canonical / live accounting truth (must drive all new UX)

Live accounting truth is **only** what the product reads and posts through the **protected spine** and **Phase 2A–verified RPCs**.

### 2.1 Core tables (PROTECTED_LIVE — do not replace or bypass for “truth”)

| Object | Role |
|--------|------|
| **`accounts`** | Canonical **Chart of Accounts** (not `chart_accounts`) |
| **`journal_entries`** | Canonical GL header |
| **`journal_entry_lines`** | Canonical GL lines; **live FK:** `account_id` → **`accounts.id`** |
| **`payments`** | Canonical payment documents (e.g. worker payment chain) |
| **`payment_allocations`** | Allocation-driven AR/AP behavior |
| **`worker_ledger_entries`** | Worker / studio payable tracking — **not** the same as legacy `ledger_entries` |

### 2.2 Verified Phase 2A RPCs (PROTECTED_LIVE contract surface)

Use these (and their documented semantics) for dashboards, customer ledger, and contact roll-ups — **not** ad-hoc queries to legacy tables:

- `get_customer_ledger_sales`
- `get_financial_dashboard_metrics`
- `get_contact_balances_summary`
- `get_dashboard_metrics`

Details and evidence: **PHASE2A_QA_EVIDENCE.md**, **PHASE2A_SIGNOFF.md**.

### 2.3 Guardrails in code

`src/app/services/accountingCanonicalGuard.ts` blocks legacy / backup tables from being treated as UI truth in dev/CI. New screens should **never** circumvent this pattern.

---

## 3. Legacy / review-only cluster (must NOT drive new UX)

These exist in **some** databases for historical or archive reasons. They are **LEGACY_READONLY** / **DROP_CANDIDATE_REVIEW** / **ARCHIVE_ONLY** — **not** canonical truth.

| Cluster | Objects | Product stance |
|---------|---------|------------------|
| **Tier 1 (duplicate COA / prototype posting)** | `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`, `accounting_settings` | **Do not** use for live COA, balances, or posting UX. Batch 4 showed they can still have **schema** FKs/triggers/RLS in DB; Tier 1 DROP is **not** auto-approved (**Batch 5 NOT APPROVED**). |
| **Tier 2 (supplier/user subledger)** | `ledger_master`, `ledger_entries` | **Not** the worker ledger (`worker_ledger_entries`). App does not use for live UX; supplier parity on canonical path must be proven before any future DB drop. |
| **Backups** | `backup_cr_*`, `backup_pf145_*` | **Archive / recovery only** — never wire to live UI. |

**Settings nuance:** The app may use a **settings key** named `accounting_settings` via the settings service; that is **not** the same as trusting the **`public.accounting_settings`** legacy **table** as a source of COA truth.

---

## 4. UX confusion — what went wrong and why

| Issue | Why it hurt |
|-------|-------------|
| **Two COA concepts** | Prototype **`chart_accounts`** vs canonical **`accounts`** — similar names, different tables; easy to design screens against the wrong model. |
| **Two “ledger” concepts** | **`ledger_entries`** (supplier/user legacy subledger) vs **`worker_ledger_entries`** vs **GL** (`journal_entry_lines`) — labels in UI without semantics caused wrong mental models. |
| **GL vs operational due** | Trial balance / journal totals vs document `due_amount` vs contact roll-up RPCs measure **different** things; mixing them without **explicit labels** misled executive and operator views (Phase 2A addressed labeling for key dashboards; COA redesign must **extend** clarity). |
| **Dead / mock modules** | Unused mobile accounting mock suggested features that did not match the live spine. |
| **Legacy SQL / scripts** | Historical migrations and root scripts implied alternate posting paths — engineering guardrails now exist; **design must not** reopen parallel paths in UI specs. |

---

## 5. What the redesigned Chart of Accounts must fix

High level (expanded in **COA_FIGMA_REDESIGN_BRIEF.md**):

1. **Single source of truth in the UI copy and IA:** COA = **`accounts`** + GL behavior; never imply `chart_accounts` is authoritative.
2. **Clear hierarchy:** parent/child accounts, **control** vs detail, **party** (customer / supplier / worker) semantics — visually and in filter behavior.
3. **Consistent drill-down:** from summary → account → journal lines / supporting docs, with **scope** (company / branch) explicit.
4. **Badges and filters** that **cannot** silently blend GL totals with operational AR/AP or worker payables without a **semantic label**.
5. **No duplicate posting stories** in wireframes (one payments + journals + allocations narrative).

---

## 6. Do not repeat old mistakes (hard rules for design + product)

1. **Do not** mix **GL control / trial balance** totals with **operational due** or **contact summary** totals **without** clear, persistent **labels** and tooltips.
2. **Do not** show **parent** account totals that **contradict** visible **child** roll-ups without explaining inclusion rules (e.g. inactive accounts, branch scope).
3. **Do not** specify screens powered by **`chart_accounts`**, **`account_transactions`**, **`ledger_master` / `ledger_entries`**, or **backup_*** tables for **live** accounting truth.
4. **Do not** design a **second** posting or COA path parallel to **`accounts` + `journal_entries` + `journal_entry_lines` + `payments` + `payment_allocations`** without an explicit architecture decision and migration plan.
5. **Do not** assume **`journal_entry_lines`** references **`chart_accounts`** — **live** reference is **`accounts.id`**; any future use of `chart_accounts` in product would require a **formal** migration and approval (**not** in this handoff).

---

## 7. Phase completion checklist (for stakeholders)

| Milestone | Status (per docs) |
|-----------|-------------------|
| Phase 2A signoff | Achieved — **PHASE2A_SIGNOFF.md** |
| Phase 2B Batch 2 (dead mobile mock) | **COMPLETE** |
| Phase 2B Batch 3 (`ledgerService.ts` removal) | **COMPLETE** |
| Phase 2B Batch 4 (DB inventory read-only) | **COMPLETE** — **PHASE2B_DB_INVENTORY_REPORT.md** §8 |
| Critical spine FK (`jel` → `accounts`) | **Verified live** |
| Batch 5 (destructive DB cleanup) | **NOT APPROVED** |

---

## 8. Handoff to Figma / UI planning

**Deliverables for designers:** [COA_FIGMA_REDESIGN_BRIEF.md](./COA_FIGMA_REDESIGN_BRIEF.md) (rules + checklist), [COA_FIGMA_DESIGN_SPEC.md](./COA_FIGMA_DESIGN_SPEC.md) (screens, components, flows, Figma frames), [COA_FIGMA_EXECUTION_PACK.md](./COA_FIGMA_EXECUTION_PACK.md) (Figma execution pack for build phase).

Engineering continues to protect the live spine; design proposes **information architecture**, **terminology**, **hierarchy**, and **drill-down** patterns that align to §2 of this document.

**Batch 5 remains NOT APPROVED.**
