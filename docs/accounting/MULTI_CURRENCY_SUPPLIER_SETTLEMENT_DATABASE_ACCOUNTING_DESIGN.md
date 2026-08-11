# Multi-Currency Supplier Settlement

## Database and Accounting Entries Design

> **Repo note (canonical next-spec):** Yeh document NEW POSV3 ka **next additive** database / settlement design hai — further Import FX work isi se align hoga.  
> **Pooled USD→CNY multi-supplier workflow (companion):** [`POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md`](./POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md) — event model A–F, Profile-A limits, forensic Path 21 appendix, waves P1–P5 (design only; not implemented).  
> **Historical shipped references (do not treat as replace targets):** [`MULTI_CURRENCY_IMPORT_FX_ROADMAP.md`](./MULTI_CURRENCY_IMPORT_FX_ROADMAP.md), [`MULTI_CURRENCY_IMPORT_FX_WORKFLOW_AND_COA.md`](./MULTI_CURRENCY_IMPORT_FX_WORKFLOW_AND_COA.md).  
> Live schema / RPC contracts ko migration ya coding se pehle re-audit karo. Cursor rule: [`.cursor/rules/multi-currency-import-fx.mdc`](../../.cursor/rules/multi-currency-import-fx.mdc).

**Document status:** Developer-ready functional and technical specification  
**Base/Book currency:** PKR  
**Supported settlement currencies:** RMB, USD and other enabled ISO currencies  
**Primary rule:** General Ledger remains PKR-based. Foreign-currency quantities, rates and balances are maintained in operational subledgers.
**Compatibility baseline:** DIN Collection / NEW POSV3 ERP Import FX Phases 0–2, including the shipped flag-gated agent dual-credit Path 21  
**Activation rule:** All foreign-currency UI, writes, RPCs, settlement workflows and reports in this document apply only when the company setting `accounting_settings.multiCurrencyEnabled = true`.

---

## 0. Module Activation Contract

This section is mandatory. The database schema may be additive and always deployed, but its functional behavior must remain company-level feature-gated.

### 0.1 Existing settings are the source of truth

Do not create a second competing multi-currency switch.

| Existing setting | Required behavior |
| --- | --- |
| `accounting_settings.multiCurrencyEnabled` | Master company-level gate for Import FX behavior |
| `accounting_settings.activeCurrencies` | Allowed foreign document/settlement currencies |
| `companies.currency` | Base/book currency; currently PKR |

The UI label may display **RMB**, but the stored ISO currency code must be **CNY**. Reports may render `RMB (CNY)` for user clarity.

### 0.2 Behavior when module is OFF

When `multiCurrencyEnabled = false`:

1. Purchase, payment and supplier-settlement screens remain PKR-only.
2. FX rate, foreign amount, agent FX wizard, TT-wallet selection for Import FX, third-party conversion and FC reports remain hidden/disabled.
3. New purchase FX metadata must be null; no new `fx_currency_purchases`, conversion legs, FC allocations or wallet-quantity movements may be created.
4. Server services/RPCs must reject non-PKR Import FX commands even if a client bypasses the UI.
5. Existing PKR purchase/payment posting behavior and debit/credit meaning remain unchanged.
6. Historical FX records are retained and auditable; switching OFF must never delete or rewrite them.
7. A company cannot switch OFF while it has an open agent FX workflow, non-zero FC wallet quantity, unsettled foreign supplier allocation or pending FX-accounting exception. The UI must explain what must be closed first.

### 0.3 Behavior when module is ON

When `multiCurrencyEnabled = true`:

1. Only PKR plus `activeCurrencies` may be selected.
2. Purchase UI becomes currency-first for foreign documents and calculates PKR GL drivers as `foreign amount x approved rate`.
3. Existing nullable FX metadata is populated.
4. Shipped Agent FX Path 21 and any new settlement modes become available according to role/permission.
5. TT-agent wallet accounts may appear as valid payment accounts.
6. Supplier ledger gains an operational FC view, while the official GL/AP journal remains PKR.
7. Every write must store company, branch, currency, rate source, actor and audit correlation.

### 0.4 Branch and permission behavior

- The toggle is company-level and inherited by branches; a branch must not independently change the company's base currency.
- Each branch continues using its own permitted cash/bank/TT-wallet accounts.
- Roles for `CREATE_FX_PURCHASE`, `FUND_AGENT`, `CONFIRM_CONVERSION`, `CONFIRM_SUPPLIER_SETTLEMENT`, `REVIEW_FX_DIFFERENCE` and `REVERSE_FX_TRANSACTION` should be separate.
- UI gating is not security. Every API/RPC must re-check company setting, active currency, branch access and permission.

### 0.5 Separate accounting approval gate

`multiCurrencyEnabled` enables the **operational Import FX workflow only**. It must not, by itself, enable new FX gain/loss journal meanings.

Use a separate internal policy gate such as:

`accounting_settings.fxSettlementAccountingEnabled = false`

This second gate remains `false` until explicit Phase-3 accounting approval. While false, the system may calculate/store/display settlement differences, but must not automatically post them to pending FX or P&L accounts.

---

## 1. Objective

This design covers the complete China-import supplier-payment lifecycle:

1. A supplier invoice is recorded in RMB or USD.
2. The purchase is posted to the General Ledger in PKR.
3. The company may fund an exchange agent in PKR.
4. The agent may settle the supplier directly in RMB/USD, or perform PKR -> USD -> RMB conversion through a third party.
5. Agent funding and supplier settlement remain separate business events.
6. Partial payments may use different settlement rates.
7. The difference between the invoice's PKR carrying value and actual PKR settlement cost is calculated and retained.
8. Until Phase-3 accounting approval, the difference is calculated, stored and displayed without changing existing GL meaning. After separate approval, it may be posted through pending-review accounts and later reclassified to FX P&L.

This design does **not** convert the General Ledger into a full multi-currency GL.

---

## 2. Accounting Model

The system stores three values independently:

