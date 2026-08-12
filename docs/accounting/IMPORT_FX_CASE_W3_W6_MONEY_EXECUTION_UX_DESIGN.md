# Import FX Case — W3–W6 Money Execution UX Design

**Document type:** Canonical end-to-end UX design (documentation only — **not implemented**)  
**Product:** NEW POSV3 ERP / Import FX  
**Base books:** PKR  
**Operational currencies:** PKR + configured `activeCurrencies` (typically USD and CNY; UI may show `CNY (RMB)`)  
**Ops gate:** `accounting_settings.multiCurrencyEnabled = true`  
**Phase-3 gate:** `accounting_settings.fxSettlementAccountingEnabled = false` (Profile A) unless separately approved  

**Status:** Design complete — implementation requires separate wave approvals (W3, then W4, W5, W6, Phase 3).

---

## 0. Purpose and boundaries

### 0.1 Purpose

Define a professional, simple, and **resumable** UX for real Import FX money execution after W2 ARRANGEMENT:

1. Supplier purchase booked in CNY/RMB  
2. Arrangement with money-exchange agent (W2 — already designed/shipped as non-posting)  
3. Agent funding (advance, credit settle, or mixed)  
4. USD/TT acquisition  
5. USD transfer to China  
6. USD→CNY conversion  
7. Resulting CNY pool  
8. Pool allocated partially/fully to many suppliers and purchases  
9. Reconciliation and closure  

Events may span **several days**. Do **not** force them into one three-step wizard. Operators must save, exit, and resume the same case.

### 0.2 Explicit non-goals (this document)

- No code, migrations, RPCs, or database changes authorized by this file  
- No Docker / VPS / production access  
- No changes to W2 Draft PR implementation beyond documentation pointers  
- No Chart of Accounts redesign  
- No shipping Phase-3 FX P&L accounts (`1395` / `2295` / `6100` / `7100`)  
- Path 21 Agent FX remains a **separate** legacy/direct workflow  

### 0.3 Canonical companions

| Document | Role |
|----------|------|
| [`IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md`](./IMPORT_FX_CASE_W1_HOLD_AND_VERIFY.md) | Case shell, stages, fail-closed security |
| [`IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`](./IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md) | Non-posting ARRANGEMENT UI/RPC |
| [`IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md`](./IMPORT_FX_ASYNC_RESUMABLE_WORKFLOW_UX_DESIGN.md) | Async case model + wave map |
| [`POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md`](./POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md) | Events B–F + Profile-A blocked gap |
| [`MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md`](./MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md) | Gates, profiles, settlement accounting |

---

## 1. Product model

```text
Supplier purchase (CNY)
        ↓
W2 Arrangement (planning only — no journal)
        ↓
W3 Agent Funding  ←→  W3 USD Acquisition (order varies by scenario)
        ↓
W4 China USD Transfer (optional skip if already in China wallet)
        ↓
W4 USD → CNY Conversion
        ↓
W5 CNY Pool
        ↓
W5 Supplier Allocation (N suppliers / M invoices / partials)
        ↓
W6 Reconciliation / Close
```

**Path 21 (Scenario D)** stays reachable as a separate screen: direct PKR → FC (often CNY) agent credit/settle without the pooled USD→CNY legs.

### 1.1 Core UX decision

Extend the persistent **Import FX Case workspace** (W1 shell + W2 chrome). Each money event has its own lifecycle:

```text
Draft → Review → Accounting Preview → Confirm → Posted Result
                                         ↓
                              Compensating Reverse (only)
```

Every confirm uses `client_operation_id`, pending-button lock, server idempotency, and a stable reference number. Posted records are **never deleted**.

### 1.2 Wording contract (never mix)

