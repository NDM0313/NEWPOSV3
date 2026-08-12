# Pooled USD → RMB multi-supplier settlement workflow

> **Document type:** Canonical next-spec workflow (documentation only — not implemented).  
> **Parent design:** [`MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md`](./MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md)  
> **Cursor rule:** [`.cursor/rules/multi-currency-import-fx.mdc`](../../.cursor/rules/multi-currency-import-fx.mdc)  
> **Historical shipped references (do not rewrite):** [`MULTI_CURRENCY_IMPORT_FX_ROADMAP.md`](./MULTI_CURRENCY_IMPORT_FX_ROADMAP.md), [`MULTI_CURRENCY_IMPORT_FX_WORKFLOW_AND_COA.md`](./MULTI_CURRENCY_IMPORT_FX_WORKFLOW_AND_COA.md)  
> **Shipped Path 21:** Agent dual-credit FC buy (`fx_currency_purchases`) remains a **separate** workflow and must stay unchanged by this design.

**Status:** Design + forensic baseline (2026-08-11)  
**Base books:** PKR  
**Operational currencies:** USD, CNY (UI may show RMB; store ISO **CNY**)  
**Gates:** `multiCurrencyEnabled` (ops) · `fxSettlementAccountingEnabled = false` (Profile A — no FX P&L journals)

This document does **not** authorize migrations, RPCs, UI, or production changes.

---

## 0. Path 21 forensic duplicate-entry audit (live, read-only)

Audit date: 2026-08-11. No rows were modified, voided, or rewritten for this audit.

### 0.1 Expected Path 21 accounting (three events, each once)

| Step | Event | Raw GL |
| --- | --- | --- |
| 1 | Buy FC on agent credit | Dr TT wallet / Cr Agent AP |
| 2 | Pay agent PKR | Dr Agent AP / Cr Bank |
| 3 | Pay China supplier from wallet | Dr Supplier AP / Cr TT wallet |

These are **expected separate business events**, not duplicates of each other.

### 0.2 Live inventory summary

| Check | Result |
| --- | --- |
| Active non-void `fx_currency_purchases` | **0** |
| Active non-void FX credit JEs | **0** |
| Settlement rows | **2** (both on void credits; linked payments voided) |
| Payments linked to multiple settlements | **0** |
| Duplicate `(fx_currency_purchase_id, payment_id)` pairs | **0** |
| Two JE headers for the same `reference_id` (fx credit) | **0** |
| `client_operation_id` / Step-1 idempotency column on `fx_currency_purchases` | **Present** (Wave 0 — UNIQUE per company when set) |

### 0.3 Case matrix (known references)

| Ref | Raw facts | Classification |
| --- | --- | --- |
| `JV-000341` | CNY 5,000 @ 43 → PKR 215,000; Dr `1205` / Cr `AP-SUP0001` Qing Boyu; agent contact **type=`supplier`**; voided | **(3) Role-mixed ledger reporting** root cause + **(5) Voided historical**. One balanced JE — **not** a true double header for one event. |
| `PAY-0325` | PKR 215,000 on_account to Qing Boyu from Bank `1010`; voided | **(2) Expected separate event** (agent settle). Same contact as supplier → Supplier Ledger “Payments Paid” could show **215k+215k** with Step 3 if role filter off. |
| `PAY-0326` | PKR 215,000 purchase-linked to Qing Boyu from `1205`; voided | **(2) Expected separate event** (China settle). |
| `JV-000342` | USD 300 @ 288 → PKR 86,250; Dr `1202` / Cr `AP-0140EB` RMB AGENT (`money_exchange`); voided + `JE-0328` correction_reversal voided | **(2)** Valid Path 21 Step-1 shape. Pair with 343 → **(7) Retry/double-submit risk** (two acquisition rows for identical economic intent). |
| `JV-000343` | Identical description/amount/agent/wallet to 342; separate `fx_currency_purchases` id; voided + `JE-0330` | **(7) Retry/double-submit duplicate intent** (two genuine postings of two credits — not join-multiplied rows). |
| `PAY-0327` / `PAY-0328` | Agent settles 86,250 each; voided; each UNIQUE-linked to 342 / 343 settlements | **(2)** Expected agent-pay events for each credit. Settlement rows remain after void → **(6) Orphaned settlement/link residual** (historical bridge rows; payments/credits void). |
| `PAY-0329` | China settle 86,250 from `1202` to Qing Boyu purchase; voided | **(2)** Expected supplier settle. |

