# Reports + Chart of Accounts — Master Redesign (Unified Foundation)

**Project:** NEWPOSV3 ERP  
**Last updated:** 2026-03-27  
**Audience:** Product, engineering, finance ops  
**Scope:** Chart of Accounts (COA), account hierarchy, party subledgers, and all financial reports that consume GL data — **designed as one system**, not two isolated modules.

---

## 1. Executive summary

This ERP’s financial truth lives in **double-entry journals** (`journal_entries` + `journal_entry_lines`) scoped to **`accounts`** (COA). Reports (Trial Balance, P&L, Balance Sheet, ledgers, statements) must remain **mathematically consistent** with that truth. The Chart of Accounts must therefore define:

- **Which accounts are control (summary) vs postable leaves**
- **Where party subledgers hang** (AR/AP under `1100` / `2000`, with `linked_contact_id`)
- **How reporting modes avoid double counting** when users want “family total” vs “expanded party detail”

The codebase already encodes a **source lock** (journal-only GL; voided entries excluded) and **partial AR/AP presentation modes** (flat / summary / expanded) in `accountingReportsService`. The **Balance Sheet** already rolls AR/AP **children into the control line** so the statement does not list duplicate parties.

**Gaps to close for a “final foundation”:**

1. **Worker and bank visibility** are not yet symmetric with AR/AP in Trial Balance presentation (TB expansion today targets `1100` / `2000` families only).
2. **Control account `1100`** is seeded **without** a section group parent (unlike cash/bank), which can make the tree feel inconsistent vs other sections.
3. **P&L classification** uses a **cost-of-production code set** that includes `5200` / `5300` — the same numeric band used elsewhere for **discount / extra expense** in sale accounting comments; **account code semantics must be normalized** so P&L never mis-buckets revenue-side or P&L-adjustment accounts as COGS.
4. **Multiple “ledger” engines** (operational vs GL) remain; naming and UX must stay explicit per `PARTY_LEDGER_UNIFICATION_PLAN.md`.

---

## 2. Current problems found (codebase-grounded)

### 2.1 COA / hierarchy

| Issue | Evidence / impact |
|--------|-------------------|
| **AR control sits alone** | `defaultAccountsService` puts `1100` Accounts Receivable with `parentCode: null` while other operational areas use explicit groups (`1050`, `1060`, `2090`, …). UI tree and mental model differ from “Cash & Bank” style grouping. |
| **Legacy revenue code** | `shouldSkipSalesRevenueSeed` avoids duplicating `4100` if `4000` exists — legacy companies may still have both; reporting must treat one as canonical revenue anchor. |
| **Group vs leaf** | `COA_HEADER_CODES` / `is_group` exclude header rows from Balance Sheet and payment pickers — correct pattern, but **must be enforced** for any new “section headers” so they are never postable. |
| **Worker AP/AR** | `1180` Worker Advance, `2010` Worker Payable are seeded; **per-worker GL subledgers** are not created by `partySubledgerAccountService` (only customer/supplier). Worker balances mix **journal** (`2010`/`1180`) and **operational** (`worker_ledger_entries`) — reconciliation is explicit in `controlAccountBreakdownService` notes. |

### 2.2 Party subledgers

| Issue | Impact |
|--------|--------|
| **Posting target** | `resolveReceivablePostingAccountId` / `resolvePayablePostingAccountId` prefer **child** account when contact exists — correct subledger model. |
| **Fallback without `linked_contact_id`** | If DB column missing, service creates child **without** link — reporting still works by GL account, but **contact resolution** degrades. |

### 2.3 Reports

| Issue | Impact |
|--------|--------|
| **Trial Balance flat mode** | Lists **every account with activity**; if both **control** and **children** were ever posted (should be avoided), totals would double-count. **Enforcement belongs in posting rules**, not only UI. |
| **TB summary/expanded** | Implemented for **AR/AP families only** (`applyTrialBalanceArApPresentation`). Worker payable (`2010`) and bank/cash **do not** get the same presentation toggles yet. |
| **Balance Sheet** | Correctly **excludes** `is_group` headers and **AR/AP child rows**, and **rolls** child balances into `1100`/`2000` lines — good double-count prevention for BS. |
| **P&L** | Driven off TB rows by `account_type`; cost bucket uses `COST_OF_PRODUCTION_CODES` — **must align** with final COA code map (see §5.3). |
| **Sales Profit report** | Uses `sales.total` and line costs — **document truth**; must stay aligned with GL revenue/COGS when postings are correct (see `REPORTING_RECONCILIATION.md`). |