| Label | Meaning | Example |
|-------|---------|---------|
| **Planned** | W2 intention only | Funding mode Advance planned |
| **Expected** | Forecast amount/date | Expected USD 10,000 |
| **Confirmed operationally** | Stage/event accepted | Transfer marked Received |
| **Financially posted** | JE and/or payment exists | Payment PAY-… + JE |
| **Pending posting** | Confirm in flight / claim held | Button locked, claim open |
| **FX review required** | Profile-A difference stored | Book PKR ≠ pool cost PKR |
| **Failed** | Event failed | Transfer Failed |
| **Cancelled** | Unposted / abandoned | Pre-post cancel |
| **Reversed** | Compensating void path | Credit reversed |

Never display planned W2 values as if they were actual money events.

### 1.3 Operational vs accounting status

| Layer | Examples |
|-------|----------|
| Operational | `ARRANGED`, `PARTIALLY_FUNDED`, `USD_ACQUIRED`, `CNY_POOL_AVAILABLE`, `PARTIALLY_ALLOCATED`, `COMPLETED` |
| Accounting | `NOT_POSTED`, `PARTIALLY_POSTED`, `POSTED`, `RECONCILIATION_REQUIRED`, `REVERSED` |

Header always shows **both**. Accounting status must not claim “settled” when only operational allocation is recorded under Profile-A review.

---

## 2. Workspace chrome (all waves)

Reuse the W2 shell pattern: case list + stage nav + stage body + timeline/summary. Money stages unlock only after ARRANGEMENT is completed (and wave is approved/shipped).

### 2.1 Header (always visible)

| Element | Content |
|---------|---------|
| Case number | Stable case ref |
| Branch | Case branch |
| Current operational stage | Chip + stage status |
| Accounting status | Not Posted / Partially Posted / Posted / Reconciliation Required / Reversed |
| Agent | Money-exchange contact |
| Third party | Optional money-exchange converter |
| Planned route | e.g. `PKR → USD → CNY → Suppliers` or Scenario D `PKR → CNY → Suppliers` |
| Totals strip | Expected USD · Actual USD · Expected CNY · Actual CNY pool · Unallocated CNY |
| Last updated / Created by | Audit |
| Save/resume chip | Draft saved / Resume available |
| Risk/blocker badge | Prior-stage lock, FX review, failed event, Multi Currency OFF, unauthorized |

### 2.2 Stage navigation (resumable)

1. **Arrangement** (W2 — read-only after confirm)  
2. **Agent Funding** (W3)  
3. **USD Acquisition** (W3)  
4. **China Transfer** (W4)  
5. **USD→CNY Conversion** (W4)  
6. **CNY Pool** (W5)  
7. **Supplier Allocation** (W5)  
8. **Reconciliation** (W6)  

**Rules:**

- Completed stages remain openable (read-only history + “Add another event” where partials are allowed).  
- Current available stage is editable.  
- Future stages show locked with reason, e.g. `Blocked until at least one USD acquisition is financially posted`.  
- Never force finishing later stages in the same session.  
- Scenario D marks USD Transfer / Conversion as **N/A** (skipped) with Path 21 deep link.

### 2.3 Activity timeline

Each row shows:

- Who performed the action  
- Event date/time  
- Operational event type  
- Amount + currency  
- Source → destination  
- Supporting reference  
- Accounting journal reference **only when financially posted**  
- Reversal/cancellation markers  
- Notes  

Empty: “No money events yet — Arrangement planning only.”

---

## 3. Business scenarios A–F

| Scenario | UX path |
|----------|---------|
| **A — Advance first** | Funding posts PKR to agent advance → Acquisition draws advance into USD wallet → Transfer → Convert → Pool → Allocate |
| **B — Agent credit first** | Acquisition posts Dr USD / Cr Agent AP → later Funding pays Agent AP → Transfer → … Agent liability stays separate from Supplier AP |
| **C — Mixed funding** | Multiple Funding + Acquisition lots; live gauges for remaining advance and open Agent AP; never merge Agent AP into Supplier AP |
| **D — Direct CNY / Path 21** | Banner + deep link to existing Path 21 Agent FX; route `DIRECT_CNY_PATH21`; skip pooled USD/transfer/convert stages as N/A |
| **E — Pooled multi-supplier** | One conversion → one pool lot → allocation grid for 10+ suppliers, multi-invoice, partials, unallocated CNY remains |
| **F — Delays and failure** | Stages stay `PARTIALLY_COMPLETED` / `FAILED`; resume same case; failed events visible; reverse via compensating records only |

