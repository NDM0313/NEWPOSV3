# ERP Chart of Accounts — Cleanup & Migration Workbook

**Project:** NEWPOSV3  
**Last updated:** 2026-03-27  
**Audience:** Engineering, finance ops, implementation partners  
**Companion:** `ERP_COA_EXECUTION_BLUEPRINT.md`, `REPORTS_AND_COA_MASTER_REDESIGN.md`, `defaultAccountsService.ts`, `partySubledgerAccountService.ts`

---

## Section 1 — Current accounting landscape

### 1.1 Main account families (seed + runtime)

| Family | Typical codes | Source |
|--------|---------------|--------|
| **Liquidity groups** | `1050` cash group, `1060` bank, `1070` wallet | `defaultAccountsService` GROUP_ROWS |
| **Liquidity leaves** | `1000`, `1001`, `1010`, `1020` | Posting targets for payments |
| **AR** | `1100` control; `AR-*` per customer (`linked_contact_id`) | Seed + `partySubledgerAccountService` |
| **Inventory** | `1090` group, `1200` leaf | Purchase/sale COGS |
| **Worker** | `1080` group, `1180` advance | Studio + worker flows |
| **Payables group** | `2090` | Header |
| **AP** | `2000` control; `AP-*` per supplier | `partySubledgerAccountService` |
| **Other liabilities** | `2010` worker payable, `2011` security, `2020` rental advance, `2030` courier control (+ `203x` couriers) | Seed + RPCs |
| **Equity** | `3090`, `3000` | Opening / capital |
| **Revenue group** | `4050` | Header |
| **Revenue leaves** | `4100` sales (seed), `4110` shipping income, `4200` rental; **`4000`** often created by sale JEs | Mixed legacy |
| **Expense group** | `6090` | Header |
| **Expense leaves** | `5000` CO/production, `6100`–`6120`, auto **`5200`** discount allowed, **`5300`** extra expense | Sale service + seed |

### 1.2 Where noise / mixing exists

- **Two product-revenue anchors:** `4000` (saleAccountingService) vs `4100` (default COA seed).
- **Historical shipping:** Older JEs may have credited **`4100`** before **`4110` Shipping Income** was introduced — revenue may be combined on one account.
- **P&L classification:** `5100`/`5110` remain in “cost of sales” bucket in code; commission vs shipping expense naming has legacy notes in `COA_MAPPING_MATRIX.md`.
- **Worker:** `2010`/`1180` are **global**; no auto GL child per worker like AR/AP (operational `worker_ledger_entries` parallel).
- **Duplicate user-created** bank/expense accounts under wrong parents — `auditAccountHierarchy` warns.

### 1.3 What looks standard

- Journal-only GL for TB/BS/P&L (`accountingReportsService`).
- Voided JEs excluded from effective GL.
- AR/AP **BS roll-up** (children excluded from duplicate BS lines).
- **Payment isolation** contract (document JE vs payment JE).
- **`is_group` + COA header codes** excluded from BS detail and payment pickers.

### 1.4 Underutilized / inconsistent

- Optional **TB expanded** for worker and liquidity (only AR/AP today).
- **`chart_accounts`** — not GL master; avoid for posting truth.
- **Rental** GL vs operational rental tables — reconciliation discipline required.

---

## Section 2 — Final recommended COA structure

### 2.1 Parent / child (target)