### 2.4 Audit / effective views

| Issue | Impact |
|--------|--------|
| **Voided JEs** | Excluded from TB — good for **effective** GL. |
| **Adjustment layers** | Sale/purchase services use **delta** and **reversal** patterns — **audit** views should surface `reference_type` / `is_void` / adjustment JE types; **operational** views should show **one effective line per business event** where possible. |

---

## 3. Final Chart of Accounts design (recommended target)

### 3.1 Design principles

1. **One GL engine** — all balances for reporting come from `journal_entry_lines` (void excluded), not from `accounts.balance` as primary truth.
2. **Control + subledger** for **any** party balance that must be both **rolled up** (financial statements) and **drilled down** (statements): **customers (AR)**, **suppliers (AP)**; extend to **workers** and **banks** as phased enhancements.
3. **Summary-only accounts** (`is_group: true`, codes in `COA_HEADER_CODE_LIST`) — **never** receive postings; children hold activity.
4. **Postable leaves** — default liquidity (`1000`, `1010`, `1020`, …), inventory `1200`, revenue/expense leaves, **control accounts** where the product posts **only to control** *or* **only to children**, never both for the same economic flow.

### 3.2 Recommended hierarchy (canonical)

**Assets**

| Code | Name | Role |
|------|------|------|
| `1050` | Cash & Cash Equivalents | **Group** (non-posting) |
| `1000` | Cash | Posting — default cash |
| `1001` | Petty Cash | Posting |
| `1060` | Bank Accounts | **Group** |
| `1010` | Bank | Posting — default bank |
| `1070` | Mobile Wallets | **Group** |
| `1020` | Mobile Wallet | Posting |
| `1080` | Worker Advances | **Group** |
| `1180` | Worker Advance | Posting — control for advances (net with worker payable in ops) |
| `1090` | Inventory | **Group** |
| `1200` | Inventory | Posting |
| *(optional)* `1105` | Trade Receivables (group) | **Group** — *optional* UX wrapper |
| `1100` | Accounts Receivable | **Control** — post to **child** `AR-{contact}` when party known; avoid posting to `1100` and `AR-xxx` for same invoice |
| `AR-*` | Receivable — {Party} | **Subledger** — `parent_id = 1100`, `linked_contact_id` set |

**Liabilities**

| Code | Name | Role |
|------|------|------|
| `2090` | Trade & Other Payables | **Group** |
| `2000` | Accounts Payable | **Control** — post to **child** `AP-{contact}` when supplier known |
| `AP-*` | Payable — {Party} | **Subledger** |
| `2010` | Worker Payable | **Control** — *future*: `WP-{worker}` children (see roadmap) |
| `2011` | Security Deposit | Posting |
| `2020` | Rental Advance | Posting |
| `2030` | Courier Payable (Control) | Posting / control for courier |

**Equity**

| `3090` | Equity | **Group** |
| `3000` | Owner Capital | Posting |

**Income**

| `4050` | Revenue | **Group** |
| `4100` | Sales Revenue | Posting (canonical; retire duplicate `4000` over time) |
| `4200` | Rental Income | Posting |

**Expenses**

| `6090` | Operating Expenses | **Group** |
| `5000` | Cost of Production / COGS | Posting — **cost of sales** bucket for P&L |
| `6100` | Operating Expense | Posting |
| `6110` | Salary Expense | Posting |
| `6120` | Marketing Expense | Posting |

**Reserved / module-specific** (illustrative — align with `saleAccountingService` / migrations)

- Discount allowed, shipping income, extra expense — **each** should have **unambiguous** `type` + **code band** so P&L never treats them as COGS.

---

## 4. Account classification and hierarchy

| Class | DB signals | Reporting |
|-------|------------|-----------|
| **Section header** | `is_group === true`, code in `COA_HEADER_CODES` | Excluded from TB row lists that show “only postable accounts”; excluded from BS line items; hidden from payment pickers |
| **Control** | Named control (`1100`, `2000`, `2010`); may have `is_group` false | TB: either **no direct postings** (ideal) or **rolled** presentation; BS: **one line** with rolled balance |
| **Subledger** | `parent_id` = control; `linked_contact_id` optional | TB expanded: indented under control; statements: party name from `contacts` |
| **Postable leaf** | No children expected | Full account ledger |

---

## 5. AR / AP / Worker / Bank architecture

### 5.1 Accounts Receivable (`1100` + `AR-*`)