### 3.1 Scenario F failure surfaces (examples)

| Situation | Stage status | Operator next action |
|-----------|--------------|----------------------|
| Agent funded, USD not received | Funding Posted; Acquisition empty/partial | Resume Acquisition later |
| USD received, not transferred | Acquisition Posted; Transfer Pending | Open China Transfer |
| USD transferred, conversion pending | Transfer Received; Conversion Awaiting | Open Conversion |
| Conversion done, allocation pending | Pool Available; Allocation empty | Open Allocation |
| Rate/amount changed | Edit draft before confirm; after post use reverse+repost | Never silent rewrite |
| Transaction failed/cancelled | `FAILED` / `CANCELLED` chip on event | Retry new event or reverse |

---

## 4. W3 UX — Agent Funding

### 4.1 Purpose

Record **actual** PKR (normally) money to the **agent**.  

**Never** label this screen “Supplier settled.”  
**Never** auto-reduce Supplier AP from agent funding.

### 4.2 Screen layout

1. **Gauges:** Remaining agent advance · Open Agent AP (this case) · Planned advance (W2, read-only)  
2. **Event list:** Prior funding events (partials) with posted/reversed status  
3. **New funding form** (draft)  
4. **Accounting preview**  
5. **Confirm / Cancel draft** action bar  

### 4.3 Fields

| Field | Notes |
|-------|-------|
| Funding type | Advance payment · Agent credit settle · Mixed line (type per event) |
| Amount | Required; non-negative |
| Currency | Default PKR |
| Agent | Money-exchange only; server-validated |
| Cash/bank account | Branch-permitted liquidity |
| Payment date | Required |
| Reference | External ref |
| Notes | Free text |
| Attachment reference | Metadata/reference; no silent “file uploaded” claim unless binary wave ships |
| Utilization target | Unallocated advance bucket **or** specific acquisition lot (when settling credit) |

### 4.4 Accounting preview (illustrative)

**Advance:**

```text
Dr Agent Advance / Clearing
Cr PKR Bank/Cash
```

**Agent credit settle:**

```text
Dr Agent AP
Cr PKR Bank/Cash
```

### 4.5 Actions and safety

- Draft save (case-level resume)  
- Review → Preview → Confirm  
- `client_operation_id` + pending lock + idempotent retry  
- Posted result: payment ref + JE link  
- Reverse: compensating void path only  

### 4.6 State matrix (Funding)

| State | UX |
|-------|-----|
| Empty | CTA “Record agent funding” |
| Loading | Skeleton gauges + list |
| Draft | Editable form; Confirm enabled when valid |
| Validation error | Inline + toast; Confirm disabled |
| Pending confirmation | Buttons locked |
| Posted | Event row green; gauges update |
| Partially completed | Stage `PARTIALLY_COMPLETED`; Add another funding |
| Failed | Red event; retry new event |
| Cancelled / Reversed | Markers on event; balances restored via reverse |
| Read-only / Multi Currency OFF | View history; mutations blocked |
| Unauthorized | Error banner; no selectors |
| Duplicate retry | Same `client_operation_id` returns same posted result |
| Blocked by prior stage | ARRANGEMENT not completed |
| FX review required | N/A on this screen (allocation wave) |

---

## 5. W3 UX — USD Acquisition

### 5.1 Purpose

Record **actual USD/TT received** from the agent (credit and/or against advance), into a USD wallet, in one or many lots.

### 5.2 Fields