| Value | Example | Purpose |
| --- | ---: | --- |
| Supplier invoice currency/amount | RMB 10,000 | Supplier's legal and operational liability |
| Company base/book value | PKR 390,000 | GL, inventory, AP and financial reporting |
| Payment/settlement cost | PKR 400,000 | Actual amount paid by the company to obtain RMB 10,000 |

### Mandatory distinction

- **Payment currency:** Currency leaving the company, e.g. PKR.
- **Settlement currency:** Currency received by the supplier, e.g. RMB.
- **Conversion currency:** Optional intermediate currency, e.g. USD.

These fields must never be represented by one generic `currency` field.

---

## 3. Supported Payment Modes

| Code | Mode | Flow |
| --- | --- | --- |
| `DIRECT` | Direct Payment | PKR or foreign-currency account -> Supplier |
| `AGENT_FX` | Agent FX | PKR -> Agent -> RMB/USD -> Supplier |
| `THIRD_PARTY_CONVERSION` | Third-Party Conversion | PKR -> Agent/USD -> Converter -> RMB -> Supplier |
| `FC_WALLET` | Existing Foreign-Currency Wallet | Existing RMB/USD wallet -> Supplier |
| `AGENT_CREDIT` | Agent Credit | Agent settles supplier first -> Company owes agent -> Company later pays agent |
| `POOLED_USD_CNY` | Pooled USD→CNY multi-supplier | PKR→USD acquisition → optional China USD transfer → USD→CNY conversion → shared CNY pool → N supplier allocations (see companion workflow doc) |

**Workflow separation (mandatory):** Shipped **Path 21** (direct FC agent dual-credit into a TT wallet, then pay agent / pay supplier) and **POOLED_USD_CNY** are separate Import FX workflows. Pooled design must not silently replace Path 21. Prepaid-agent is an additive option alongside agent credit.

---

## 3.1 Pooled PKR → USD → China USD → CNY → multi-supplier (Events A–F)

Full narrative, formulas, UI screens, acceptance scenarios and waves: [`POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md`](./POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md).

| Event | Name | Touches Supplier AP? | Profile-A GL sketch |
| --- | --- | --- | --- |
| A | Supplier CNY purchase | Creates AP at invoice book PKR | Dr Inventory / Cr Supplier AP |
| B | Buy USD from `money_exchange` agent | **No** | Credit mode: Dr USD wallet / Cr Agent AP |
| C | Pay agent | **No** | Dr Agent AP / Cr Bank |
| D | Transfer USD → China USD wallet | **No** | Dr China USD / Cr origin USD (equal carrying) |
| E | Convert USD → CNY pool | **No** | Dr CNY pool / Cr China USD (equal carrying; fees separate) |
| F | Allocate CNY pool to invoices | **Yes** (on confirmed allocation/payment only) | See Profile-A limitation below |

State machine (pooled header):

`DRAFT → USD_ACQUIRED → AGENT_PARTIALLY_PAID|AGENT_PAID → USD_TRANSFERRED → CONVERSION_PENDING → CNY_POOL_CREATED → PARTIALLY_ALLOCATED → FULLY_ALLOCATED` (+ `CANCELLED` / `REVERSED`).

Allocation formulas:

```text
allocated_invoice_book_pkr = original_invoice_book_pkr × allocated_cny ÷ original_invoice_cny
allocated_pool_cost_pkr    = allocated_cny × effective_pool_pkr_per_cny
fx_difference_pkr          = allocated_pool_cost_pkr − allocated_invoice_book_pkr
```

One acquisition/conversion may fund many suppliers; one supplier may receive many partials. Never close Supplier AP merely because USD was purchased or converted.

### Profile-A limitation (fxSettlementAccountingEnabled = false)

- Calculate/store/display conversion benefit and `fx_difference_pkr`; raise `FX_REVIEW_REQUIRED`.
- Do **not** post accounts `1395`, `2295`, `6100`, `7100` or realized FX P&L.
- Do **not** shift conversion benefit into Supplier AP or alter invoice book liability to absorb pool cost.
- When pool carrying cost ≠ allocated invoice book PKR, a transparent balanced three-line (or residual) treatment is **BLOCKED** until Phase-3 / separate accounting approval — do not invent a hidden balancing entry. See companion §3.

### Idempotency (all future pooled money commands)

- Require `client_operation_id`.
- UNIQUE `(company_id, event_type, client_operation_id)`.
- UNIQUE `(company_id, source_type, source_id, posting_type)` for JE creation.
- Lock pool lot + supplier open items during allocation (`FOR UPDATE`).
- Path 21 residual: Step-1 acquisition still needs server idempotency (forensic: identical USD credits `JV-000342` / `JV-000343`).

### Live reuse before new masters

Extend/reuse `purchases`, `payments`, `fx_currency_purchases`, `fx_currency_purchase_settlements`, `contacts`, `accounts` (12xx), `journal_entries` / `journal_entry_lines`. Do not create parallel purchases/contacts/CoA. Additive candidates for pooled legs: wallet metadata, `wallet_movements`, conversion batches, CNY pool lots, `supplier_fx_open_items`, settlement batches/allocations, reconciliation exceptions, client-operation receipts (exact names finalized at migration time against live schema).

---

## 4. Chart of Accounts

Account numbers are examples and must be mapped through configuration, not hard-coded.

| Suggested code | Account | Type | Purpose |
| --- | --- | --- | --- |
| `1100` | PKR Cash/Bank | Asset | Company payment source |
| `1210` | USD Operational Wallet | Asset | USD quantity subledger; GL valuation in PKR |
| `1220` | RMB Operational Wallet | Asset | RMB quantity subledger; GL valuation in PKR |
| `1230` | Agent Settlement Clearing/Advance | Asset | PKR funded to agent but not yet fully settled |
| `2000 / AP-{supplier}` | Supplier AP control/child | Liability | Existing supplier liability structure, posted in PKR |
| `2000 / AP-{agent}` | Agent AP child | Liability | Existing `money_exchange` agent AP under control 2000 |
| `1395` | FX Loss Pending Review | Asset/Clearing | **Optional Phase 3 only:** debit difference awaiting approval |
| `2295` | FX Gain Pending Review | Liability/Clearing | **Optional Phase 3 only:** credit difference awaiting approval |
| `6100` | Realized FX Gain | Other Income | **Optional Phase 3 only:** after accounting-policy approval |
| `7100` | Realized FX Loss | Expense | **Optional Phase 3 only:** after accounting-policy approval |
| `7110` | Conversion/Agent Charges | Expense | Separately identified agent or conversion fee |