### 0.4 Raw GL vs rendered ledger

| Layer | Finding |
| --- | --- |
| Raw JE lines | Balanced; one credit JE per `fx_currency_purchases` row; payment JEs separate. |
| Party AP child | One AP leaf per `contact_id` under 2000. Supplier-as-agent → FX credit + merchandise share leaf → **role mix**. |
| Supplier GL RPC | `get_supplier_ap_gl_ledger_for_contact` is contact/AP-leaf scoped; role split is **client-side** (`importFxPartyLedgerRoleFilter`). |
| Opening balance after role filter | Period opening still from **unfiltered** party AP → Supplier vs Agent FX closing can skew. |
| Account / Bank ledgers | Full account history; no party-role filter (correct for Generic GL). |
| Operational supplier ledger | Excludes `fx_currency_purchase_settlements.payment_id`; Effective Party path historically may not. |
| Summary cards | Must use same filtered dataset as table/export (Wave 0 / Wave P5 requirement). |

### 0.5 Idempotency / concurrency (shipped)

| Control | Status |
| --- | --- |
| UNIQUE `(fx_currency_purchase_id, payment_id)` | Present |
| Step-1 `client_operation_id` | **Present** — UNIQUE(company_id, client_operation_id) WHERE NOT NULL; RPC arg on credit |
| Wizard `submittingRef` / busy | Present (UI only; server claim/idempotency is authoritative) |
| Step 2/3 claim-before-pay | **Present** — `claim_import_fx_client_operation` before `createSupplierPayment`; finalize/release RPCs |
| `(company_id, source_type, source_id, posting_type)` unique posting | **Not** enforced for Path 21 credit |

### 0.6 Forensic verdict

| Question | Answer |
| --- | --- |
| Active true duplicate money posting? | **No** (all audited Path 21 FX credits/payments void). |
| Historical true double-header for one `reference_id`? | **No**. |
| Dangerous pattern still open? | **Mitigated for Path 21** — Step-1 server idempotency + Step 2/3 claim-before-pay shipped; residual risk if agent≠`money_exchange` or role filter bypassed. |
| Pooled-workflow implementation status | **NO-GO** until Waves approved; docs-only this task. |
| Safest correction if live duplicate ever found | Do **not** DELETE. Void China PAY → void agent PAY → void FX credit (JE + correction_reversal pair) per Path 21 cancel order. Document only — do not execute in this task. |

**Wave 0 status note:** Role guards + searchable selectors + UI submit locks + supplier/agent role filters + Step-1 `client_operation_id` + settlement lifecycle + Step 2/3 **claim-before-pay** are implemented. Pooled Waves P1–P5 remain approval-gated.

---

## 1. Business workflow

```text
Supplier purchase invoice in RMB/CNY (Event A)
        ↓
Company buys USD/TT from money-exchange agent (Event B)
        ↓
Company pays/settles the agent (Event C) — separate from supplier
        ↓
USD may transfer local/agent USD wallet → China USD holding (Event D)
        ↓
China converts USD → CNY into a pooled RMB/CNY wallet (Event E)
        ↓
Same CNY pool allocates to one or many supplier invoices (Event F)
```

Commercial realities this model must support:

- One USD TT may fund **many** suppliers.
- One supplier may receive **many** partial CNY allocations.
- Purchase rates (invoice PKR/CNY) differ from acquisition and conversion rates.
- Explicit agent/converter fees stay **separate** from rate difference / operational benefit.
- One TT must **not** be forced 1:1 to one purchase.

