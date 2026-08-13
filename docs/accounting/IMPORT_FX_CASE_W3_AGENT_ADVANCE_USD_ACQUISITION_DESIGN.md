# Import FX Case — W3 Agent Advance & USD/TT Acquisition Design

**Status:** **DESIGN ONLY — NOT SHIPPED** · **Owner decisions OD-1–OD-7 LOCKED**  
**Branch:** `docs/import-fx-w3-advance-usd-acquisition-design` (stacked on W2.1)  
**Base HEAD:** `0d9d274e` (`feat/import-fx-w2-arrangement-enrichment` / Draft PR #23)  
**Rule:** **No W3 implementation PR may merge before W2/W2.1.** This document posts **no** accounting.

**Companions**
- [`IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md`](./IMPORT_FX_CASE_W2_ARRANGEMENT_ENRICHMENT.md)
- [`IMPORT_FX_CASE_W2_1_OPERATOR_CLARITY_AND_ASSIGNMENT.md`](./IMPORT_FX_CASE_W2_1_OPERATOR_CLARITY_AND_ASSIGNMENT.md)
- [`IMPORT_FX_OPERATOR_WORKFLOW_AND_GAP_ANALYSIS.md`](./IMPORT_FX_OPERATOR_WORKFLOW_AND_GAP_ANALYSIS.md)
- [`IMPORT_FX_CASES_VS_AGENT_FX_OPERATOR_WORKFLOW.md`](./IMPORT_FX_CASES_VS_AGENT_FX_OPERATOR_WORKFLOW.md)
- [`MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md`](./MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md)
- [`POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md`](./POOLED_USD_RMB_MULTI_SUPPLIER_SETTLEMENT_WORKFLOW.md)
- [`PAYMENT_ENTRY_PATHS.md`](./PAYMENT_ENTRY_PATHS.md)
- [`coa-developer-center/01_CHART_OF_ACCOUNTS_AUDIT.md`](./coa-developer-center/01_CHART_OF_ACCOUNTS_AUDIT.md)
- [`.cursor/rules/multi-currency-import-fx.mdc`](../../.cursor/rules/multi-currency-import-fx.mdc)

**Gates:** `multiCurrencyEnabled` (ops) · `fxSettlementAccountingEnabled = false` (Profile A — no FX P&L / Pending FX journals in W3)

---

## Owner Decision Register (LOCKED)

| Decision | Approved choice | Rationale | Implementation constraint |
|----------|-----------------|-----------|---------------------------|
| **OD-1** Agent FX Advance control | Control role **`AGENT_FX_ADVANCE_CLEARING`**; display **Agent FX Advance / Settlement Clearing**; **settings-mapped per company** | Need Current Asset to hold unapplied PKR advances separate from Agent AP | Never hardcode account code `1230`. Audit live CoA before assign. Forbidden: `1180`, `1395`, `2295`, `6100`, `7100`. Separate from Agent AP, Supplier AP, FX P&L |
| **OD-2** Fees | **No fee posting in W3 v1** | Avoid silent capitalize/expense without fee CoA approval | Posted events require fee amount **zero/NULL**. Do not store display-only fee. UI may show “Fee posting available in a later approved wave” |
| **OD-3** USD wallet costing | **Immutable acquisition lots** (USD qty + PKR carrying); wallet ops reporting = **weighted average**; reverse compensates original lot | Traceable lots for W4; WA for wallet-level views | Never rewrite posted lots. Distinguish source lots vs derived WA. W4 consumes under approved model |
| **OD-4** Advance application | Default **FIFO — oldest available posted agent advance first**; authorized manual allocation before post only | Predictable default + controlled override | Manual: same company/branch/agent; ≤ available; preview each advance; immutable + audit. No change after post — reverse & repost |
| **OD-5** Path 21 | **Separate**; W3 requires Import FX case; one event cannot post both paths; **no** `import_fx_case_id` on Path 21 in v1 | Preserve shipped money wizard | Soft similarity warning only. No auto-migration. UI must show which path is used |
| **OD-6** Accounting status | `NOT_POSTED` → first W3 money → **`PARTIALLY_POSTED`**; further posts stay partial; reversals recompute; **never** set final `POSTED` in W3 | Final close belongs to W6/reconciliation | Operational stage + assignment statuses remain separate |
| **OD-7** Duplicate protection | **Hard** idempotency + **soft** similarity warning | Prevent double JE without blocking legitimate ops | Soft warn does **not** replace hard `client_operation_id` / unique / atomic / lock / replay |

**Partial reversal (locked):** W3 v1 reverses **entire posted events** only (full compensating JE). Partial amount within an event = reverse whole event + repost corrected event. No in-place amount surgery.

---

## 1. Executive summary

W3 turns an **ARRANGED** Import FX Case into a **money-capable** shell for two **separate** postable events:

1. **Actual Agent Advance** — company pays PKR to a `money_exchange` agent **before** (or independently of) receiving USD/TT.  
2. **Actual USD/TT Acquisition** — company receives USD quantity into an approved TT wallet at a **PKR carrying cost**, funded by **advance**, **agent credit**, or **mixed**.

| Today (W2/W2.1) | W3 (this design) |
|-----------------|------------------|
| Planning / assignment only | Posts PKR journals for advance + USD acquisition |
| `posts_journal: false` | Money RPCs post journals; drafts remain non-posting |
| Path 21 separate money wizard | Path 21 **preserved and unmodified** in W3 v1 |

**Hard exclusions:** China USD transfer, USD→CNY, CNY pool, supplier allocation/payment, Supplier AP for FX conversion benefit, Phase-3 FX accounts (`1395`/`2295`/`6100`/`7100`), fee posting (OD-2).

**Approved control role:** `AGENT_FX_ADVANCE_CLEARING` (settings-mapped). Exact numeric code chosen at provision time after live CoA audit — see §CoA collision audit. **Do not hardcode `1230`.**

---

## 2. Business scenarios

### 2.1 Advance first

1. Arrangement confirmed (W2).  
2. Pay PKR 2,000,000 to agent (advance posted → Dr Clearing / Cr Bank).  
3. Later USD 5,000 @ 287.50 → carrying 1,437,500 applied from advance.  
4. Remaining unapplied advance 562,500.

### 2.2 USD on credit first

1. Arrangement confirmed.  
2. USD 10,000 @ 287.50 → Dr TT wallet 2,875,000 / Cr Agent AP 2,875,000.  
3. Later agent payment via **existing** Path 21 Step 2 / `createSupplierPayment` (reference only; not redesigned).

### 2.3 Mixed funding

Unapplied advance 1,000,000; acquire USD 10,000 carrying 2,875,000 → Cr Clearing 1,000,000 + Cr Agent AP 1,875,000.

### 2.4 Multiple events

Many advances and many USD lots → accounting stays **`PARTIALLY_POSTED`** (OD-6).

---

## 3. W2 → W3 handoff

| Prerequisite | Rule |
|--------------|------|
| Case | `ARRANGED` (+ `arrangement_confirmed_at`) |
| Agent | Required active `money_exchange` (W2.1); NULL-agent historical ARRANGED **ineligible** |
| Accounting | Starts `NOT_POSTED`; first W3 money → `PARTIALLY_POSTED` only |
| Planned W2 fields | Remain plan; W3 posts actuals |
| Assignment | Operational only |
| Multi Currency | ON for mutations |
| Clearing account | Must be configured via settings (`AGENT_FX_ADVANCE_CLEARING`) before advance or ADVANCE/MIXED USD post |

---

## 4. Event model

| Event type | Meaning | posts_journal on confirm |
|------------|---------|--------------------------|
| `AGENT_ADVANCE` | PKR paid to agent; ↑ unapplied advance | **true** |
| `USD_ACQUISITION` | Immutable USD lot (qty + carrying PKR) into TT wallet | **true** |

Lifecycle: `DRAFT` → `POSTED` → `REVERSED` (compensating). **No DELETE.**

Advance application embedded in USD post (ADVANCE/MIXED) and stored as immutable `ADVANCE_APPLICATION` link rows (FIFO or manual override per OD-4).

Fee fields on posted events: **must be NULL/0** (OD-2).

---

## 5. Proposed tables (design only)

| Table | Purpose |
|-------|---------|
| `import_fx_case_advances` | Draft/posted advances; bank account; JE; `client_operation_id`; fee NULL |
| `import_fx_case_usd_acquisitions` | Immutable lots: qty, rate, carrying PKR, wallet, funding split, JE |
| `import_fx_case_advance_applications` | Advance↔acquisition applied PKR; immutable when posted; FIFO or manual audit |

Reuse: `import_fx_cases` / stages / events; `import_fx_client_operations`; TT `12xx`; Agent AP under **2000**; Cash/Bank. **Do not** add `import_fx_case_id` to Path 21 tables in W3 v1 (OD-5).

---

## 6. Reusable existing tables

| Artifact | Reuse |
|----------|-------|
| Case shell / events / client ops | Audit + idempotency |
| TT wallets (`_is_tt_agent_wallet_account`) | USD destination |
| Agent AP under 2000 | Credit / mixed remainder |
| Path 21 `fx_currency_purchases` | **Separate path only** — no W3 v1 bridge |
| Settings JSON | Map `agentFxAdvanceClearingAccountId` (or equivalent) to `AGENT_FX_ADVANCE_CLEARING` |

---

## 7. Journal matrix (locked)

Official books **PKR**. USD qty = lot metadata.

| # | Event | Debit | Credit |
|---|-------|-------|--------|
| A1 | Agent advance | **Agent FX Advance / Settlement Clearing** | Cash/Bank |
| U1 | USD fully credit | USD/TT wallet | Agent AP |
| U2 | USD fully from advance | USD/TT wallet | Agent FX Advance / Settlement Clearing |
| U3 | USD mixed | USD/TT wallet (full carrying) | Clearing (applied) + Agent AP (remainder) |
| R* | Full event reverse | Compensating invert of original lines | — |

**Fees:** not posted in W3 v1 (OD-2).  
**Never:** Supplier AP, inventory, CNY, FX P&L, Pending FX, Worker Advance `1180`.

### Formulas

```text
carrying_pkr         = usd_qty × pkr_per_1_usd
advance_applied_pkr  = FIFO/manual ≤ unapplied_advance ∧ ≤ carrying_pkr
agent_ap_created_pkr = carrying_pkr − advance_applied_pkr
fee_pkr              = NULL or 0   # OD-2
```

CREDIT: apply = 0. ADVANCE: apply = carrying (reject if insufficient). MIXED: both > 0; `apply + ap = carrying`.

---

## 8. Balanced accounting examples

Illustrative labels: bank `1010`, TT wallet `1205`, clearing shown as **Agent FX Advance / Settlement Clearing** (settings-mapped; example code `1230*` only if live-free — see CoA audit). Rate **287.50 PKR per 1 USD**.

### 8.1 Agent advance

| Side | Account | PKR |
|------|---------|-----|
| Dr | Agent FX Advance / Settlement Clearing | 2,000,000 |
| Cr | Cash/Bank (1010) | 2,000,000 |

Balanced. USD qty: n/a. Unapplied advance = 2,000,000. Accounting → `PARTIALLY_POSTED`.

### 8.2 USD acquisition fully from advance

Prior unapplied 2,875,000. Acquire USD **10,000** @ 287.50 → carrying **2,875,000**.

| Side | Account | PKR | USD qty |
|------|---------|-----|---------|
| Dr | USD TT Wallet (1205) | 2,875,000 | +10,000 |
| Cr | Agent FX Advance / Settlement Clearing | 2,875,000 | — |

Unapplied after = 0. Lot immutable. Wallet WA carrying updates from lots.

### 8.3 USD acquisition fully on credit

| Side | Account | PKR | USD qty |
|------|---------|-----|---------|
| Dr | USD TT Wallet | 2,875,000 | +10,000 |
| Cr | Agent AP | 2,875,000 | — |

Remaining Agent AP = 2,875,000. Agent Payment Pending (ops). No bank.

### 8.4 Mixed USD acquisition

Unapplied advance 1,000,000. Acquire USD 10,000 carrying 2,875,000.

| Side | Account | PKR |
|------|---------|-----|
| Dr | USD TT Wallet | 2,875,000 |
| Cr | Agent FX Advance / Settlement Clearing | 1,000,000 |
| Cr | Agent AP | 1,875,000 |

USD qty +10,000 on lot. Remaining advance = 0. Remaining Agent AP = 1,875,000. Balanced.

### 8.5 Multiple advances (FIFO)

| Date | Advance posted | Unapplied after |
|------|----------------|-----------------|
| D1 | 1,000,000 | 1,000,000 |
| D2 | 500,000 | 1,500,000 |

Later acquire carrying 1,200,000 ADVANCE mode → consume D1 1,000,000 + D2 200,000 (FIFO). Applications stored immutably. Remaining unapplied = 300,000 (D2 remnant).

### 8.6 Partial USD acquisition

Plan 30,000 USD. Lot1: 10,000 @ 287.50 → carrying 2,875,000 (credit or advance per funding). Ops: **USD Partially Acquired**. Accounting remains `PARTIALLY_POSTED`.

### 8.7 Full reversal — unapplied advance

Reverse A1: Dr Bank 2,000,000 / Cr Clearing 2,000,000. Event `REVERSED`. Unapplied ↓. Recompute accounting from remaining active posts.

### 8.8 Full reversal — USD acquisition (mixed)

Invert U3 lines; restore advance applications; restore Agent AP; reduce wallet qty/carrying on lot. Order: reverse acquisition **before** reversing advances it consumed.

### 8.9 Partial reversal policy

**Not supported as partial JE.** To correct amount: reverse **entire** posted event, then post new correct event (OD partial-reversal lock).

---

## 9. USD lots vs weighted-average reporting (OD-3)

| Layer | Behavior |
|-------|----------|
| **Source lot** | Immutable row: `usd_qty`, `pkr_carrying`, rate, wallet, funding split, JE id |
| **Wallet WA report** | Derived: `Σ carrying / Σ qty` across active (non-reversed) lots on that wallet |
| **Reversal** | Compensates **original lot**; does not rewrite lot history |
| **W4** | Consumes traceable qty/carrying per later approved consumption model |

---

## 10. Status model (OD-6)

### Accounting

| Status | Rule |
|--------|------|
| `NOT_POSTED` | No active W3 money JE |
| `PARTIALLY_POSTED` | After **first** valid posted advance or USD acquisition; **stays** here for further W3 posts |
| `POSTED` | **Forbidden in W3** — reserved for W6 / full reconciliation approval |
| Recompute | After reverse: if no active W3 money left → `NOT_POSTED`; else `PARTIALLY_POSTED` |

### Operational labels (examples)

Arrangement Confirmed; Advance Not/Partial/Posted; USD Pending/Partial/Acquired; Agent Payment Pending; Partially Reversed; Reversed.  
**Assignment status** never drives accounting status.

---

## 11. Advance application (OD-4)

1. **Default:** FIFO oldest available posted advance for same company/branch/agent.  
2. **Manual before post** only if authorized and:
   - selected advances same company, branch, agent  
   - total apply ≤ available on each and in aggregate  
   - accounting preview lists every selected advance  
   - allocation stored immutably + audit event for override  
3. **After post:** no reallocation — reverse & repost.

---

## 12. Path 21 coexistence (OD-5)

| Path 21 today | W3 |
|---------------|-----|
| Dr TT / Cr Agent AP; pay agent; pay supplier from wallet | Advance + USD acquisition only |
| No case required | **Import FX case required** |
| Separate wizard | Separate UI; must label path |

**Rules:** one commercial event cannot post both paths; no Path 21 schema bridge in v1; no historical migration; soft warn on similar agent/date/ref/qty/amount/Path21 row.

---

## 13. Idempotency & duplicate protection (OD-7)

**Hard**

- `client_operation_id` required on confirm-post  
- UNIQUE `(company_id, event_type, client_operation_id)`  
- Atomic RPC + `FOR UPDATE`  
- Retry → original result (`idempotent_replay`)  
- No duplicate journal  

**Soft warning (review, not substitute)**

- Same agent + similar date + same external ref and/or same USD qty and/or same PKR/rate and/or possible matching Path 21 event  

---

## 14. CoA collision / compatibility audit (read-only)

| Item | Evidence | Result |
|------|----------|--------|
| Role `AGENT_FX_ADVANCE_CLEARING` | Owner OD-1 | **Approved** |
| Suggested code `1230` in settlement design | Design suggestion only | **Not live-provisioned in migrations** |
| Migration search for `1230` | No seed/create hits in `migrations/` | No repo-seeded collision found |
| CoA audit assets | `1100`, `1200`, `1180` cited; TT party `12xx` | `1180` = Worker Advance (**forbidden**) |
| Phase-3 codes | `1395`/`2295`/`6100`/`7100` | **Forbidden** for W3 advance |
| Live company CoA | Not queried in this docs task | Exact **`1230` availability UNRESOLVED** until provision-time live audit |

| Nearby / control | Role | W3 use |
|------------------|------|--------|
| `1180` | Worker Advance | **Do not use** |
| `1200` | Inventory | Unrelated |
| `12xx` named TT | FC wallets | USD destination only — not clearing |
| `2000` + AP children | Agent/Supplier AP | Credit/mixed AP only |
| `1230` (if free) | Candidate for clearing | Prefer if unused & consistent |
| Else | Next free current-asset code | Settings-mapped |

**Settings key (proposed):** `accounting_settings.agentFxAdvanceClearingAccountId` (uuid) resolving role `AGENT_FX_ADVANCE_CLEARING`.

**Implementation rule:** Before creating any account, run live CoA audit per company. Assign `1230` **only if unused**; otherwise next approved current-asset code. **Never hardcode `1230` in RPCs.**

---

## 15. RPC contracts (design)

Unchanged shape from prior design; add validations:

- Fee NULL/0 on post  
- Clearing account configured for advance / ADVANCE / MIXED  
- FIFO or validated manual applications  
- OD-6 status recompute  
- OD-7 hard idempotency  

| RPC | posts_journal |
|-----|---------------|
| `create/update_*_advance_draft` | false |
| `confirm_post_import_fx_case_advance` | **true** |
| `create/update_*_usd_acquisition_draft` | false |
| `confirm_post_import_fx_case_usd_acquisition` | **true** |
| `reverse_import_fx_case_advance` / `_usd_acquisition` | **true** |
| `get_import_fx_case_money_overview` | false |

---

## 16. Validation / errors (additions)

| Code | When |
|------|------|
| `IMPORT_FX_CASE_ADVANCE_ACCOUNT_NOT_CONFIGURED` | Missing settings-mapped clearing |
| `IMPORT_FX_CASE_FEE_NOT_ALLOWED` | Non-zero fee on W3 v1 post |
| `IMPORT_FX_CASE_INSUFFICIENT_ADVANCE` | Apply > available |
| `IMPORT_FX_CASE_MANUAL_ADVANCE_INVALID` | Manual pick fails OD-4 rules |
| Soft duplicate | Warning payload; operator must confirm |

---

## 17. UI notes

- Show path badge: **Import FX Case (W3)** vs **Agent FX (Path 21)**.  
- Fee field: disabled / “available in a later approved wave”.  
- Clearing missing: block Confirm & Post with configure message.  
- Screens 1–14 from prior design remain; previews use role names not hardcoded codes.

---

## 18. Security

Fail-closed company/branch; `money_exchange` agent; TT wallet validation; RPC-only; Profile A no FX P&L; revoke helpers from anon/authenticated.

---

## 19. W3 exclusions

China transfer/conversion/pool; supplier allocation/payment; FX P&L; Path 21 redesign/bridge; fee posting; final `POSTED`; silent CoA create without mapped role + live code pick.

---

## 20. W3 → W4 handoff

Requires ≥1 active posted USD lot with remaining qty + carrying. W4 consumption model separate approval.

---

## 21. Remaining decisions before implementation

| Item | Status |
|------|--------|
| Live per-company CoA: is `1230` free? | **Open at provision** (role locked) |
| Exact settings key naming in `accounting_settings` JSON | Confirm at impl |
| W2/W2.1 PR #23 merge | **Gate** — no W3 money PR before |
| Separate owner approval to **implement** money RPCs/UI | Still required (docs ≠ ship) |
| W4 lot consumption algorithm | Later wave |

---

## 22. Proposed implementation waves

| Wave | Work | Gate |
|------|------|------|
| W3-D0 | Design + **OD lock** (this revision) | Done (docs) |
| W3-A | Live CoA audit → map/create clearing under role | OD-1 + live code pick |
| W3-B | Schema + idempotency | After W2/W2.1 merge |
| W3-C | Post/reverse RPCs + JE | Explicit money approval |
| W3-D | UI | After C |
| W3-E | Soft Path 21 duplicate warnings | After D |

---

## 23. Acceptance checklist (future impl)

- [ ] A1/U1/U2/U3 balance in PKR; USD qty on lots  
- [ ] Fee non-zero rejected  
- [ ] FIFO + manual override audit  
- [ ] Status never auto-`POSTED`  
- [ ] Reverse whole event only; recompute status  
- [ ] Hard idempotency; soft warn separate  
- [ ] Clearing via settings map, not hardcoded 1230  
- [ ] Path 21 unchanged; no case_id on Path 21 rows  
- [ ] No Supplier AP / CNY / FX P&L / 1180  

---

## 24. Files inspected (this lock revision)

- Prior W3 design on this branch  
- `docs/accounting/coa-developer-center/01_CHART_OF_ACCOUNTS_AUDIT.md`  
- Settlement design CoA table (`1230` suggestion)  
- Migration grep: no `1230` seed  
- Path 21 / multi-currency rule / W2.1 handoff  

---

## 25. Confirmation — this document posts no accounting

Documentation only. Does **not** create accounts, journals, payments, migrations, or change PR #23 / Path 21 / production. Live financial delta from this markdown: **none**.

---

## Document control

| Field | Value |
|-------|-------|
| Path | `docs/accounting/IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md` |
| Branch | `docs/import-fx-w3-advance-usd-acquisition-design` |
| Depends on | W2.1 `0d9d274e` / PR #23 |
| OD lock revision | 2026-08-13 |
| Commit | *(set after push)* |