- **Posting rule:** For every **final** sale with a **customer contact**, resolve `resolveReceivablePostingAccountId` → post invoice **Dr** to `AR-{contact}` (or `1100` if no child).
- **Control:** `1100` should **roll up** children for BS and TB summary; **avoid duplicate posting** to `1100` + child for the same invoice.

### 5.2 Accounts Payable (`2000` + `AP-*`)

- Mirror of AR for suppliers.

### 5.3 Worker Payable / Advance (`2010` / `1180`)

- **Today:** Bills and payments hit **global** `2010` and `1180` with **worker** identified on `journal_entries.reference_id` / `reference_type`, not per-worker GL accounts.
- **Target:** Optional **per-worker subledger** under `2010` (and mirrored advance under `1180`) for TB expansion — same pattern as AR/AP.

### 5.4 Cash / Bank / Wallet

- **Today:** Single default accounts per type (`1000`, `1010`, `1020`) under groups.
- **Target:** Optional **per-bank** or **per-cashbox** accounts as children of `1060`/`1050` for expanded bank statement and TB; **summary mode** rolls to one “Cash & Bank” family or shows single liquidity line per policy.

---

## 6. Posting rules by module (summary)

| Module | Posting surface | Notes |
|--------|-----------------|-------|
| **Sales** | `saleAccountingService` | Document JE: `payment_id IS NULL`; only **final** status + invoice number |
| **Purchases** | `purchaseAccountingService` | Document JE: `payment_id IS NULL` |
| **Payments** | AccountingContext / triggers | Payment JEs reference `payment_id`; **isolation** from document JEs (`PAYMENT_ISOLATION_RULES.md`) |
| **Expenses** | expense + accounting | Expense account + payment/liability |
| **Manual entry** | ManualEntryDialog | Must respect control accounts (warnings in diagnostics) |
| **Rental** | rental + accounting | Rental income + advances; align with `2020` |
| **Worker** | worker payment / advance services | `2010`/`1180` + studio stage bills |
| **Studio / production** | studio services | Stage costs → expense + payable patterns |
| **Opening / inventory** | `openingBalanceJournalService`, stock triggers | Opening and adjustments post to GL; inventory `1200` |

---

## 7. Report design rules

### 7.1 Global

| Report | Data source | Void handling |
|--------|-------------|---------------|
| Trial Balance | `journal_entry_lines` → `journal_entries` + `accounts` | Exclude `is_void = true` |
| P&L | Derived from TB (period) | Same |
| Balance Sheet | TB from inception → as-of date | Same |
| Account ledger / GL | Journal lines per account | Same |
| Day Book / Roznamcha | Journal + **payments** where applicable | Roznamcha policy per `ROZNAMCHA_POLICY_LOCK.md` |
| Customer/supplier **operational** statement | Sales/purchases/payments APIs | **Not** GL-only |
| Customer/supplier **GL** statement | Journal lines filtered by party resolution | GL truth |

### 7.2 Summary vs detailed

- **Summary:** One line per **reporting family** (AR rolled, AP rolled, optional liquidity rolled).
- **Detailed:** Subledger / JE lines; **audit** mode shows references, void, adjustment types.

### 7.3 Effective vs audit

| View | Purpose | Content |
|------|---------|---------|
| **Effective** | Management / ops | Running balances, net of voids; **one** logical line per business event where possible |
| **Audit** | Finance / compliance | Full JE chain, voids, reversals, deltas, `reference_type` |

---

## 8. Trial Balance behavior

**Modes (implemented for AR/AP):**

| Mode | Behavior |
|------|----------|
| `flat` | One row per account with activity — **fast**; risk if **both** control and children incorrectly posted |
| `summary` | Replaces all `1100` + `AR-*` rows with **one** “subledger total” row; same for AP |
| `expanded` | Excludes non-family AR/AP from middle sort; **blocks** AR and AP with **indent** for children |

**Totals:** `totalDebit` and `totalCredit` use **raw sums** across lines; presentation **must not** change totals when switching AR/AP mode (rows are **replaced** or **rolled**, not duplicated).

**Extension:** Apply the same **family** idea to **`2010` + future worker children** and optionally **cash/bank** groups.

---

## 9. Balance Sheet behavior

- **Excludes** COA header groups and `is_group` accounts.
- **Excludes** AR/AP **child** rows from the line list.
- **Rolls** child balances into **`1100`** and **`2000`** lines (`rolledArBalance` / `rolledApBalance`).
- **Net income** line appended to equity from cumulative revenue/expense accounts (no formal closing entry in current model).

**Asset grouping:** `classifyBalanceSheetAsset` uses type + parent chain + codes (`accountHierarchy.ts`).