Path 21 (direct FC credit → wallet → supplier) remains available as a **different** workflow when the company buys FC that is already the settlement currency without a pooled USD→CNY leg.

---

## 2. Accounting event matrix

### Event A — Supplier purchase (CNY invoice)

| Field | Meaning |
| --- | --- |
| Original currency | CNY |
| Original / open CNY | Invoice FC |
| Purchase rate | PKR per CNY |
| PKR book value | Locked GL carrying liability |

```text
Dr Inventory/Purchases PKR
Cr Supplier AP PKR
```

Creates / updates **supplier FX open item** (operational). Does not consume any USD/CNY pool.

### Event B — Buy USD/TT from money-exchange agent

Required: agent (`money_exchange`), USD qty, PKR/USD rate, total PKR cost, datetime, branch, reference, USD receiving wallet, mode `AGENT_CREDIT` | `AGENT_PREPAID`, optional fee, `client_operation_id`.

```text
total_pkr_cost = usd_quantity × pkr_per_usd
```

**Agent credit (preserve Path 21 meaning):**

```text
Dr USD TT Wallet                 PKR acquisition cost
Cr Agent AP (2000 child)         PKR acquisition cost
```

Operational: USD qty +, PKR carrying +. **Must not touch Supplier AP.**

**Prepaid (future mode — must not silently replace Path 21):**

```text
Dr Agent Advance/Clearing / Cr Bank
… later …
Dr USD TT Wallet / Cr Agent Advance/Clearing
```

Do **not** overload `record_payment_with_accounting` for the FC credit acquisition step.

### Event C — Pay / settle the agent

```text
Dr Agent AP
Cr PKR Bank/Cash
```

Must reference the USD acquisition; partial pays allowed in design; never reduces Supplier AP. Reuse `createSupplierPayment` + `apply_fx_currency_purchase_settlement` **where compatible** with Path 21; pooled acquisition batches need an additive allocation bridge.

### Event D — Transfer USD to China USD wallet

```text
Dr China USD Holding Wallet
Cr Origin USD Wallet
```

Equal PKR carrying both sides. Fee (qty or PKR) recorded explicitly — never buried in supplier settlement or FX benefit.

### Event E — Convert USD → CNY (pool creation)

```text
execution_cny_per_usd = cny_received ÷ usd_consumed

effective_pkr_per_cny =
    total_pkr_carrying_cost_of_usd_and_allowed_fees
    ÷ cny_received
```

Optional benchmark:

```text
expected_cny = usd_consumed × benchmark_cny_per_usd
operational_benefit_cny = actual_cny_received − expected_cny
```

**Profile-A PKR GL:**

```text
Dr China CNY Pool Wallet
Cr China USD Holding Wallet
```

Equal PKR carrying (fees separate). Operational: USD −qty, CNY +qty. Favorable rate → lower effective PKR/CNY — **not** a credit to Supplier AP.

While `fxSettlementAccountingEnabled = false`: calculate/display benefit and differences; **never** post 1395 / 2295 / 6100 / 7100 or realized FX P&L.

### Event F — Allocate pooled CNY to suppliers

One conversion → one shared CNY pool/lot → N allocations across suppliers/invoices/dates.

```text
allocated_invoice_book_pkr =
    original_invoice_book_pkr × allocated_cny ÷ original_invoice_cny

allocated_pool_cost_pkr =
    allocated_cny × effective_pool_pkr_per_cny

fx_difference_pkr =
    allocated_pool_cost_pkr − allocated_invoice_book_pkr
```

Rules: pool CNY and invoice remaining CNY cannot be overspent; one allocation → one open item; batch may hold many allocations; closing rounding residue on **final** allocation only; `FOR UPDATE` on pool + open items; atomic; supplier settles only when CNY allocation/payment confirmed — **not** when USD is bought or converted.

---

## 3. Profile-A accounting limitation (mandatory honesty)

Approved configuration for this design:

```text
multiCurrencyEnabled = true
fxSettlementAccountingEnabled = false
```

Under Profile A:

1. Operationally consume CNY from the pool.
2. Reduce Supplier AP by the invoice’s **allocated PKR book value**.
3. Preserve a balanced existing-style PKR payment journal (Dr Supplier AP / Cr CNY wallet) **only when** the wallet PKR carrying released equals the AP book released **or** an approved bridging treatment exists.
4. Store `fx_difference_pkr` in an `FX_REVIEW_REQUIRED` reconciliation record.
5. Surface wallet PKR-versus-quantity residual in reconciliation reports.
6. Do **not** pretend the difference is recognized in GL.
7. Do **not** shift conversion benefit into Supplier AP.
8. Do **not** auto-create P&L.

### Profile-A settlement posting — blocked gap (explicit)

If `allocated_pool_cost_pkr ≠ allocated_invoice_book_pkr`, a single two-line payment journal cannot both:

- clear Supplier AP at book value, and  
- relieve the CNY wallet at true pool carrying cost,

without a third balancing leg (pending FX / P&L) **or** silently corrupting wallet/AP reconciliation.

**Decision for this design:** that unbalanced Profile-A settlement step is **BLOCKED** pending separately approved accounting treatment (Phase 3 or an explicitly approved residual account). Implementers must not invent a hidden balancing entry. Until unblocked, systems may:

- post supplier payment at **book PKR** and record operational CNY quantity consumption + `FX_REVIEW_REQUIRED` for the carrying residual, **or**
- refuse confirmation when residual ≠ 0 within tolerance,

whichever future wave approval selects — both must remain transparent in reports.

---

## 4. State machine

```text
DRAFT
→ USD_ACQUIRED
→ AGENT_PARTIALLY_PAID / AGENT_PAID
→ USD_TRANSFERRED
→ CONVERSION_PENDING
→ CNY_POOL_CREATED
→ PARTIALLY_ALLOCATED
→ FULLY_ALLOCATED
```

Correction: `CANCELLED` (pre-post) · `REVERSED` (post-post).

Not every state is required for every path (e.g. skip transfer if USD is acquired directly into China holding). Each real business event has its own confirmation, timestamp, evidence, and `client_operation_id`.

---

## 5. Live schema vs target additive model

### 5.1 Reuse (do not duplicate)

| Live object | Role |
| --- | --- |
| `purchases` (+ FX nullable cols) | Event A invoice / PKR GL drivers |
| `purchase_items` | Line detail |
| `payments` | Agent/supplier PKR payment documents |
| `fx_currency_purchases` | Shipped Path 21 FC acquisition header |
| `fx_currency_purchase_settlements` | Path 21 agent-pay bridge UNIQUE(credit, payment) |
| `contacts` | Supplier / `money_exchange` agent |
| `accounts` / 12xx TT wallets | PKR-valued wallet GL |
| `journal_entries` / `journal_entry_lines` | PKR GL |

### 5.2 Minimum additive concepts (proposed names — finalize at migration time)

Names below are **design labels**. Prefer extending live tables when a 1:1 column fit exists; otherwise additive tables under existing naming (`snake_case`, company/branch scoped).

| # | Concept | Suggested table / extension | Notes |
| --- | ---: | --- | --- |
| 1 | USD/FC acquisition batch | `import_fx_acquisition_batches` **or** extend `fx_currency_purchases` with mode/currency/legs | Path 21 rows remain; pooled USD buys may share shape with stricter idempotency |
| 2 | Agent funding/payment allocations | `import_fx_agent_payment_allocations` | Bridge payment → acquisition; partials |
| 3 | Foreign wallet metadata | `foreign_currency_wallets` | Metadata keyed to existing `accounts.id`; one operational currency |
| 4 | Immutable wallet qty movements | `wallet_movements` | Signed qty + PKR carrying; source_type/source_id |
| 5 | USD wallet transfer | `import_fx_wallet_transfers` | Event D header |
| 6 | USD→CNY conversion batch | `currency_conversions` | Event E header |
| 7 | Conversion legs | `currency_conversion_legs` or sequenced rows | from/to qty + carrying |
| 8 | CNY pooled balance/lot | Derived from movements + `import_fx_cny_pool_lots` cache | Weighted-average default |
| 9 | Supplier FX open items | `supplier_fx_open_items` | From posted foreign purchases |
| 10 | Supplier settlement batch | `supplier_settlements` | Header; payment_mode includes pooled |
| 11 | Settlement allocations | `supplier_settlement_allocations` | One open item each |
| 12 | Allocation↔conversion lot | FK on allocation to pool/lot id | Traceability |
| 13 | Reconciliation exceptions | `fx_reconciliation_exceptions` | `FX_REVIEW_REQUIRED` |
| 14 | Idempotency/audit | `client_operation_receipts` | UNIQUE(company_id, event_type, client_operation_id) |
| 15 | Reversal linkage | `reversal_of_*` FKs on headers + JE void pairs | No DELETE of posted money |