### Control-account rules

- Preserve the existing `_ensure_ap_subaccount_for_contact` behavior: suppliers and `money_exchange` agents receive AP children under control account 2000.
- Every supplier must link to its existing Supplier AP child, while operational FC detail remains outside the GL.
- Every agent must link to either Agent Settlement Clearing, its existing AP child under 2000, or both, according to prepaid versus credit workflow.
- Each foreign-currency wallet must have one GL account and one operational currency.
- A wallet GL balance is PKR; its foreign-currency quantity is held in `wallet_movements`.
- Accounts `1395`, `2295`, `6100` and `7100` must not be provisioned or posted merely because `multiCurrencyEnabled` is ON. They require the separate Phase-3 `fxSettlementAccountingEnabled` approval gate.
- If Phase 3 is approved, `1395` and `2295` must be cleared through approval/reclassification; they are not permanent P&L accounts.

---

## 5. Database Design

All transactional tables must include `id`, `company_id`, `branch_id`, `created_at`, `created_by`, `updated_at`, and a version/concurrency field where applicable. Posted records must be immutable and corrected by reversal.

Recommended numeric types:

- Foreign amounts: `numeric(24,8)`
- FX rates: `numeric(24,12)`
- PKR/base amounts: `numeric(24,2)`
- Currency codes: ISO-4217 `char(3)`
- Time: UTC `timestamptz`

### 5.1 Master tables

The names below describe the target data model. Where the current ERP already owns equivalent data, extend/reuse it additively instead of creating a duplicate source of truth.

#### `companies`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | text | Company name |
| `currency` | char(3) | Existing base/book currency; must be `PKR` for this design |
| `wallet_valuation_method` | enum | `WEIGHTED_AVERAGE` or `FIFO` |
| `auto_post_fx_pnl` | boolean | Default `false` |
| `fx_review_threshold_pkr` | numeric(24,2) | Approval threshold |

In the current ERP, feature and FX policy values should remain in the existing company `accounting_settings` JSON unless a separately approved settings migration normalizes them. Required keys are `multiCurrencyEnabled`, `activeCurrencies`, and the future/internal `fxSettlementAccountingEnabled`.

#### `currencies`

`code`, `name`, `decimal_places`, `is_enabled`.

#### `parties`

| Column | Type | Notes |
| --- | --- | --- |
| `party_type` | enum | `SUPPLIER`, `AGENT`, `CONVERTER`, or combined role through a role table |
| `name` | text | Display name |
| `default_currency_code` | char(3) | Optional operational default |
| `supplier_ap_account_id` | uuid | Required for supplier role |
| `agent_clearing_account_id` | uuid | Required for funded-agent workflow |
| `agent_ap_account_id` | uuid | Required for agent-credit workflow |

If a party can have multiple roles, use `party_roles(party_id, role_code)` instead of one exclusive `party_type`.

#### `foreign_currency_wallets`

Current ERP compatibility: the existing named 12xx TT-agent Chart-of-Accounts records, detected by `_is_tt_agent_wallet_account` / `isPartyTtAgentWalletAccount`, remain the actual GL accounts. This table is optional additive metadata keyed to the existing `gl_account_id`; it must not create a parallel wallet ledger account.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | text | Example: `HAMID IK RMB` |
| `currency_code` | char(3) | Exactly one operational currency |
| `custodian_party_id` | uuid | Agent/company/third party holding the funds |
| `gl_account_id` | uuid | PKR-valued wallet account |
| `valuation_method` | enum | Inherited or overridden policy |
| `allow_negative_quantity` | boolean | Normally `false` |
| `status` | enum | `ACTIVE`, `INACTIVE` |

### 5.2 Purchase and supplier open-item tables

#### `purchase_invoices`

Current ERP mapping: this is the existing `purchases` table, not a requirement to create a duplicate purchase header. Reuse the shipped nullable columns `document_currency`, `fx_rate_to_base`, `foreign_subtotal`, `foreign_total`, plus optional item/payment FX columns. PKR `subtotal`, `total`, `unit_price`, `paid_amount` and `due_amount` remain the GL drivers.

| Column | Type | Notes |
| --- | --- | --- |
| `supplier_id` | uuid | Supplier party |
| `invoice_number` | text | Unique per supplier/company |
| `invoice_date` | date | Document date |
| `currency_code` | char(3) | RMB/USD/PKR |
| `invoice_amount_fc` | numeric(24,8) | Original invoice amount |
| `purchase_rate_to_pkr` | numeric(24,12) | PKR per one invoice-currency unit |
| `book_value_pkr` | numeric(24,2) | Locked at posting |
| `status` | enum | `DRAFT`, `POSTED`, `PARTIALLY_PAID`, `PAID`, `REVERSED` |
| `journal_entry_id` | uuid | Purchase posting |

#### `supplier_open_items`

This is the authoritative **operational FX settlement schedule**, not a replacement for the existing AP GL ledger. In the current ERP it should preferably be implemented as additive `supplier_fx_open_items` records generated from posted foreign purchases, or as a reliable view over purchase FX metadata plus settlement allocations. The official accounting liability remains the supplier AP child under control 2000 in PKR.

| Column | Type | Notes |
| --- | --- | --- |
| `supplier_id` | uuid | Supplier |
| `source_type` | enum | `PURCHASE_INVOICE`, `DEBIT_NOTE`, `CREDIT_NOTE` |
| `source_id` | uuid | Source document |
| `currency_code` | char(3) | Original liability currency |
| `original_amount_fc` | numeric(24,8) | Example: RMB 20,000 |
| `original_book_value_pkr` | numeric(24,2) | Example: PKR 780,000 |
| `open_amount_fc` | numeric(24,8) | Foreign outstanding |
| `open_book_value_pkr` | numeric(24,2) | PKR carrying amount outstanding |
| `status` | enum | `OPEN`, `PARTIAL`, `CLOSED`, `REVERSED` |

