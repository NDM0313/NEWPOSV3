# Import FX Async & Resumable Workflow — UX and State Design

**Product:** NEW POSV3 ERP / Import FX  
**Document type:** Canonical workflow and UX addendum  
**Base accounting currency:** PKR  
**Operational currencies:** PKR plus configured `activeCurrencies` (typically USD and CNY/RMB)  
**Required gate:** `accounting_settings.multiCurrencyEnabled = true`  
**Phase-3 gate:** `accounting_settings.fxSettlementAccountingEnabled = false` unless separately approved  

---

## 1. Purpose

The current Import FX Agent Dual Credit UI uses a forced three-step modal. That model does not match the real business process because:

- the agent arrangement may be agreed today;
- an advance may be paid now;
- USD/TT may be purchased later or partially;
- USD may reach China on another date;
- USD-to-CNY conversion may take one or more days;
- CNY may be received in one or multiple conversion lots;
- the resulting CNY pool may be allocated to multiple suppliers;
- supplier payments may be partial and may occur on different dates;
- agent, third-party converter and supplier balances must remain separate.

The target is an **asynchronous, resumable Import FX Case/Batch workflow**, not a single modal that must be completed in one sitting.

---

## 2. Core UX Decision

Replace the forced three-step modal with a persistent Import FX Case.

Each case:

- has a unique case/batch number;
- can be saved as draft;
- can be resumed later;
- records each real business event separately;
- supports partial amounts;
- supports expected dates and delays;
- stores attachments and evidence per event;
- shows operational status separately from accounting status;
- creates accounting entries only when a real financial event is confirmed;
- never posts a journal merely because a future step was planned.

---

## 3. Workflow Overview

```text
Arrangement
    ↓
Advance / Agent Funding
    ↓
USD/TT Acquisition
    ↓
USD Transfer to China
    ↓
USD-to-CNY Conversion
    ↓
CNY Pool Available
    ↓
Supplier Allocations / Payments
    ↓
Reconciliation and Closure
```

Every stage is independently saveable and confirmable.

---

## 4. Case-Level Status

Recommended overall statuses:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Case created but not approved |
| `ARRANGED` | Commercial arrangement recorded |
| `AWAITING_ADVANCE` | Advance expected |
| `PARTIALLY_FUNDED` | Some advance/funding paid |
| `FUNDED` | Required advance/funding complete |
| `USD_PARTIALLY_ACQUIRED` | Partial USD received |
| `USD_ACQUIRED` | Planned USD received |
| `USD_TRANSFER_PENDING` | USD held locally/with agent |
| `USD_TRANSFERRED` | USD reached China holding wallet |
| `CONVERSION_PENDING` | Waiting for USD-to-CNY conversion |
| `CNY_PARTIALLY_RECEIVED` | Partial CNY conversion confirmed |
| `CNY_POOL_AVAILABLE` | CNY available for supplier allocations |
| `PARTIALLY_ALLOCATED` | Some CNY allocated to suppliers |
| `FULLY_ALLOCATED` | Available CNY fully allocated |
| `RECONCILIATION_REQUIRED` | Operational/accounting difference needs review |
| `COMPLETED` | Workflow fully reconciled and closed |
| `CANCELLED` | Unposted case cancelled |
| `REVERSED` | Posted events reversed through compensating records |

The status must be derived from stage/event truth where practical, not freely typed by a client.

---

## 5. Stage Status

Each workflow stage should support:

```text
NOT_STARTED
PLANNED
AWAITING_ACTION
IN_PROGRESS
PARTIALLY_COMPLETED
AWAITING_CONFIRMATION
COMPLETED
FAILED
CANCELLED
REVERSED
```

The case may move forward only when required predecessor conditions are satisfied. It must not require all stages to be completed on the same date.

---

## 6. Stage A — Arrangement

This is a planning/commercial stage.

Capture:

- arrangement type;
- agent;
- optional third-party converter;
- planned source currency;
- planned USD amount;
- expected PKR/USD rate;
- expected USD/CNY rate;
- expected CNY amount;
- expected fees;
- expected completion date;
- linked suppliers/purchases, if already known;
- notes and attachments.

### Accounting

No journal entry.

Planning, quotation, expected rate and supplier reservation are non-posting events.

---

## 7. Stage B — Advance / Funding

Advance may be paid to:

- money-exchange agent;
- third-party converter;
- supplier, where commercially required;
- another approved settlement custodian.

Advance may be:

- zero;
- partial;
- full;
- paid through multiple transactions;
- paid by different approved bank/cash accounts.

Capture:

- recipient party and role;
- amount and currency;
- payment account;
- payment date;
- expected purpose;
- reference/evidence;
- amount allocated to this case;
- unallocated advance remaining.

### Accounting example — agent/third-party advance

```text
Dr Agent/Third-Party Advance or Clearing
Cr PKR Bank/Cash
```

Advance payment must not:

- create USD quantity before USD is actually received;
- reduce Supplier AP unless it is explicitly a supplier advance under an approved supplier-advance contract;
- mark the whole case complete.

---

## 8. Stage C — USD/TT Acquisition

USD may be obtained:

- on agent credit;
- against a previously paid advance;
- in partial lots;
- at different PKR/USD rates.

Capture per acquisition lot:

- agent;
- USD quantity received;
- PKR/USD execution rate;
- PKR acquisition cost;
- explicit fee;
- receiving USD wallet;
- credit/prepaid mode;
- external reference;
- evidence;
- acquisition timestamp;
- client operation ID.

### Agent credit accounting

```text
Dr USD TT Wallet
Cr Agent AP under control 2000
```

### Against prior advance

```text
Dr USD TT Wallet
Cr Agent Advance/Clearing
```

Agent payment and USD receipt are separate business events unless they truly occur atomically.

---

## 9. Stage D — USD Transfer to China

USD may remain in the source wallet before it is transferred.

Capture:

- source USD wallet;
- China USD destination wallet/account;
- USD sent;
- USD received;
- PKR carrying value transferred;
- transfer fee;
- transfer reference;
- sent timestamp;
- expected arrival;
- received timestamp;
- evidence;
- current custodian.

### Status example

```text
USD sent: 10,000
Status: Transferred — awaiting China confirmation
Expected confirmation: 2 days
```

### Accounting

```text
Dr China USD Holding Wallet
Cr Source USD Wallet
```

Use equal PKR carrying value for a wallet-to-wallet transfer. Record explicit fees separately.

---

## 10. Stage E — USD-to-CNY Conversion

Conversion may occur later and may be partial.

Capture per conversion lot:

- China USD wallet;
- China CNY pool wallet;
- converter/third party;
- USD quantity consumed;
- actual CNY received;
- USD/CNY execution rate;
- optional benchmark rate;
- explicit conversion fee;
- USD PKR carrying value;
- effective PKR/CNY cost;
- operational benefit/variance;
- conversion timestamp;
- confirmation/evidence;
- client operation ID.

Formulas:

```text
execution_cny_per_usd = cny_received / usd_consumed

effective_pkr_per_cny =
  (usd_pkr_carrying_value + capitalized_allowed_costs)
  / cny_received
```

### Profile-A accounting

```text
Dr China CNY Pool Wallet
Cr China USD Holding Wallet
```

Use equal PKR carrying value. Explicit fees remain separate.

Conversion benefit must not be credited to Supplier AP.

While `fxSettlementAccountingEnabled = false`, benefit/difference is operational metadata only; no FX P&L journal is allowed.

---

## 11. Stage F — CNY Pool and Supplier Allocations

One CNY pool may pay:

- one supplier;
- many suppliers;
- several invoices of one supplier;
- partial invoice amounts;
- suppliers on different dates.

The allocation UI must show:

- available CNY pool;
- reserved CNY;
- paid CNY;
- remaining CNY;
- supplier;
- invoice/purchase;
- original CNY due;
- previously paid CNY;
- current allocation;
- remaining CNY due;
- PKR invoice carrying value released;
- CNY pool PKR cost;
- non-posted settlement difference under Profile A.

Validation:

```text
sum(allocations) <= available CNY pool
allocation <= invoice remaining CNY due
```

Each allocation must lock the CNY pool and supplier open item atomically.

---

## 12. Stage G — Supplier Settlement

Supplier settlement occurs only when the supplier actually receives CNY and confirmation is recorded.

Capture:

- supplier;
- purchase/invoice;
- CNY amount received;
- settlement date;
- sending CNY wallet/pool;
- payment channel;
- supplier confirmation;
- reference/evidence;
- allocated book PKR;
- pool carrying cost PKR;
- difference PKR;
- operational status;
- accounting reconciliation status.

Supplier AP must not reduce during:

- arrangement;
- agent advance;
- USD acquisition;
- USD transfer;
- conversion planning;
- CNY reservation without supplier confirmation.

---

## 13. Stage H — Reconciliation and Closure