| Field | Notes |
|-------|-------|
| USD amount | Required |
| PKR per USD rate | Execution rate |
| PKR carrying value | Computed; editable only if policy allows fee-split |
| Fees | Explicit; separate from rate |
| USD wallet | TT/local USD account |
| Acquisition date | Required |
| Mode | Agent credit · Advance utilization · Mixed split |
| Agent | Must match case agent (or approved override with audit) |
| Reference / notes / attachment | As Funding |
| Partial / multiple lots | First-class list |

### 5.3 Gauges

- Remaining planned USD (W2 expected − actual)  
- Remaining agent advance  
- Open Agent AP from this case  

### 5.4 Accounting preview

**Credit:**

```text
Dr USD TT Wallet
Cr Agent AP
```

**Against advance:**

```text
Dr USD TT Wallet
Cr Agent Advance / Clearing
```

### 5.5 Distinctions

| Phrase | Allowed? |
|--------|----------|
| USD acquired | Yes (after post) |
| Agent funded | Funding screen only |
| Supplier settled | Allocation screen only |
| USD purchased (as synonym for planned) | No — use “USD acquisition financially posted” |

### 5.6 State matrix

Same family as §4.6, plus:

- **Blocked** until ARRANGEMENT completed; credit-first Scenario B allows Acquisition **before** Funding; advance-first Scenario A should warn if Acquisition exceeds remaining advance.  
- **Partially completed** when actual USD < expected USD and operator leaves.

---

## 6. W4 UX — China USD Transfer

### 6.1 Purpose

Move USD quantity (and equal PKR carrying) from source USD wallet to China USD holding. Supports delays: Pending → Sent → Received / Failed.

### 6.2 Fields

| Field | Notes |
|-------|-------|
| Source USD wallet | Must hold available USD |
| China destination USD wallet | Required |
| USD amount | ≤ available; partials allowed |
| Transfer date | Required |
| Charges/fees | Explicit |
| Transfer reference | External |
| Status | Pending / Sent / Received / Failed |
| Remaining USD after | Live |

### 6.3 Accounting preview

Equal-carrying transfer (fees separate):

```text
Dr China USD Wallet
Cr Source USD Wallet
```

Fee (if posted):

```text
Dr Fee expense/clearing
Cr Bank or wallet (per policy)
```

### 6.4 Reverse rules

Reverse only if destination USD is **not** already consumed by a conversion lot. Otherwise show blocker: “Conversion already used this USD — reverse conversion first.”

### 6.5 State matrix

Includes pending/sent/received/failed as first-class operational statuses; financially posted when JE exists. Blocked until sufficient USD acquisition posted (unless Scenario D N/A).

---

## 7. W4 UX — USD→CNY Conversion

### 7.1 Purpose

Consume China USD, receive CNY into a **pool**, at an execution rate. Creates/updates the CNY pool used by W5.

### 7.2 Fields

| Field | Notes |
|-------|-------|
| China USD wallet | Source |
| USD amount consumed | From available transferred/acquired China USD |
| USD/CNY execution rate | Required |
| CNY amount received | Computed or entered with validation |
| Fees | Explicit |
| Effective PKR/CNY cost | Display |
| Conversion date | Required |
| Third-party converter | Optional money_exchange ≠ agent when applicable |
| Conversion reference | External |
| Source USD lots | Multi-select / FIFO display |
| Created/updated CNY pool | Result chip |

**Display:** `CNY (RMB)` · **Store:** ISO `CNY`.

### 7.3 Accounting preview (Profile A)

```text
Dr CNY Pool Wallet
Cr China USD Wallet   (equal PKR carrying)
```

Fees separate. **No** FX gain/loss / pending FX accounts while `fxSettlementAccountingEnabled = false`.

### 7.4 Partial conversions

Multiple conversion events may fill one logical pool or create linked lots; UI shows pool total and lot list.

### 7.5 State matrix