The supplier screen should show both `open_amount_fc` and `open_book_value_pkr`. The PKR value shown in the GL is not a replacement for the RMB/USD due amount.

### 5.3 Settlement orchestration tables

#### `supplier_settlements`

One header represents the business instruction to settle a supplier.

| Column | Type | Notes |
| --- | --- | --- |
| `settlement_number` | text | Unique document number |
| `supplier_id` | uuid | Beneficiary supplier |
| `payment_mode` | enum | One of the supported modes |
| `payment_currency_code` | char(3) | Currency paid by company, normally PKR |
| `payment_amount` | numeric(24,8) | Total company payment/funding |
| `settlement_currency_code` | char(3) | Currency supplier receives |
| `settlement_amount_fc` | numeric(24,8) | Supplier settlement quantity |
| `quoted_rate_to_pkr` | numeric(24,12) | PKR per settlement-currency unit |
| `expected_cost_pkr` | numeric(24,2) | Settlement amount x quoted rate |
| `actual_cost_pkr` | numeric(24,2) | Locked from actual funding/wallet valuation |
| `agent_id` | uuid nullable | Exchange agent |
| `converter_id` | uuid nullable | Third-party converter |
| `source_wallet_id` | uuid nullable | Existing FC wallet |
| `beneficiary_reference` | text | Bank/WeChat/Alipay/supplier reference |
| `status` | enum | State machine below |
| `settled_at` | timestamptz nullable | Supplier receipt/settlement time |
| `evidence_attachment_id` | uuid nullable | Payment proof |

Recommended status flow:

`DRAFT -> APPROVED -> AGENT_FUNDED -> CONVERSION_PENDING -> READY_TO_SETTLE -> PARTIALLY_SETTLED -> SUPPLIER_SETTLED`

Not every mode uses every state. Terminal correction states are `CANCELLED` before posting and `REVERSED` after posting.

#### `supplier_settlement_allocations`

Supports partial payment and one settlement against multiple invoices.

| Column | Type | Notes |
| --- | --- | --- |
| `settlement_id` | uuid | Header |
| `open_item_id` | uuid | Invoice/open item |
| `allocated_amount_fc` | numeric(24,8) | Amount reducing supplier foreign liability |
| `allocated_book_value_pkr` | numeric(24,2) | PKR carrying value removed from AP |
| `actual_settlement_cost_pkr` | numeric(24,2) | Pro-rata actual settlement cost |
| `fx_difference_pkr` | numeric(24,2) | Actual cost minus carrying value |
| `fx_review_status` | enum | `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`, `RECLASSIFIED` |

For a normal invoice, carrying value is allocated proportionally:

`allocated_book_value_pkr = open_item original book value x allocated FC / original FC`

Rounding remainder must be assigned to the final allocation so the invoice closes exactly.

#### `agent_fundings`

Records money delivered to an agent. It must not close supplier AP by itself.

| Column | Type | Notes |
| --- | --- | --- |
| `funding_number` | text | Unique number |
| `agent_id` | uuid | Agent |
| `settlement_id` | uuid nullable | May fund one settlement or agent pool |
| `payment_account_id` | uuid | PKR cash/bank source |
| `currency_code` | char(3) | Normally PKR |
| `amount` | numeric(24,2) | Amount paid to agent |
| `funded_at` | timestamptz | Funding time |
| `status` | enum | `DRAFT`, `POSTED`, `ALLOCATED`, `REFUNDED`, `REVERSED` |
| `journal_entry_id` | uuid | Dr Agent Clearing, Cr Bank |

Use an allocation bridge `agent_funding_allocations(funding_id, settlement_id, amount_pkr)` when one agent payment funds multiple settlements.

#### `currency_conversions`

| Column | Type | Notes |
| --- | --- | --- |
| `settlement_id` | uuid | Parent workflow |
| `sequence_no` | integer | Supports multi-leg routes |
| `from_wallet_id` | uuid nullable | Source wallet |
| `from_currency_code` | char(3) | Example USD |
| `from_amount` | numeric(24,8) | Example 5,000 |
| `to_wallet_id` | uuid nullable | Destination wallet |
| `to_currency_code` | char(3) | Example RMB |
| `to_amount` | numeric(24,8) | Example 10,000 |
| `effective_cross_rate` | numeric(24,12) | To units per one from unit |
| `carrying_value_out_pkr` | numeric(24,2) | Wallet valuation removed |
| `carrying_value_in_pkr` | numeric(24,2) | Destination wallet valuation added |
| `fee_pkr` | numeric(24,2) | Explicit fee, not hidden in FX difference |
| `converter_id` | uuid nullable | Third party |
| `status` | enum | `PENDING`, `CONFIRMED`, `REVERSED` |

#### `wallet_movements`

| Column | Type | Notes |
| --- | --- | --- |
| `wallet_id` | uuid | FC wallet |
| `movement_type` | enum | `FUNDING`, `CONVERSION_IN`, `CONVERSION_OUT`, `SUPPLIER_PAYMENT`, `REFUND`, `REVERSAL`, `ADJUSTMENT` |
| `quantity_fc` | numeric(24,8) | Signed foreign quantity |
| `base_value_pkr` | numeric(24,2) | Signed PKR carrying value |
| `unit_cost_pkr` | numeric(24,12) | PKR carrying cost per FC unit |
| `source_type` | text | Settlement/conversion/funding |
| `source_id` | uuid | Source document |
| `movement_at` | timestamptz | Effective time |
| `valuation_layer_id` | uuid nullable | Required for FIFO |

Do not store wallet balance as the only source of truth. Derive it from posted movements, with an optional locked summary/cache table for performance.

### 5.4 Accounting and governance tables

#### `journal_entries`

`entry_number`, `entry_date`, `source_type`, `source_id`, `status`, `description`, `posted_at`, `posted_by`, `reversal_of_entry_id`.

#### `journal_lines`