Before closing, verify:

- agent advance/AP balance;
- third-party balance;
- USD source wallet quantity/value;
- China USD wallet quantity/value;
- CNY pool quantity/value;
- supplier CNY allocations;
- supplier PKR AP releases;
- fees;
- reconciliation exceptions;
- unallocated/reserved funds;
- evidence completeness.

A case cannot close with unexplained balances unless an authorized exception is created.

---

## 14. Operational vs Accounting Status

Each case should show two separate statuses.

### Operational status

Examples:

```text
USD transferred
Awaiting conversion
CNY available
Supplier partially paid
```

### Accounting status

Examples:

```text
Not posted
Partially posted
Posted
Reconciliation required
Reversed
```

Operational completion must not be confused with accounting reconciliation.

---

## 15. Proposed UX Layout

### Desktop

#### Left panel — Timeline

- Arrangement
- Advance
- USD Acquisition
- China Transfer
- Conversion
- CNY Pool
- Supplier Allocations
- Reconciliation

Each step shows status, date and alert count.

#### Center panel — Active step

- form fields;
- transaction history;
- partial amounts;
- attachments;
- comments;
- validation messages.

#### Right panel — Live summary

- planned/actual USD;
- planned/actual CNY;
- PKR cost;
- advances;
- Agent AP;
- third-party balance;
- CNY available/reserved/paid;
- supplier allocations;
- reconciliation difference;
- journal preview.

### Mobile

- case summary card;
- collapsible timeline;
- one step per screen;
- sticky `Save Draft` and `Complete Step` buttons;
- no wide multi-column modal;
- allocation table converted to supplier cards.

---

## 16. Required User Actions

Every stage should provide context-appropriate actions:

```text
Save Draft
Submit for Approval
Confirm This Step
Add Partial Transaction
Resume Later
Upload Evidence
Mark Awaiting Confirmation
Reject
Cancel Unposted Step
Reverse Posted Step
```

There must be no generic button that completes all financial stages at once.

---

## 17. Dashboard and Work Queues

Recommended queues:

- Draft Cases
- Awaiting Advance
- Partially Funded
- USD Purchased — Awaiting Transfer
- USD Sent — Awaiting China Confirmation
- Awaiting Conversion
- CNY Pool Available
- Supplier Allocation Pending
- Supplier Confirmation Pending
- Reconciliation Required
- Overdue Cases
- Completed Cases

Each queue should support search, filters and aging.

---

## 18. Search Requirements

Searchable entities:

- cases/batches;
- agents;
- third parties;
- suppliers;
- purchases/invoices;
- USD/CNY wallets;
- references;
- notes.

Search must be:

- case-insensitive;
- company/branch scoped;
- role filtered;
- paginated for large lists;
- keyboard accessible;
- server validated.

---

## 19. Database/Domain Requirements

The implementation plan must map these concepts to the existing schema before creating tables:

- Import FX case/batch;
- stage/event records;
- advance/funding transactions;
- acquisition lots;
- USD transfers;
- conversion lots;
- immutable wallet movements;
- supplier FX open items;
- CNY pool reservations;
- settlement batches;
- settlement allocations;
- reconciliation exceptions;
- attachments;
- approvals;
- audit events;
- reversals;
- idempotency keys.

Do not duplicate existing purchases, contacts, accounts, journal or Path 21 records.

---

## 20. Idempotency and Concurrency

Every financial command must include `client_operation_id`.

Requirements:

- unique operation key per company/event;
- retry returns prior result or a clear duplicate response;
- submit button disabled while pending;
- no journal until all validations pass;
- wallet/open-item/pool rows locked during balance changes;
- allocation cannot overspend the pool;
- the same stage cannot be confirmed twice;
- reversal uses compensating records;
- no hard deletion of posted financial events.

---

## 21. Permissions and Approval

Suggested permissions:

```text
CREATE_IMPORT_FX_CASE
EDIT_DRAFT_FX_CASE
APPROVE_FX_ARRANGEMENT
POST_FX_ADVANCE
CONFIRM_USD_ACQUISITION
CONFIRM_USD_TRANSFER
CONFIRM_CURRENCY_CONVERSION
ALLOCATE_CNY_POOL
CONFIRM_SUPPLIER_SETTLEMENT
REVIEW_FX_RECONCILIATION
REVERSE_FX_EVENT
```

High-value, overdue, exception and reversal actions may require approval. Normal planning/draft actions should not create unnecessary approval friction.

---

## 22. Reporting Separation