**Liability grouping:** `classifyBalanceSheetLiability` — trade vs payroll vs deposits vs courier.

---

## 10. Statement behavior (party + operational)

| Statement | Engine | User-facing label |
|-----------|--------|-------------------|
| Customer open items | Operational APIs | “Customer — open items” |
| Customer GL (AR) | Journal + party filter | “Customer — GL (AR)” |
| Supplier operational | Purchases/payments / legacy ledger | **Label** as non-GL if not journal-only |
| Worker | `worker_ledger_entries` + GL | Split **operational** vs **GL** per `PARTY_LEDGER_UNIFICATION_PLAN.md` |

---

## 11. Effective vs audit view rules

1. **Header-only edits** (date, reference, memo): update document/journal header **without** new economic lines where policy allows; **no** fake “adjustment” in customer-facing views.
2. **Amount / account / qty / value changes:** **delta** or **reversal + repost** per module contracts; **effective** screens show **net** position; **audit** shows **all** JEs.
3. **Void:** excluded from TB; **audit** lists void flag and reason.
4. **Reports for ops:** default to **effective**; **admin** toggles **audit** or “show technical lines”.

---

## 12. Double counting prevention rules

1. **Rule A — Single posting target per flow:** For a given sale invoice line, **either** post to **party subledger** **or** to **control**, not both.
2. **Rule B — BS aggregation:** Always **one** of: (i) control line with rolled children, or (ii) children only — **never** both in the same statement (current BS logic satisfies this for AR/AP).
3. **Rule C — TB summary mode:** **Replace** family rows with one rolled row (implemented for AR/AP).
4. **Rule D — TB expanded mode:** Show control **and** children **without** summing them again into a pseudo-total row (indentation is visual; **grand totals** still use raw journal sums).
5. **Rule E — P&L:** Exclude **balance sheet** accounts by definition; **revenue** and **expense** types only — **cost** bucket must use **explicit** code list aligned with COA.

---

## 13. Accounts to keep / merge / rename / deprecate

| Item | Recommendation |
|------|----------------|
| `4000` vs `4100` | **Keep** one canonical **Sales Revenue** (`4100`); **migrate** legacy `4000` balances and mappings; **deprecate** `4000` for new postings |
| Duplicate “Operating Expense” user-created accounts | **Merge** into `6100` or named children under `6090` with clear types |
| Extra bank/cash accounts | **Reparent** under `1050`/`1060`/`1070` per `auditAccountHierarchy` |
| `5200` / `5300` | **Clarify** in COA: if used for **discount** / **extra expense**, **remove** from `COST_OF_PRODUCTION_CODES` in P&L or **move** activity to dedicated codes |
| `chart_accounts` | **Do not** use as master for GL (per existing audits) |

---

## 14. Migration / cleanup strategy (non-destructive first)

1. **Inventory** current accounts per company: export `accounts` + journal activity counts.
2. **Flag** inactive duplicates; **no** hard delete of accounts with journal history.
3. **Reparent** and **rename** with migrations or admin tools; **merge** only by **mapping** old `account_id` → new in a controlled migration with **reposting** or **balance transfer** JEs.
4. **Backfill** `linked_contact_id` on AR/AP children where missing.
5. **Enforce** `is_group` for all new section headers.

---

## 15. Risks and safety checks

| Risk | Mitigation |
|------|------------|
| Reposting changes history | Use **reversal** + **adjustment** layers; never silent delete |
| TB imbalance | Monitor `difference` in `getTrialBalance`; alert if ≠ 0 |
| Ops vs GL mismatch | Reconciliation dashboard (`getArApGlSnapshot`, contacts variance) |
| Branch filters | `journalEntryMatchesBranchFilter` — NULL branch = company-wide; document behavior for **opening** rows |

---

## 16. Implementation roadmap (phased)

| Phase | Focus | Deliverables |
|-------|--------|--------------|
| **1** | Analysis + lock | This document; confirm code ownership for P&L cost bucket; confirm AR/AP posting discipline |
| **2** | Non-destructive COA | Optional `1105` group for AR; **enforce** `is_group`; `linked_contact_id` backfill; hierarchy repair job |
| **3** | Report alignment | TB modes for **worker** + **liquidity**; P&L code map fix; BS labels |
| **4** | Posting alignment | Single target per sale/purchase; **no** dual control+child posting; shipment/courier rules aligned with `ERP_COA_REVIEW` |
| **5** | Optional migration | Merge `4000`→`4100`; retire duplicate expense accounts via transfer JEs |
| **6** | Cutover / cleanup | Feature flags off; **deprecate** legacy paths; user training on operational vs GL |