Relationship:

```text
Agent/Bank
→ FC Acquisition Batch
→ USD Wallet Movement
→ China USD Transfer
→ Currency Conversion
→ CNY Pool/Lot
→ Supplier Settlement Batch
→ N Supplier Settlement Allocations
→ N Supplier FX Open Items
```

One acquisition/conversion batch **must** fund many supplier settlements.

---

## 6. Wallet valuation policy (document only)

| Policy | Rule |
| --- | --- |
| Default | Weighted-average carrying cost for pooled CNY |
| Optional | FIFO only if company setting explicitly enables it |
| Ownership | Company-level (`accounting_settings` / future policy keys) |
| Change control | Cannot change while open wallet quantity/lots exist without controlled conversion procedure |
| Allocations | Freeze unit cost used on each outward allocation |
| Immutability | Historical allocation cost never changes when a later conversion enters the wallet |

---

## 7. Idempotency and concurrency design

Every future money command receives `client_operation_id` (UUID).

| Protection | Spec |
| --- | --- |
| Unique receipt | UNIQUE `(company_id, event_type, client_operation_id)` |
| Atomic RPC | Validate → lock → write docs/movements/JE → commit |
| UI | Disable submit while pending; retry returns prior result or clear duplicate response |
| Journal timing | No JE until all validations succeed |
| Allocation locks | `SELECT … FOR UPDATE` on pool lot + supplier open items |
| Source posting | UNIQUE `(company_id, source_type, source_id, posting_type)` |
| Acquisition | One confirmation → at most one wallet credit |
| Conversion | Same USD quantity cannot be consumed twice |
| Allocation | Same FC open amount cannot be reduced twice |
| Reversal | Compensating records only; no deletion |

Path 21 residual: Wave 0 Step-1 idempotency + Step 2/3 claim-before-pay shipped; pooled waves remain gated.

---

## 8. Role-separated reporting

### Supplier Ledger

Include: purchases, returns/adjustments, purchase-linked settlements, FX open-item allocations.  
Exclude: agent FC acquisition credit, agent AP payment, unrelated money-exchange activity.

### Agent Ledger

Include: FC purchased from agent, Agent AP credit, agent payments, refunds/adjustments.  
Exclude: supplier invoice settlement merely because contact was misused.

### Wallet Ledger

Qty, PKR carrying, in/out, lot, source/destination wallet, closing qty + carrying.

### Bank Ledger

Actual PKR cash/bank movements only.

### Conversion Pool Report

USD consumed, CNY received, execution rate, effective PKR/CNY, benchmark benefit, fees, allocated/remaining CNY, supplier allocation list, reconciliation difference.

Separate by **business role/source**, not only `contact_id`. Generic Account Ledger may show full account history. **Rows, summary cards, print, PDF, Excel, CSV must share one filtered dataset.**

---

## 9. Future UI (design only — not implemented)

**Canonical end-to-end case UX (W3–W6):** [`IMPORT_FX_CASE_W3_W6_MONEY_EXECUTION_UX_DESIGN.md`](./IMPORT_FX_CASE_W3_W6_MONEY_EXECUTION_UX_DESIGN.md).