| Column | Type | Notes |
| --- | --- | --- |
| `journal_entry_id` | uuid | Header |
| `gl_account_id` | uuid | Account |
| `party_id` | uuid nullable | Supplier/agent detail |
| `wallet_id` | uuid nullable | Wallet dimension |
| `debit_pkr` | numeric(24,2) | Exactly one of debit/credit positive |
| `credit_pkr` | numeric(24,2) | Exactly one of debit/credit positive |
| `currency_code` | char(3) nullable | Audit metadata only, not GL amount |
| `amount_fc` | numeric(24,8) nullable | Audit metadata only |
| `memo` | text | Explanation |

#### `fx_difference_reviews`

| Column | Type | Notes |
| --- | --- | --- |
| `settlement_allocation_id` | uuid | Difference source |
| `difference_type` | enum | `LOSS`, `GAIN`, `ZERO` |
| `difference_pkr` | numeric(24,2) | Absolute value |
| `pending_account_id` | uuid | 1395 or 2295 |
| `recommended_account_id` | uuid | 7100 or 6100 |
| `status` | enum | `PENDING`, `APPROVED`, `REJECTED`, `RECLASSIFIED` |
| `reviewed_by` | uuid nullable | Approver |
| `reviewed_at` | timestamptz nullable | Review time |
| `reclassification_journal_id` | uuid nullable | Final P&L move |

#### `accounting_policy_mappings`

Configuration keys should include:

- `SUPPLIER_AP_CONTROL`
- `AGENT_CLEARING`
- `AGENT_AP_CONTROL`
- `FX_LOSS_PENDING`
- `FX_GAIN_PENDING`
- `REALIZED_FX_LOSS`
- `REALIZED_FX_GAIN`
- `CONVERSION_FEE_EXPENSE`
- one mapping per wallet or wallet class

#### `audit_events`

Store before/after JSON, actor, timestamp, reason, entity type/id, IP/device metadata where permitted, and correlation/idempotency key.

---

### 5.5 Existing ERP compatibility and migration mapping

No destructive change or parallel accounting engine is authorized by this specification.

| Target concept in this document | Existing ERP asset to preserve/reuse | Allowed change |
| --- | --- | --- |
| Module activation | `accounting_settings.multiCurrencyEnabled` | Reuse exactly; server-side gate all new commands |
| Allowed currencies | `accounting_settings.activeCurrencies` | Reuse; normalize UI RMB to ISO CNY |
| Base currency | `companies.currency` | Reuse; do not create a competing base currency |
| Foreign purchase header | `purchases.document_currency`, `fx_rate_to_base`, `foreign_*` | Reuse shipped nullable columns |
| Foreign purchase lines | `purchase_items.foreign_unit_price`, `foreign_line_total` where present | Additive nullable use only |
| Payment FX metadata | `payments.foreign_amount`, `fx_rate`, `document_currency` where present | Populate additively when module ON |
| Agent FC credit purchase | `fx_currency_purchases` | Extend/reuse; do not replace shipped RPC flow |
| Agent settlement | `fx_currency_purchase_settlements` | Extend/reuse with allocation/status metadata |
| Credit-buy posting | `record_fx_currency_purchase_on_credit` | Preserve Dr 12xx TT wallet / Cr Agent AP meaning |
| Agent AP settlement | `createSupplierPayment` + `apply_fx_currency_purchase_settlement` | Preserve existing Path 21 |
| China supplier payment | Purchase-linked `createSupplierPayment` | Preserve Dr Supplier AP / Cr liquidity or TT wallet in PKR |
| Supplier FC due view | New additive operational view/table | Must not replace AP journal/RPC truth |
| Wallet identity | Existing named 12xx CoA accounts | Optional metadata/quantity layer keyed to CoA account |
| Posting engines | `documentPostingEngine`, `purchaseAccountingService` | GL debit/credit meaning unchanged |

All migrations must be forward-only and additive: nullable columns/new tables/indexes/constraints. No `DROP`, destructive `ALTER`, historical rewrite, or replacement of existing money-path RPCs without a separate migration plan and explicit approval.

---

## 6. Core Accounting Entries

### 6.0 Two accounting profiles

#### Profile A — Current-safe Phases 0–2 (default)

Conditions:

- `multiCurrencyEnabled = true`
- `fxSettlementAccountingEnabled = false`

Behavior:

- Existing PKR journals and Path 21 remain unchanged.
- Purchase rate, settlement rate, actual cost and calculated difference are stored/displayed as operational metadata.
- No pending FX or realized FX journal account is posted automatically.
- If carrying value and actual cost differ, the workflow creates an `FX_REVIEW_REQUIRED` reconciliation exception. The system must not invent a balancing P&L entry or silently force-close an accounting residual.
- Supplier operational FC status and accounting AP status must be displayed separately when a difference remains unresolved.

For the RMB 10,000 example, the existing supplier payment may close PKR 390,000 of Supplier AP against PKR 390,000 of the TT wallet/clearing account. The remaining PKR 10,000 cost variance stays visible in wallet/agent reconciliation and in `fx_difference_pkr` until an approved accounting adjustment is posted. This is the lockdown-safe behavior.

#### Profile B — Phase-3 settlement accounting (separate explicit approval)

Conditions:

- `multiCurrencyEnabled = true`
- `fxSettlementAccountingEnabled = true`
- Required pending gain/loss and final P&L mappings exist

Behavior:

- Sections 6.3 onward may use pending-review accounts to balance and fully reconcile actual cost against AP carrying value.
- Reclassification to realized FX gain/loss still follows approval policy and threshold.

Turning on the operational module must never automatically switch the company from Profile A to Profile B.

### 6.1 Foreign purchase: RMB 10,000 at PKR 39

Book value: PKR 390,000.

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Inventory/Purchases | 390,000 | — |
| Supplier AP Control | — | 390,000 |

Subledger effect:

- Supplier invoice: RMB 10,000
- Supplier open amount: RMB 10,000
- Supplier open carrying value: PKR 390,000

### 6.2 Agent funded in PKR at rate 40

Agent receives PKR 400,000. This event does **not** reduce supplier AP.