Standard set + **FX review required** only if fee/rate policy flags inconsistency (not supplier book difference — that is W5).

---

## 8. W5 UX — CNY Pool dashboard

### 8.1 Purpose

Single pane of truth for pool quantity and carrying cost before/while allocating.

### 8.2 Cards / metrics

| Metric | Meaning |
|--------|---------|
| Pool number | Stable ref |
| Source conversion | Link to conversion event(s) |
| Total CNY received | Quantity |
| Total PKR carrying cost | Wallet PKR |
| Effective PKR/CNY | Carrying / CNY |
| Allocated CNY | Sum of confirmed allocations |
| **Unallocated CNY** | Remaining available |
| Number of suppliers | Distinct allocated parties |
| Pool status | Open / Partially allocated / Fully allocated / Closed |
| Source USD lots | Traceability |

### 8.3 States

Empty (no conversion yet) · Loading · Open with unallocated · Fully allocated · Read-only · FX review residual on carrying vs quantity (report) · Multi Currency OFF history.

---

## 9. W5 UX — Supplier Allocation

### 9.1 Purpose

Allocate unallocated CNY from the pool to one or many supplier invoices. Supports Scenario E (10+ suppliers), multi-invoice per supplier, and partials.

### 9.2 Search

Server-side search by:

- Supplier name / code  
- Purchase number  
- Supplier invoice / reference  
- Outstanding CNY  
- Branch  

Company + branch authorization on every selection. Client filter is UX-only.

### 9.3 Allocation table (desktop) / expandable cards (mobile)

| Column | Meaning |
|--------|---------|
| Supplier | Name + code |
| Purchase / invoice | Refs |
| Original invoice CNY | Document foreign total |
| Already settled CNY | Prior allocations |
| Outstanding CNY | Remaining |
| CNY allocated now | Draft input |
| Invoice book value PKR | AP book for this slice |
| Allocated pool cost PKR | Pool carrying for this CNY |
| Difference | Book − pool cost (signed) |
| Allocation status | Draft / Posted / Review / Reversed |

### 9.4 Batch behaviors

- Multiple suppliers in one batch  
- Multiple invoices per supplier  
- Partial allocations  
- Save allocation **draft** (resume later)  
- Live remaining pool  
- Remove/edit draft rows  
- Validate totals before confirmation  
- Confirmation preview (per line + batch totals)  
- Duplicate-submit protection via `client_operation_id`  
- Reversal only via compensating action  

### 9.5 Hard blocks

- Total CNY allocated > available pool  
- Line CNY > invoice outstanding  
- Cross-company or unauthorized branch  
- Treating duplicate retry as a new money movement  
- Labeling agent funding as supplier settlement  

### 9.6 Profile-A difference UX (mandatory)

When `allocated_pool_cost_pkr ≠ allocated_invoice_book_pkr`:

1. Show difference prominently on each line and on batch totals.  
2. Mark `FX_REVIEW_REQUIRED`.  
3. **Do not** credit/debit the difference into Supplier AP.  
4. **Do not** create hidden P&L.  
5. **Do not** use accounts `1395` / `2295` / `6100` / `7100` while Phase-3 gate is OFF.  
6. **Do not** claim “fully financially settled” if the journal cannot balance under Profile A.

**Default shipped Profile-A confirm policy (this design):**

- Block confirmation that would claim a complete balanced settlement when residual ≠ 0 (within tolerance).  
- Show review banner explaining the blocked gap.  
- Allow saving the allocation **draft** and raising an FX review exception for accounting review.  

**Documented alternate (requires separate owner approval before shipping):** post supplier payment at **book PKR**, consume CNY quantity operationally, and leave carrying residual as transparent `FX_REVIEW_REQUIRED` — still never invent a balancing P&L leg.

### 9.7 Future Phase 3 panel (disabled)

Visible but clearly labeled:

> **Future Phase 3 — not shipped.** When `fxSettlementAccountingEnabled = true`, the difference may post to pending FX accounts and later to FX P&L. This company is currently on Profile A.