| Screen | Purpose |
| --- | --- |
| 1 Buy USD/TT | Agent search, USD wallet, qty, rate, cost, credit/prepaid, fee, JE preview |
| 2 Transfer USD | Source/dest wallets, sent/received, fee, reference, impact preview |
| 3 Convert USD→CNY | Consumed USD, execution/benchmark rates, CNY in, fee, effective PKR/CNY, benefit preview — no Phase-3 P&L claim |
| 4 Allocate CNY pool | Multi-row supplier/invoice search, outstanding CNY, pool available/allocated/remaining, book vs pool cost, non-posted difference, over-allocation blocked |
| 5 Review & confirm | Timeline, JE + qty preview, allocations, warnings, attachments, idempotent confirm |

Search: server-scoped, paginated, case-insensitive, company/branch restricted.

---

## 10. Multi-supplier example

```text
USD acquisition: USD 10,000 @ PKR 280 = PKR 2,800,000
Transfer to China USD (same carrying)
Convert: USD 10,000 → CNY 100,000 (execution 10.0)
effective_pkr_per_cny = 2,800,000 / 100,000 = 28.00

Allocate:
  Supplier A invoice CNY 20,000 → book at invoice rate; pool cost 20,000×28
  Supplier B CNY 15,000
  Supplier C CNY 30,000
  Remaining pool CNY 35,000
```

Each allocation stores frozen pool unit cost, released invoice book PKR, and `fx_difference_pkr` for Profile-A review.

---

## 11. Acceptance scenarios

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Buy USD on agent credit | Dr USD wallet / Cr Agent AP; Supplier AP untouched |
| 2 | Pay agent fully | Dr Agent AP / Cr Bank; acquisition referenced |
| 3 | Pay agent partially | Due reduced; status AGENT_PARTIALLY_PAID |
| 4 | Transfer USD to China | Equal PKR carrying transfer; qty moves |
| 5 | Convert all USD to CNY | Pool created; USD qty 0 on source |
| 6 | Convert in multiple batches | Multiple lots; WA updates carefully |
| 7 | Pool → one supplier | Single allocation; open item partial/closed |
| 8 | Pool → 10 suppliers | One batch, 10 allocations |
| 9 | Partial supplier allocations | Remaining CNY/PKR open correct |
| 10 | Multiple invoices one supplier | One allocation per open item |
| 11 | Alloc > pool | Rejected |
| 12 | Alloc > invoice CNY due | Rejected |
| 13 | Duplicate confirm/retry | Prior result or clear duplicate; no second JE |
| 14 | Concurrent allocations | One wins; other conflict; pool not overspent |
| 15 | Supplier = agent contact | Blocked or forced role separation per policy |
| 16 | Explicit conversion fee | Fee expense/clearing separate; not in FX benefit |
| 17 | Favorable CNY benefit | Stored/displayed; **no** P&L journal |
| 18 | Unfavorable difference | Stored/displayed; **no** P&L journal |
| 19 | Reverse before allocation | Acquisition/conversion reversed; pool gone |
| 20 | Reverse after partial allocation | Compensating alloc + movements; no DELETE |
| 21 | Multi Currency OFF | Workflow rejected server-side |
| 22 | `fxSettlementAccountingEnabled=false` | No FX P&L / pending FX accounts |
| 23 | Existing Path 21 unchanged | Credit wizard/RPCs still behave as shipped |
| 24 | Ledger rows/cards/exports | No duplicated amounts across filtered dataset |

---

## 12. Failure and reversal cases

| Case | Handling |
| --- | --- |
| Cancel draft | `CANCELLED`; no JE |
| Reverse acquisition before agent pay | Reverse JE; reverse wallet movement; block if qty already transferred/converted |
| Reverse after agent pay | Reverse pay first, then acquisition (documented order) |
| Reverse conversion with allocations | Reverse allocations first (or refuse) |
| Void Path 21 credit | China PAY → agent PAY → void FX credit (existing order) |
| Orphan settlement row after void | Reporting must ignore voided payments; cleanup only via approved data task |