### Supplier Ledger

Supplier purchases and confirmed supplier settlements only.

### Agent Ledger

Agent credit, advance, acquisition and payment activity only.

### Third-Party Ledger

Funds sent to converter/custodian, conversion completion and refunds.

### Wallet Ledger

Currency quantity and PKR carrying value by wallet.

### Pool Report

USD consumed, CNY received, effective rate, allocated CNY and remaining CNY.

### Generic GL Account Ledger

May continue showing all postings to the selected account.

Rows, cards and exports must use the same filtered dataset.

---

## 23. Profile-A Limitation

With `fxSettlementAccountingEnabled = false`:

- calculate and store conversion benefit/difference;
- display effective rates;
- create reconciliation exceptions;
- do not post realized FX P&L;
- do not create pending FX accounts;
- do not move benefit into Supplier AP;
- do not claim full GL reconciliation where pool carrying cost differs from supplier AP book value.

Any unresolved carrying-value difference must remain clearly visible and must not be hidden through UI filtering.

---

## 24. Acceptance Scenarios

1. Arrangement saved today and resumed two days later.
2. Partial advance paid, remaining advance open.
3. Multiple advance payments.
4. USD acquired on agent credit.
5. USD acquired against prior advance.
6. Partial USD acquisition lots at different rates.
7. USD transferred but not yet confirmed in China.
8. Partial USD arrival.
9. Conversion completed later.
10. Multiple conversion lots.
11. One CNY pool allocated to ten suppliers.
12. Partial supplier allocation.
13. Multiple invoices for one supplier.
14. Pool over-allocation rejected.
15. Invoice overpayment rejected.
16. Duplicate confirmation/retry creates no second journal.
17. Agent AP never appears in Supplier Ledger.
18. Supplier AP does not reduce before supplier confirmation.
19. Third-party pending balance remains visible for two days.
20. Failed conversion remains resumable.
21. Unposted stage cancellation.
22. Posted-stage reversal.
23. Multi Currency OFF rejects financial FX actions.
24. Phase-3 OFF creates no FX P&L journal.

---

## 25. Required Development Order

### Step 1 — Plan Mode only

- live repository/schema audit;
- map existing tables/RPCs/components;
- validate accounting event matrix;
- identify reuse versus new tables;
- produce exact migration and file plan;
- identify blocked Profile-A accounting points;
- no edits or implementation.

### Step 2 — Wave approval

User reviews the plan and explicitly approves one implementation wave.

### Step 3 — Agent/Auto Mode

Implement only the approved wave:

- additive schema;
- services/RPCs;
- tests;
- UI for that wave;
- non-production QA;
- documentation update;
- branch push;
- no automatic next-wave work.

---

## 26. Proposed Implementation Waves

### Wave W0 — Path 21 correctness

- idempotency;
- role-separated ledgers;
- void/orphan handling;
- searchable selectors.

### Wave W1 — Case and stage persistence

- Import FX case header;
- resumable stage/event model;
- timeline/read model;
- no new conversion posting.

### Wave W2 — Advance and USD acquisition

- agent/third-party advances;
- partial funding;
- USD acquisition lots;
- agent credit/prepaid modes.

### Wave W3 — China USD transfer

- source/destination wallets;
- transfer confirmation;
- pending/partial receipt;
- fees.

### Wave W4 — USD-to-CNY conversion and pool

- conversion lots;
- wallet quantity movements;
- effective rate;
- CNY pool.

### Wave W5 — Supplier allocations

- supplier FX open items;
- multi-supplier allocation;
- partial settlement;
- atomic locks.

### Wave W6 — UX and reporting completion

- desktop timeline;
- mobile steps;
- dashboards/queues;
- exports;
- reconciliation reports.

### Phase 3 — Separate accounting approval

- realized FX gain/loss;
- pending FX accounts;
- complete carrying-value reconciliation.

Every wave requires separate approval.

---

## 27. Non-Negotiable Constraints

- PKR remains the GL/base currency.
- UI may show RMB; storage uses CNY.
- `multiCurrencyEnabled` gates operational FX.
- `fxSettlementAccountingEnabled` remains false unless separately approved.
- Existing Path 21 is preserved until replaced through an approved migration.
- No destructive alteration of money tables.
- No historical transaction rewrite.
- No automatic supplier settlement from agent funding.
- No forced same-session completion.
- No mixed Supplier/Agent/Third-Party operational ledgers.
- No hidden FX difference.
- No implementation beyond the approved wave.