```
ASSETS
├── 1050 Cash & Cash Equivalents (group)
│   ├── 1000 Cash
│   └── 1001 Petty Cash
├── 1060 Bank Accounts (group)
│   └── 1010 Bank (+ optional extra bank accounts as siblings)
├── 1070 Mobile Wallets (group)
│   └── 1020 Mobile Wallet
├── 1080 Worker Advances (group)
│   └── 1180 Worker Advance  [optional future: WA-{worker}]
├── 1090 Inventory (group)
│   └── 1200 Inventory
├── [optional 1105 Trade Receivables — group UX only]
└── 1100 Accounts Receivable (control)
    └── AR-{slug} (customer subledger, linked_contact_id)

LIABILITIES
└── 2090 Trade & Other Payables (group)
    ├── 2000 Accounts Payable (control)
    │   └── AP-{slug} (supplier subledger)
    ├── 2010 Worker Payable  [optional future: WP-{worker}]
    ├── 2011 Security Deposit
    ├── 2020 Rental Advance
    └── 2030 Courier Payable (control) + 203x per courier

EQUITY
└── 3090 Equity (group)
    └── 3000 Owner Capital

REVENUE
└── 4050 Revenue (group)
    ├── 4000 or 4100 — pick ONE canonical product Sales Revenue (merge policy)
    ├── 4110 Shipping Income
    └── 4200 Rental Income

EXPENSES / COST
└── 6090 Operating Expenses (group)
    ├── 5000 Cost of Production / COGS
    ├── 5100 Shipping Expense (courier cost)
    ├── 5110 Sales Commission Expense (when used)
    ├── 5200 Discount Allowed
    ├── 5300 Extra Expense (sale-linked)
    ├── 5210 Discount Received (purchases)
    └── 6100 / 6110 / 6120 operating shells
```

---

## Section 3 — Control account + subledger design

### A) Accounts Receivable

| Item | Rule |
|------|------|
| **Control** | `1100` |
| **Children** | `AR-*`, `parent_id = 1100`, `linked_contact_id` when column exists |
| **Posting** | Prefer **`resolveReceivablePostingAccountId`** → child when customer known |
| **Reports** | BS: one line, rolled total; TB: flat / summary / expanded (implemented) |
| **Never** | Same economic invoice **both** Dr `1100` and Dr child — choose one target |

### B) Accounts Payable

| Item | Rule |
|------|------|
| **Control** | `2000` |
| **Children** | `AP-*`, `linked_contact_id` |
| **Posting** | `resolvePayablePostingAccountId` |
| **Reports** | Same pattern as AR |

### C) Worker

| Account | Role |
|---------|------|
| `1180` | Advance (asset) — pre-bill payments |
| `2010` | Payable (liability) — post studio bill **Cr 2010** |
| **Future** | Optional subaccounts under `2010`/`1180` per worker for TB expansion |

### D) Cash / Bank / Wallet

| Type | Group | Default leaf |
|------|-------|--------------|
| Cash | `1050` | `1000` |
| Bank | `1060` | `1010` |
| Wallet | `1070` | `1020` |

Additional real accounts = **siblings** under the same group with correct `type`.

---

## Section 4 — Current account audit table (canonical codes)

| Code | Current name (seed) | Category | Typical usage | Problem | Recommendation | Action |
|------|---------------------|----------|---------------|---------|----------------|--------|
| `1050`–`6090` | Section headers | group | Structure only | None if `is_group` | Keep | keep |
| `1000`–`1020` | Cash/Bank/Wallet | liquidity | Payments | Duplicate user banks | Reparent under groups | merge/reparent |
| `1100` | Accounts Receivable | asset/control | Sales, receipts | Posting to control + child | Resolver-only posts | posting alignment |
| `AR-*` | Receivable — {name} | asset/subledger | Party AR | Missing `linked_contact_id` | Backfill link | migrate |
| `1200` | Inventory | inventory | Purchases, COGS | Legacy `1500` | Prefer `1200` | merge |
| `2000` | Accounts Payable | liability/control | Purchases, payments | Same as AR | Resolver | posting alignment |
| `AP-*` | Payable — {name} | liability/subledger | Party AP | — | — | keep |
| `2010` | Worker Payable | liability | Studio, payments | Global only | Optional children | roadmap |
| `1180` | Worker Advance | asset | Advances | — | — | keep |
| `4000` | (auto) Sales Revenue | revenue | Sale JEs | Duplicates `4100` | One anchor | merge / deprecate |
| `4100` | Sales Revenue (seed) | revenue | Seed | Confusion with `4000` | Policy | merge |
| `4110` | Shipping Income | revenue | Sale/shipment shipping | New companies only until seed runs | Ensure seeded | non-destructive add |
| `4200` | Rental Income | revenue | Rental | — | — | keep |
| `5000` | Cost of Production | expense | COGS + studio cost | Mixed semantics | Optional split COGS vs WIP | optional |
| `5100` | Shipping Expense | expense | Courier cost | Was mixed with commission historically | Lock to shipping | keep |
| `5200` | Discount Allowed | expense | Sales discount | Was in P&L COGS bucket (fixed) | — | keep |
| `5300` | Extra Expense | expense | Sale extra | Was in COGS bucket (fixed) | — | keep |
| `5210` | Discount Received | expense/contra | Purchases | — | — | keep |
| `2030` / `203x` | Courier | liability | Shipments | — | — | keep |