---

## 13. Implementation-wave plan (not executed)

### Wave 0 — Existing Path 21 duplicate/role-report hotfix

**Status (2026-08-12):** Implemented on `main` (Wave 0 + claim-before-pay residual).

| Item | Outcome |
| --- | --- |
| Step-1 `client_operation_id` | Additive column + UNIQUE(company_id, client_operation_id) WHERE NOT NULL; RPC arg `p_client_operation_id`; wizard reuses UUID on retry |
| Step 2/3 retry | `import_fx_client_operations` receipts; apply + china register RPCs |
| Step 2/3 claim-before-pay | `claim_import_fx_client_operation` before `createSupplierPayment`; `finalize_…` / `release_…` on success / pre-pay failure |
| Settlement orphans | `status` active/inactive + void metadata; backfill voided PAY/credit links; payment-void trigger; active-only paid recompute |
| Role ledgers | Opening/cards from same filtered dataset (`splitRoleFilteredApRowsByPeriod` + GL summary strip); Statement V2 supplier uses `partyRole: 'supplier'` |
| Search | SearchableSelect already on agent/purchase/wallet/bank/credit |
| Migrations | `20260811200000_import_fx_wave0_path21_idempotency_settlement_lifecycle.sql`; `20260812120000_import_fx_wave0_claim_before_pay.sql` |

Remaining: Generic Account Ledger stays full-account by design; pooled Waves P1–P5 not started.

- Dependencies: live Path 21  
- Work: forensic verification; role-separated Supplier/Agent reporting; Step-1 server idempotency; Step 2/3 claim-before-pay; searchable selectors; no pooled tables  
- Risks: opening-balance skew after filter; residual settlement rows after void (inactive lifecycle mitigates reporting)  
- Tests: role filter unit tests; double-submit / claim contract tests  
- GO/NO-GO: no active duplicate GL; Step-1 unique client op; Step 2/3 claim before pay  
- Approval: ops hotfix

### Wave P1 — Core operational persistence

- Supplier FX open items; pool/batch headers; wallet movements; reconciliation exceptions; **no** FX P&L  
- Migrations: additive tables only  
- GO/NO-GO: RLS + company gate; no GL meaning change  

### Wave P2 — USD acquisition and agent settlement

- Acquisition batch; credit/prepaid modes; agent payment allocations; USD qty  
- Preserve Path 21; prepaid additive  
- GO/NO-GO: Supplier AP untouched on acquire  

### Wave P3 — China transfer and USD→CNY conversion

- Transfers; conversion legs; CNY pool; effective rates; fees separate  
- GO/NO-GO: equal carrying transfer; no 1395/2295/6100/7100  

### Wave P4 — Multi-supplier allocations

- Settlement batches; allocations; partials; locks; idempotency  
- GO/NO-GO: Profile-A blocked gap documented and enforced (no hidden balance)  

### Wave P5 — Dual-view reports and UI

- Supplier FC view; agent statement; wallet/pool report; allocation UI; export parity  
- GO/NO-GO: one dataset for rows/cards/exports  

### Phase 3 — Separate accounting approval

- Realized FX gain/loss; pending FX accounts; full wallet/AP carrying reconciliation  
- **Never** auto-enabled by Multi Currency  
- GO/NO-GO: finance sign-off only  

Each wave requires separate approval before coding or migration apply.

---

## 14. Relationship to Path 21

| | Path 21 (shipped) | Pooled USD→CNY (this doc) |
| --- | --- | --- |
| Typical FC | CNY or USD bought and used as settlement currency | USD bought, converted to CNY pool |
| Supplier link | Optional; often 1 wallet pay to 1 purchase | Explicit many allocations from one pool |
| Tables today | `fx_currency_purchases` + settlements | Additive model above |
| Status | Live (flag-gated) | Design only |

Both are Import FX under `multiCurrencyEnabled`. Neither enables Phase-3 journals by itself.