### 9.8 State matrix (Allocation)

Includes empty, loading, draft, validation error, pending confirmation, posted, partially completed, failed, cancelled, reversed, read-only, Multi Currency OFF, unauthorized, duplicate retry, blocked by prior stage (no pool / no unallocated CNY), **FX review required**.

---

## 10. W6 UX — Reconciliation and reports

### 10.1 Case reconciliation board

| Block | Content |
|-------|---------|
| Agent | Amount due / paid / remaining |
| USD | Acquired / transferred / remaining |
| CNY | Created / allocated / remaining unallocated |
| Supplier book PKR | Sum of allocated book |
| Pool carrying PKR | Sum of allocated + residual carrying |
| FX review difference | Total open reviews |
| Fees | Sum by stage |
| Incomplete stages | Checklist |
| Blockers | Failed events, unauthorized, review |
| Close eligibility | Pass/fail checklist |

### 10.2 Role-separated ledgers (operational)

| View | Shows | Must not mix |
|------|-------|--------------|
| Supplier ledger | Merchandise AP / purchase settlements | Agent FX AP |
| Agent ledger | Advances, Agent AP, agent payments | Supplier purchase AP |
| USD wallet ledger | Quantity + carrying movements | CNY pool as same wallet |
| CNY wallet/pool ledger | Pool lots + allocations | USD lots as same |
| Bank ledger | PKR funding/fee cash movements | Party role confusion |

If one contact has multiple roles, operational screens filter by **business role/source**. Account Ledger remains full GL-account history.

### 10.3 Case closure

Allow **Close case** only when all are true:

1. Required money events for the chosen route are financially posted (or marked N/A for Scenario D).  
2. No unresolved `FAILED` event.  
3. Allocations reconcile **or** remaining pool is intentionally carried/transferred with an explicit reason.  
4. Required FX reviews are resolved or formally accepted per policy.  
5. Reversals are complete (no half-reversed chains).  

Closure is an **operational** status change. It must not rewrite history or delete journals.

### 10.4 State matrix (Reconciliation)

Empty (nothing to reconcile) · Loading · In progress · FX review required · Ready to close · Closed · Blocked · Read-only / Multi Currency OFF · Unauthorized.

---

## 11. Confirmation and safety design (all financial actions)

### 11.1 Five-step confirm

1. **Draft** — editable, not posted  
2. **Review** — human-readable summary  
3. **Accounting preview** — debit/credit rows before confirm  
4. **Confirm** — pending lock  
5. **Posted result** — refs + timeline event  

Plus **Reversal/void path** where allowed (compensating records only).

### 11.2 Always present

| Control | Requirement |
|---------|-------------|
| `client_operation_id` | Generated once; reuse on retry |
| Pending-button lock | Prevents double click |
| Safe retry | Same op returns same result |
| Server idempotency | Authoritative |
| Stable reference number | Case/event/payment/JE |
| Clear success/failure | Toast + timeline |

### 11.3 Forbidden

- Deleting posted financial records  
- Silent rewrite of posted amounts/rates  
- Client-only authorization  

---

## 12. Search and selectors

All money-stage selectors must support:

- Server-side validation  
- Company and branch filtering  
- Search by name / code / reference (and phone for agents where available)  
- Loading state  
- No-results state  
- Clear selection  
- Keyboard navigation (existing combobox patterns)  
- Paginated results where lists are large  

**Do not trust client-side filtering for authorization.**

Agent selectors include only `money_exchange` (or approved agent role). Normal suppliers appear in allocation/purchase selectors, not as agents, unless they also hold the agent role.

---

## 13. Responsive design

| Width | Layout |
|-------|--------|
| **~1440px desktop** | Case list \| Stage nav \| Stage body \| Timeline/summary |
| **~1024px tablet** | Collapsible list; horizontal stage chips; body + sticky totals strip |
| **~390px mobile** | Vertical stack; sticky totals; allocation = expandable supplier/invoice cards; fixed bottom action bar; compact vertical timeline; dialogs fit viewport; **no horizontal page scrolling** |