---

## Section 5 — Known conflict areas (review checklist)

1. **Revenue:** `4000` vs `4100` — **merge policy** + transfer JE.
2. **Shipping revenue vs product:** **`4110`** is canonical for shipping; audit old **`4100`** credits if any were mis-labeled.
3. **Discount / extra / COGS:** P&L **cost of sales** = `5000`,`5010`,`5100`,`5110` only (not `5200`/`5300`).
4. **Inventory:** `1200` vs `1500` — migrate to `1200`.
5. **AR/AP:** JEs directly on **`1100`/`2000`** when child exists — **reclass** optional.
6. **Duplicate liquidity** accounts — reparent to `1050`/`1060`/`1070`.
7. **Commission:** `5110` vs fallback — see commission batch posting.
8. **Rental:** `2020` advance vs revenue recognition — match `rentalService` + GL.
9. **Studio:** `5000`/`2010` pattern — document vs pure manufacturing COGS if business needs split.
10. **Courier:** `203x` vs `2030` control — per `get_or_create_courier_payable_account`.

---

## Section 6 — Postable vs summary-only

| Type | Postable? | Notes |
|------|-----------|--------|
| `is_group === true` / header codes | **No** | Never post |
| `1100`/`2000` with active children | **Discouraged** | Post to child when party known |
| `AR-*` / `AP-*` | **Yes** | Primary party lines |
| Liquidity leaves | **Yes** | |
| `5010`,`5110`, etc. | **Yes** | When present in COA |

**Roll-up:** BS sums AR/AP family into control; TB summary mode replaces family rows with one rolled row (AR/AP).

---

## Section 7 — Module-to-account posting map (summary)

| Module | Debit | Credit | Control vs child |
|--------|-------|--------|-------------------|
| Sale (credit) | AR S/C | Revenue, `4110` if shipping, `5200` if discount | AR **S** preferred |
| Sale COGS | `5000` | `1200` | Leaves |
| Sale payment | Cash/Bank | AR S/C | |
| On-account / manual receipt | Cash | AR | |
| Purchase | `1200` (+ caps) | AP S/C | AP **S** preferred |
| Supplier payment | AP S/C | Cash | |
| Expense paid | Expense | Cash | |
| Worker bill (studio) | `5000` | `2010` | Global |
| Worker payment | `2010` or `1180` | Cash | |
| Worker advance | `1180` | Cash | |
| Rental payment JE | (policy) | (policy) | `reference_type: rental` |
| Manual JE | As entered | As entered | Avoid sensitive controls |
| Opening contact | AR/AP/Worker + equity offset | | Opening reference types |
| Opening inventory | `1200` | Equity | `opening_balance_inventory` |

Full detail: `ERP_REPORTS_AND_COA_FINAL_REMEDIATION_PLAN.md` posting matrix.

---

## Section 8 — Report alignment rules

| Report | COA dependency |
|--------|----------------|
| **TB** | Every posted account; AR/AP modes must not change **totals** |
| **BS** | Excludes groups; rolls AR/AP; classifies via `accountHierarchy` |
| **P&L** | Revenue vs expense **type**; COGS subset by **code set** |
| **Statements** | Party accounts = children or operational APIs |
| **Double count** | Never sum parent **and** children into separate BS lines (code prevents for AR/AP) |