This is the proposed **prepaid-agent** path. It is additional to, and must not replace, the shipped Agent Credit Path 21.

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Agent Settlement Clearing/Advance | 400,000 | — |
| PKR Bank/Cash | — | 400,000 |

Status becomes `AGENT_FUNDED`; supplier remains unpaid until settlement confirmation.

### 6.2A Existing shipped Agent Credit Path 21

When the agent provides foreign currency on credit, preserve the existing flow:

**Step 1 — Buy FC on agent credit** through `record_fx_currency_purchase_on_credit`:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Named 12xx TT wallet, e.g. HAMID IK RMB | 400,000 | — |
| Agent AP child under control 2000 | — | 400,000 |

Operational metadata records RMB 10,000 at rate 40.

**Step 2 — Pay/settle agent** through the existing `createSupplierPayment` plus `apply_fx_currency_purchase_settlement` path:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Agent AP child under control 2000 | 400,000 | — |
| PKR Bank/Cash | — | 400,000 |

**Step 3 — Settle China supplier from TT wallet** through purchase-linked `createSupplierPayment`:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Supplier AP child under control 2000 | Existing PKR payment amount | — |
| Named 12xx TT wallet | — | Same PKR amount |

Do not overload `record_payment_with_accounting` for Step 1; its Dr AP / Cr liquidity meaning does not represent buying FC on agent credit.

### 6.3 Agent settles supplier RMB 10,000 — Phase-3 profile

Supplier liability carrying value is PKR 390,000; actual cost is PKR 400,000; difference is PKR 10,000 loss.

The pending-review line below is permitted only when `fxSettlementAccountingEnabled = true`. Under the default Profile A, store/display the PKR 10,000 difference and create a reconciliation exception instead.

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Supplier AP Control | 390,000 | — |
| FX Loss Pending Review | 10,000 | — |
| Agent Settlement Clearing/Advance | — | 400,000 |

Subledger effect:

- Supplier paid: RMB 10,000
- Supplier open amount: RMB 0
- Agent clearing consumed: PKR 400,000
- FX review: PKR 10,000 loss, `PENDING`

### 6.4 Approved FX-loss reclassification — Phase-3 profile

Only after accounting-policy/user approval:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Realized FX Loss | 10,000 | — |
| FX Loss Pending Review | — | 10,000 |

### 6.5 Settlement gain example — Phase-3 profile

If supplier AP carrying value is PKR 390,000 but actual settlement cost is PKR 380,000:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Supplier AP Control | 390,000 | — |
| Agent Clearing/Bank/Wallet | — | 380,000 |
| FX Gain Pending Review | — | 10,000 |

After approval:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| FX Gain Pending Review | 10,000 | — |
| Realized FX Gain | — | 10,000 |

### 6.6 Partial payment — calculation in all profiles; pending journal only in Phase 3

Invoice: RMB 20,000 at PKR 39 = PKR 780,000.  
First settlement: RMB 8,000 at PKR 40.20 = PKR 321,600.

Carrying value released:

`780,000 x 8,000 / 20,000 = PKR 312,000`

Difference:

`321,600 - 312,000 = PKR 9,600 loss`

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Supplier AP Control | 312,000 | — |
| FX Loss Pending Review *(Phase 3 only)* | 9,600 | — |
| Agent Clearing/Bank/Wallet | — | 321,600 |

Remaining open item:

- RMB 12,000
- PKR 468,000 carrying value

Every later partial settlement stores its own actual rate, cost and difference.

### 6.7 Existing RMB wallet settlement — Phase-3 reconciliation example

Assume RMB wallet has RMB 10,000 carrying value PKR 400,000.

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Supplier AP Control | 390,000 | — |
| FX Loss Pending Review *(Phase 3 only)* | 10,000 | — |
| RMB Operational Wallet | — | 400,000 |

Wallet subledger movement:

- Quantity: RMB -10,000
- PKR carrying value: -400,000

The wallet's actual PKR value must come from the configured weighted-average or FIFO valuation method, not from the supplier invoice rate.

### 6.8 Agent settles on credit before company pays agent — proposed Phase-3 profile

If the agent settles RMB 10,000 at an agreed PKR cost of 400,000:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Supplier AP Control | 390,000 | — |
| FX Loss Pending Review *(Phase 3 only)* | 10,000 | — |
| Agent AP Control | — | 400,000 |

When company later pays agent:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Agent AP Control | 400,000 | — |
| PKR Bank/Cash | — | 400,000 |

This avoids showing an artificial agent advance when the commercial reality is agent credit.

### 6.9 PKR -> USD -> RMB third-party route

Illustrative route:

- Company funds agent: PKR 400,000
- USD wallet acquired: USD 5,000, carrying value PKR 400,000
- Converter exchanges USD 5,000 into RMB 10,000
- RMB wallet receives carrying value PKR 400,000, excluding separately charged fees
- Supplier receives RMB 10,000

Agent funding:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Agent Settlement Clearing | 400,000 | — |
| PKR Bank/Cash | — | 400,000 |

USD acquisition:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| USD Operational Wallet | 400,000 | — |
| Agent Settlement Clearing | — | 400,000 |

USD to RMB conversion, assuming no separate fee:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| RMB Operational Wallet | 400,000 | — |
| USD Operational Wallet | — | 400,000 |

Operational movements record USD -5,000 and RMB +10,000. Supplier settlement then uses the RMB-wallet entry described above.

If a PKR 2,000 conversion fee is separately invoiced/charged:

| Account | Debit PKR | Credit PKR |
| --- | ---: | ---: |
| Conversion/Agent Charges | 2,000 | — |
| Bank/Agent Clearing | — | 2,000 |

Do not hide an explicit service fee inside FX gain/loss.

---

## 7. Posting Engine Rules

### Purchase posting

1. Lock invoice currency, FC amount and purchase rate.
2. Calculate `book_value_pkr` using the approved rate and rounding policy.
3. Post balanced PKR journal.
4. Create supplier open item in both FC and PKR.
5. Prevent editing after posting; use debit/credit note or reversal.

### Agent funding posting

1. Validate agent and PKR payment source.
2. Post Dr Agent Clearing / Cr Bank.
3. Record unallocated or settlement-specific funding.
4. Do not reduce supplier balance.