---

## 17. Posting matrix (module → accounts)

**Legend:** **C** = control account; **S** = subledger (child); **Dr/Cr** = debit/credit for normal business sense (not tax-specific).

| Flow | Debit | Credit | Control vs subledger |
|------|-------|--------|----------------------|
| **Sale invoice (credit)** | `AR` S or C | Revenue, shipping income, etc. | Prefer **S** = `AR-{customer}` |
| **Sale invoice (cash)** | Cash/Bank/Wallet | Revenue | Liquidity leaf |
| **Sale COGS** | `5000` (or dedicated COGS) | `1200` Inventory | Inventory leaf |
| **Sale payment (customer)** | Cash/Bank | `AR` S or C | **S** preferred |
| **Customer advance / on-account** | Cash/Bank | `AR` or unearned revenue per policy | Align with `payment_allocation` rules |
| **Purchase bill** | `1200` (+ landed cost) | `AP` S or C | Prefer **S** = `AP-{supplier}` |
| **Supplier payment** | `AP` S or C | Cash/Bank | **S** preferred |
| **Expense** | Expense account | Cash/Bank / AP | Expense leaf |
| **Manual journal** | As per entry | As per entry | **Avoid** manual on **C** without policy |
| **Rental booking / charge** | AR / receivable | Rental income | Per rental service |
| **Rental payment** | Cash vs rental liability | Per policy | See rental advance `2020` |
| **Worker advance** | `1180` | Cash/Bank | Global |
| **Worker payment** | `2010` or `1180` | Cash/Bank | `shouldDebitWorkerPayableForPayment` |
| **Production / studio stage cost** | `5000` (or dedicated) | `2010` | Stage billing |
| **Opening balance** | Mixed | Mixed | `openingBalanceJournalService` |
| **Inventory movement (financial)** | Inventory / adjustment | COGS / suspense | Stock triggers |

---

## 18. Frontend UX recommendations

| Area | Recommendation |
|------|----------------|
| **COA tree** | Show **section headers** collapsed; **badge** “Group” vs “Postable”; **control** badge on `1100`/`2000`/`2010` |
| **Payment pickers** | Exclude `COA_HEADER_CODES` (already) |
| **Trial Balance** | Toggle: **Flat** / **Summary** / **Expanded**; extend beyond AR/AP when backend supports |
| **Balance Sheet** | Keep **one line** for AR/AP; **drilldown** to party list from control row |
| **Statements** | **Operational** tab vs **GL** tab; never the same label for two engines |
| **Admin** | Audit toggle on Account Ledger / Journal |

---

## 19. Older audit docs to review before execution

Read in this order for **constraints** and **history**:

1. `docs/accounting/REPORTING_RECONCILIATION.md` — GL source lock  
2. `docs/accounting/PAYMENT_ISOLATION_RULES.md` — payment vs document JEs  
3. `docs/accounting/PARTY_LEDGER_UNIFICATION_PLAN.md` — naming / engines  
4. `docs/ERP_ACCOUNTING_STRUCTURE.md` — who posts where  
5. `docs/accounting/ERP_COA_REVIEW_AND_ISSUES_TRACKER_v3.md` — known issues (shipping, AR/AP confusion)  
6. `docs/accounting/BALANCE_SOURCE_POLICY.md` — balance display policy  
7. `docs/accounting/PHASE8_LEGACY_RETIREMENT_MAP.md` — legacy retirement  
8. `docs/ROZNAMCHA_POLICY_LOCK.md` — Roznamcha  
9. `docs/CERTIFICATION_PHASE_POSTING_STOCK_COA.md` — inventory/stock  
10. `docs/accounting/JOURNAL_ENGINE_MASTER_PLAN.md` — journal engine direction  

---

## 20. Appendix — key implementation files

| Concern | File(s) |
|---------|---------|
| COA seed | `src/app/data/defaultCoASeed.ts`, `src/app/services/defaultAccountsService.ts` |
| Hierarchy + BS classification | `src/app/lib/accountHierarchy.ts` |
| Party subledgers | `src/app/services/partySubledgerAccountService.ts` |
| Reports | `src/app/services/accountingReportsService.ts` |
| Control kind / breakdown | `src/app/lib/accountControlKind.ts`, `src/app/services/controlAccountBreakdownService.ts` |
| Sale / purchase posting | `src/app/services/saleAccountingService.ts`, `purchaseAccountingService.ts` |

---

*End of document.*