---

## Section 9 — Migration strategy (phased)

1. **Analysis / freeze** — Lock code meanings; export `accounts` + line counts per company.
2. **Non-destructive additions** — Seed `4110`, repair parents, `linked_contact_id` backfill.
3. **Parent/child links** — `repairParents`, optional `1105` wrapper.
4. **Report alignment** — P&L buckets verified; TB modes roadmap.
5. **Posting alignment** — Resolvers only; ban duplicate control+child for new JEs (lint/RPC optional).
6. **Optional reclass** — Transfer JEs: `4000`↔`4100`, shipping mis-posts → `4110`.
7. **Deprecation** — `is_active: false` + UI guards; **no** hard delete.

---

## Section 10 — Legacy data handling

| Situation | Handling |
|-----------|----------|
| JEs on `1100` only | Accept; optional reclass to `AR-*` with **transfer JE** |
| Payments metadata-only | Link via `payment_id` / `reference_type`; backfill when possible |
| Wrong account **type** | Rename + **reclass** journal or new account + migrate |
| Reports during transition | Run **before/after** TB export; document variance |
| Controlled backfill | One migration id per batch; reversible **mirror** JEs |

---

## Section 11 — Validation / safety checks

- [ ] All non-void JEs: sum debits = sum credits.
- [ ] TB `difference === 0` on clean DB.
- [ ] BS `totalAssets` vs `totalLiabilitiesAndEquity` (with net income) ≈ 0 difference field.
- [ ] AR family rolled balance = sum of child + control posted amounts (algebraic).
- [ ] No new posts to `is_group` headers (enforced in UI + optional API).
- [ ] Party operational total vs GL control within **documented** tolerance (reconciliation).
- [ ] After migration: compare TB **before/after** file for accounts touched only.

---

## Section 12 — Frontend COA UX (recommendations)

- **Tree:** Section groups collapsed by default; expand AR/AP to show party children.
- **Badges:** `Group`, `Postable`, `Control`, `Party`, `Deprecated`, `System`.
- **Sub-accounts toggle:** Show/hide depth ≥2 under controls.
- **Payment pickers:** Exclude `COA_HEADER_CODES` (existing).
- **Create account:** Suggest parent from `accountHierarchy.resolveCanonicalParentId` for cash/bank types.

---

## Section 13 — Workbook practicality

This workbook is intended to:

- Give **developers** a prioritized cleanup list and code touchpoints.
- Give **finance** a shared vocabulary and merge/reclass decisions.
- Allow **phased** migration without a single destructive cutover.

---

## Top 10 cleanup priorities

1. **Unify product revenue** (`4000` vs `4100`) with a written policy + optional transfer JEs.  
2. **Ensure `4110` exists** for every company (`ensureDefaultAccounts` run or migration).  
3. **Backfill `linked_contact_id`** on AR/AP children where missing.  
4. **Enforce posting to party subledger** when `customer_id`/`supplier_id` present (review all paths).  
5. **Inventory `1500` → `1200`** migration where both exist.  
6. **Reparent orphan** cash/bank accounts under `1050`/`1060`/`1070`.  
7. **Document `5100` vs `5110`** and commission posting path.  
8. **TB expanded** for `2010` family (roadmap).  
9. **Rental GL vs ops** reconciliation checklist per company.  
10. **Retire duplicate expense** leaves via transfer JEs, not delete.

---

## Accounts / families — do NOT touch until final validation

- **`journal_entry_lines`** historical `account_id` targets with activity — **never** delete account rows without migration plan.
- **Core controls** `1100`, `2000`, `1000`, `1010`, `1020`, `1200`, `3000` — **no** code reuse for different meanings mid-flight.
- **Opening-balance** reference types and existing opening JEs — validate in staging before any mass reclass.
- **`203x` courier** accounts created by RPC — do not rename codes without updating RPC + shipment service.
- **Voided JE chains** — audit-only; do not “delete” void history.

---

*End of workbook.*