### Supplier settlement posting

1. Confirm proof/reference and actual supplier-received amount.
2. Lock actual settlement cost from funding allocation, wallet valuation or agent payable.
3. Allocate settlement FC amount to one or more supplier open items.
4. Release each allocation's proportional PKR carrying value.
5. Calculate `actual cost - carrying value` for each allocation.
6. If `fxSettlementAccountingEnabled = false`, store the difference and create `FX_REVIEW_REQUIRED` without changing existing GL meaning. If `true`, post it to the configured pending loss/gain account; direct P&L posting requires its own approved policy.
7. Reduce supplier FC and PKR open balances atomically.
8. Track operational FC settlement and accounting AP reconciliation separately. Mark fully reconciled only when both are zero/cleared within configured tolerance.

### FX review posting

This posting section is inactive unless `fxSettlementAccountingEnabled = true`.

1. Review must reference the exact settlement allocation.
2. Approval cannot alter historical rate or amount.
3. Reclassify pending balance to approved P&L account.
4. Store the reclassification journal ID.
5. Prevent duplicate reclassification with a unique constraint.

---

## 8. Required Validation and Database Constraints

1. `payment_amount > 0` and `settlement_amount_fc > 0` for posted settlements.
2. `quoted_rate_to_pkr > 0` where settlement currency is not PKR.
3. `payment_currency_code` and `settlement_currency_code` are mandatory and independent.
4. Sum of posted allocation FC amounts cannot exceed the open FC amount.
5. Sum of released PKR carrying values cannot exceed the open PKR carrying value.
6. A foreign wallet can hold only its configured currency.
7. Wallet quantity cannot become negative unless policy explicitly permits it.
8. Every posted journal must satisfy total debits = total credits in PKR.
9. A journal line cannot contain both positive debit and positive credit.
10. Posted source documents are immutable.
11. A reversal must reference the original document/journal and reverse both GL and subledger effects.
12. Supplier settlement cannot be marked settled merely because an agent was funded.
13. `SUPPLIER_SETTLED` requires supplier proof/reference, settled timestamp and allocation total.
14. One source event may create its journal only once; enforce an idempotency key or unique `(source_type, source_id, posting_type)`.
15. Currency conversion legs must be sequential and currency-connected: previous `to_currency` equals next `from_currency`.
16. Final conversion/settlement output currency must equal the supplier settlement currency.
17. Explicit agent/converter fee must not also be included in calculated FX difference.
18. Closed invoice rounding residue must be assigned to the final allocation.

---

## 9. Transaction Boundaries and Concurrency

The following must occur in one database transaction when supplier settlement is posted:

- lock affected `supplier_open_items` rows;
- validate remaining FC and PKR amounts;
- create settlement allocations;
- create journal header/lines;
- create wallet/agent-clearing movements;
- update open-item balances;
- update invoice and settlement status;
- create FX review record;
- append audit event.

Use `SELECT ... FOR UPDATE` or equivalent optimistic version checks to prevent two users from paying the same open amount simultaneously.

External commands/API retries must pass an idempotency key. A retry should return the existing result rather than post a second journal.

---

## 10. Reporting Requirements

### Supplier ledger

Show:

- invoice currency and original amount;
- original purchase rate;
- PKR book value;
- each settlement's FC amount and actual rate;
- each settlement's PKR cost;
- remaining FC due;
- remaining PKR carrying value;
- pending/approved FX difference.

Default display for a RMB supplier should lead with RMB balance, with PKR equivalent shown as the book/reporting value.

### Agent statement

Show independently:

- PKR funded to agent;
- amount allocated to settlements;
- unallocated PKR balance/advance;
- supplier settlements completed by agent;
- agent-credit payable;
- refunds and reversals;
- aging of funds held but not yet settled.

### Wallet report

Show:

- opening FC quantity and PKR carrying value;
- inflows/outflows by transaction;
- valuation rate/layer;
- closing FC quantity and PKR carrying value;
- custodian/agent.

### FX review report

Show pending gain/loss by company, branch, supplier, agent, currency, age, and approval threshold.

---

## 11. API/Service Command Boundaries

Recommended commands:

- `PostPurchaseInvoice`
- `CreateSupplierSettlement`
- `ApproveSupplierSettlement`
- `PostAgentFunding`
- `ConfirmCurrencyConversion`
- `ConfirmSupplierReceipt`
- `PostSupplierSettlement`
- `ReviewFxDifference`
- `ReverseAgentFunding`
- `ReverseSupplierSettlement`

Recommended queries:

- `GetSupplierOpenItems`
- `GetSettlementFundingPosition`
- `GetAgentUnallocatedBalance`
- `GetWalletPosition`
- `GetSettlementTimeline`
- `GetPendingFxReviews`

The UI must call business commands rather than directly updating status fields.

---

## 12. Acceptance Test Scenarios

### Scenario 0A: Module OFF

- Set `multiCurrencyEnabled = false`.
- Attempt a CNY purchase, agent FX command and direct RPC call.
- Expected: UI remains PKR-only; server rejects non-PKR commands; no FX rows or journals are created; ordinary PKR purchase/payment behavior is unchanged.

### Scenario 0B: Module ON

- Set `multiCurrencyEnabled = true`; enable CNY and USD in `activeCurrencies`.
- Expected: foreign purchase and authorized agent workflow become available; RMB label stores CNY; PKR GL posting meaning remains unchanged.

### Scenario 0C: Safe deactivation

- Attempt to switch module OFF with an open agent settlement or non-zero FC wallet.
- Expected: switch is blocked with a list of open items. No records are deleted. Once all workflows and exceptions are resolved, deactivation succeeds and new entry returns to PKR-only.

### Scenario 0D: Accounting gate remains separate

- Set `multiCurrencyEnabled = true` and `fxSettlementAccountingEnabled = false`.
- Create a rate-difference settlement.
- Expected: difference is calculated/stored/displayed, but no pending FX or P&L journal line is created.

### Scenario A: Full agent settlement with loss