### 13.1 Mobile specifics

- Cards stack vertically  
- Totals remain visible (sticky under header)  
- Action buttons do not overflow (wrap / full-width stack)  
- Accounting preview remains readable (stacked Dr/Cr rows)  
- Timeline uses compact vertical presentation  

Baseline chrome: existing W2 [`ImportFxCaseWorkspace`](../../src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx) patterns.

---

## 14. Required UI states (checklist)

Every major money screen must design for:

1. Empty  
2. Loading  
3. Draft  
4. Validation error  
5. Pending confirmation  
6. Posted  
7. Partially completed  
8. Failed  
9. Cancelled  
10. Reversed  
11. Read-only  
12. Multi Currency OFF  
13. Unauthorized  
14. Duplicate retry  
15. Blocked by prior stage  
16. FX review required  

---

## 15. Wave approval gates

| Wave | Money journals? | Unlock condition |
|------|-----------------|------------------|
| **W3** Agent Funding + USD Acquisition | Yes | Separate owner approval |
| **W4** China Transfer + Conversion | Yes (equal carrying) | Separate approval after W3 |
| **W5** CNY Pool + Supplier Allocation | Yes with Profile-A limits | Separate approval after W4 |
| **W6** Reconciliation / close / role ledgers | Mostly read + close rules; no new P&L | Separate approval |
| **Phase 3** FX P&L / pending FX | Yes (`1395`/`2295`/`6100`/`7100`) | `fxSettlementAccountingEnabled = true` |

W2 remains **non-posting** until W3 is explicitly authorized and shipped.

---

## 16. Relationship to Path 21

| | Path 21 Agent FX | Import FX Case pooled route |
|--|------------------|-----------------------------|
| Entry | Separate Purchases → Agent FX wizard | Import FX Cases workspace |
| Typical FC | CNY or USD bought and used as settlement currency | USD bought → convert → CNY pool → many suppliers |
| UX | Keep visible as legacy/direct | Primary multi-day pooled UX |
| Change rule | Must remain until approved migration story | Additive; must not silently replace Path 21 |

Scenario D uses Path 21 with a clear banner inside the case: “Direct CNY/USD agent FX — open Path 21 for posting.”

---

## 17. Implementation status

| Item | Status |
|------|--------|
| This UX design document | **Complete (docs only)** |
| W3–W6 code / migrations / RPCs | **Not implemented** |
| W2 ARRANGEMENT | Separate branch/PR — non-posting |
| Path 21 | Shipped; unchanged by this design |
| Phase-3 COA | Not authorized |

---

## 18. Acceptance scenarios (UX)

1. Advance-first case resumes after three days at Conversion.  
2. Credit-first acquisition posts Agent AP; later Funding clears Agent AP; Supplier AP untouched.  
3. Mixed: two advances + one credit acquisition; gauges correct.  
4. Path 21 deep link from Scenario D case; pooled stages N/A.  
5. One pool allocates to ten suppliers; unallocated CNY remains.  
6. One invoice receives two partial allocations.  
7. Over-allocation blocked; unauthorized branch blocked.  
8. Profile-A difference shows `FX_REVIEW_REQUIRED`; no silent AP/P&L.  
9. Duplicate confirm retries safely.  
10. Failed transfer visible; resume and retry without deleting history.  
11. Close blocked until checklist passes.  
12. Multi Currency OFF: historical read-only; no new money events.  

---

## 19. Document control

| Field | Value |
|-------|-------|
| Created | 2026-08-12 |
| Type | Canonical UX design |
| Authorizes implementation? | **No** — wave-by-wave owner approval required |
| Supersedes | Money-stage UI sections implied as “W2 money” in older drafts (those are W3+) |