- Post RMB 10,000 invoice at 39 = PKR 390,000.
- Fund agent PKR 400,000.
- Confirm supplier receipt RMB 10,000.
- Profile A expected: operational RMB due zero; PKR 10,000 difference stored and reconciliation exception visible; no automatic FX journal.
- Profile B expected: supplier open RMB/PKR balance zero, agent clearing zero, pending FX loss PKR 10,000.

### Scenario B: Agent funded but supplier not settled

- Fund agent PKR 400,000 without supplier confirmation.
- Expected: agent clearing PKR 400,000 debit; supplier AP remains PKR 390,000 and RMB 10,000 open.

### Scenario C: Three partial payments

- Invoice RMB 20,000 at 39.
- Settle RMB 8,000, 7,000 and 5,000 at different rates.
- Expected: FC and PKR carrying values reduce proportionally; each allocation stores its own cost/difference; final rounding closes invoice exactly.

### Scenario D: Existing RMB wallet

- Wallet contains RMB 10,000 at PKR carrying value 400,000.
- Pay invoice carrying PKR 390,000.
- Profile A expected: wallet FC becomes zero, difference PKR 10,000 remains visible for reconciliation, and no automatic FX journal is created.
- Profile B expected: supplier closes and pending FX loss PKR 10,000 balances the wallet/AP carrying-value difference.

### Scenario E: Agent credit

- Agent settles before company pays.
- Expected: supplier AP closes, agent AP becomes PKR 400,000; later bank payment closes agent AP.

### Scenario F: PKR -> USD -> RMB

- Record funding, USD acquisition, conversion, RMB receipt and supplier settlement.
- Expected: every wallet quantity and PKR value reconciles; settlement currency matches RMB; no duplicate fee/FX recognition.

### Scenario G: Concurrent payment protection

- Two users attempt to settle the same remaining RMB amount.
- Expected: one succeeds; the other receives an open-balance conflict and no journal is created.

### Scenario H: Reversal

- Reverse a settled payment.
- Expected: exact opposite GL entry, supplier open item restored in FC and PKR, wallet/agent position restored, FX review reversed/closed, complete audit trail retained.

---

## 13. Recommended Delivery Phases

### Existing baseline — preserve as shipped

- `multiCurrencyEnabled` and `activeCurrencies` company settings.
- Currency-first foreign purchase entry with PKR computed GL fields.
- Nullable FX metadata on purchase/items/payments where already migrated.
- Existing PKR purchase/accounting engines.
- Named 12xx TT-agent wallets.
- Agent dual-credit Path 21 using `fx_currency_purchases`, `fx_currency_purchase_settlements`, `record_fx_currency_purchase_on_credit`, `createSupplierPayment` and `apply_fx_currency_purchase_settlement`.

### Next additive extension — operational settlement design

- Separate payment and settlement currencies.
- Operational supplier FX open-item/allocation view, without replacing PKR AP GL.
- Agent funding separate from supplier settlement.
- Prepaid-agent mode alongside the shipped agent-credit mode.
- Partial-payment allocations.
- Populate existing payment FX metadata.
- FX difference calculation/storage/display with `FX_REVIEW_REQUIRED`; no new FX journal meaning.
- Supplier, agent and wallet reports.
- Server-side feature gating and safe deactivation checks.

### Following additive extension — pooled USD→CNY (see companion waves)

Documented in [`POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md`](./POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md); **not implemented** by the documentation task that added this pointer.

| Wave | Scope |
| --- | --- |
| Wave 0 | Path 21 forensic + role-separated ledgers + Step-1 server idempotency (no pooled tables) |
| Wave P1 | Open items, pool/batch headers, wallet movements, reconciliation exceptions |
| Wave P2 | USD acquisition + agent settlement (credit/prepaid) |
| Wave P3 | China USD transfer + USD→CNY conversion + pool lots |
| Wave P4 | Multi-supplier allocations + locks + idempotency |
| Wave P5 | Dual-view reports + allocation UI + export parity |

Also: approval thresholds, WA/FIFO valuation controls, reversal dashboards, mobile parity — each under separate approval.

### Phase 3 — explicit accounting approval only

- Pending FX gain/loss accounts and their journal meanings.
- Approved automatic realized FX P&L posting.
- Full wallet/AP carrying-value reconciliation that unblocks Profile-A residual posting.
- Revaluation/unrealized FX policy, only if later required.
- Broader multi-currency GL only if statutory/reporting requirements justify it.
- **Never** auto-enabled when `multiCurrencyEnabled` turns ON.

---

## 14. Final Architecture Decision

The supplier ledger must become **dual-view**, not a dual-currency General Ledger:

- Operational liability: RMB/USD amount due and paid.
- Accounting liability: PKR carrying value in Supplier AP Control.
- Settlement event: actual FC received by supplier and actual PKR cost.
- Difference under current-safe profile: calculated, stored, displayed and sent to reconciliation review without automatic FX journal.
- Difference after separate Phase-3 approval: posted to pending review and then reclassified under approved policy.

This preserves the existing PKR accounting architecture while accurately representing the real China-import workflow.

---

## 15. Comparison Conclusion Against the Two Legacy Documents

The legacy roadmap and workflow/CoA documents are correct as a record of the old ERP's shipped state. This updated specification is compatible with them on the following non-negotiable points:

1. Import FX is controlled by `accounting_settings.multiCurrencyEnabled` and `activeCurrencies`.
2. Module OFF means PKR-only behavior; module ON enables Import FX behavior.
3. Books, inventory, AP, cash and standard reporting remain PKR.
4. Existing purchase PKR columns continue driving journals; FC fields are additive operational metadata.
5. Supplier and agent AP children remain under control account 2000.
6. Existing named 12xx TT wallets and Agent Credit Path 21 are preserved.
7. The third-party USD -> RMB path is still an additive workflow, not proof of a dual-currency GL.
8. FX gain/loss journals and dual-currency accounting do not become active from the multi-currency toggle alone; they remain behind explicit Phase-3 approval.

Therefore this document should be treated as the **next additive database and settlement design**, while the two older files remain historical implementation references. If implementation code differs from those historical files, the live schema/RPC contracts must be re-audited before migration or coding begins.
