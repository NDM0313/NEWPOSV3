# Import FX W3.1 — Custody, Routing & Distribution Design

**Status:** LOCAL IMPLEMENTATION COMPLETE (2026-08-15) — additive migrations + UI + Demo Mode; **not** applied to production/VPS in this task  
**Profile A:** `fxSettlementAccountingEnabled = false` (no FX P&L / Phase-3 accounts)  
**Gates:** `multiCurrencyEnabled` for mutations; historical reads remain fail-closed on company/branch  

**Companions**
- [`IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md`](./IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md) (OD-1–OD-7 locked)
- [`IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md`](./IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md)
- [`IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`](./IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md)
- [`MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md`](./MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md)
- [`.cursor/rules/multi-currency-import-fx.mdc`](../../.cursor/rules/multi-currency-import-fx.mdc)

---

## 1. Gap table (pre-W3.1 → post)

| Area | W3 assumption | Gap | W3.1 fix |
|------|---------------|-----|----------|
| Destination | Mandatory single USD/TT wallet | Agent/third-party hold & multi-recipient distribute unsupported | Routing modes + custody positions |
| GL debit | Always Dr wallet CoA | Agent hold has no company bank | Settings-mapped `importFxUsdCustodyControlAccountId` (never hardcode `1230`) |
| Distributions | None | Business routes USD to many parties | Operational distribution batches/lines (`EXECUTION_BLOCKED` for W4/W5) |
| Supplier contact | Implied settlement risk | Contact identity ≠ AP settlement | Purpose + linked purchase required; `blocks_supplier_ap = true` in W3.1 |
| Demo | Company wallet only | Incomplete ops rehearsal | Eight W3.1 scenarios, still DEMO — NOT POSTED |

**Root cause of single-wallet limitation:** W3 `post_import_fx_usd_acquisition` required `destination_wallet_account_id` / lot `wallet_account_id` and posted Dr that CoA account only—no holder/routing model.

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| **Acquisition lot** | Immutable USD acquisition event + remaining qty / PKR carrying |
| **Custody position** | Operational record of who holds FC qty + carrying (not necessarily a named bank account) |
| **Company USD/TT wallet** | Existing 12xx TT control CoA used when currency is in company-controlled wallet |
| **Distribution instruction** | Planned recipient/purpose/qty; may be blocked until W4/W5 |
| **Supplier as intermediary** | Supplier contact holds funds without invoice settlement — custody, not AP reduction |

Custody ≠ physical bank account with the holder’s name. One settings-mapped control asset + operational sub-ledger is preferred over one CoA per agent/supplier.

---

## 3. Routing modes (UI labels)

| Mode | Label | Question |
|------|-------|----------|
| `COMPANY_WALLET` | Company USD/TT Wallet | Where will the acquired USD be held or used? |
| `AGENT_CUSTODY` | Held by FX Agent | Agent holds under company instructions |
| `THIRD_PARTY_CUSTODY` | Held by Third Party | Separate custodian contact |
| `DIRECT_DISTRIBUTION` | Direct Distribution | Full amount instructed to recipients |
| `SPLIT_HOLD_AND_DISTRIBUTE` | Split: Hold Balance + Distribute | Retained + distributed = acquired |

---

## 4. Entity relationships

```
import_fx_case_usd_acquisitions (lot / event)
  ├── import_fx_case_usd_lots (immutable qty/carrying)
  ├── import_fx_case_usd_custody_positions (holder + available qty)
  └── import_fx_case_distribution_batches
        └── import_fx_case_distribution_lines (purpose, recipient, blocked flags)
```

---

## 5. Field definitions (high level)

**Acquisition:** company/branch/case, agent, routing_mode, wallet_id (nullable), holder_contact_id, gl_debit_account_id, usd qty, rate, carrying PKR, funding_type, retained/distributed qty, client_operation_id, journal_entry_id.

**Custody position:** holder_type (`COMPANY_WALLET`|`AGENT`|`THIRD_PARTY`), holder_contact_id, wallet_account_id (company only), quantity + available_quantity, PKR carrying + available, status.

**Distribution line:** recipient_contact_id, recipient_role, purpose, linked_purchase_id, instructed/executed qty, allocated PKR, status, requires_wave, review_code, **blocks_supplier_ap**.

---

## 6. State machine (distribution)

`DRAFT` → `READY` | `EXECUTION_BLOCKED` → `EXECUTED` (W4/W5 only) | `CANCELLED` | `REVERSED`

W3.1 creates lines as `EXECUTION_BLOCKED` when purpose requires W4/W5/later. Never marks supplier paid.

Operational acquisition status labels (UI): Acquired · Held by Agent · Held in Company Wallet · Held by Third Party · Distribution Planned · Partially Distributed · Requires W4 Conversion · Requires W5 Supplier Settlement · Reversed.

---

## 7. Accounting matrix (preserved W3 legs)

| Funding | Debit | Credit |
|---------|-------|--------|
| ADVANCE | USD wallet **or** custody control | Agent FX Advance Clearing |
| CREDIT | USD wallet **or** custody control | Agent AP |
| MIXED | Full carrying PKR | Clearing (applied) + Agent AP (remainder) |

Rules:
- Fee = NULL / 0
- Journal balanced in PKR
- No Phase-3 / FX P&L
- AGENT/THIRD_PARTY/SPLIT without company wallet → fail closed if custody control unset
- Path 21 unchanged

---

## 8. W3.1 vs W4 vs W5 boundary

| Action | W3.1 | Later |
|--------|------|-------|
| Acquire USD + custody routing | Yes (journal) | — |
| Operational distribution instructions | Yes (no AP settle) | — |
| USD→CNY conversion | Blocked | W4 |
| Supplier invoice settlement / AP reduce | Blocked (`Requires W5`) | W5 |
| Customer refund / expense / intercompany money | Blocked | Later waves |
| FX gain/loss | Blocked (Profile A) | Phase-3 flag |

---

## 9. Supplier-as-intermediary rule

If recipient is a supplier **and** purpose ≠ `SUPPLIER_INVOICE_SETTLEMENT` (with linked open item):
- Classify as custody / onward hold
- Show **Holding funds — supplier invoice not settled**
- `blocks_supplier_ap = true`
- Never reduce Supplier AP in W3.1

`SUPPLIER_INVOICE_SETTLEMENT` requires linked purchase and remains **Requires W5 settlement posting**.

---

## 10. Recipient-purpose matrix

| Purpose | W3.1 behavior |
|---------|----------------|
| `THIRD_PARTY_CUSTODY` | Operational instruction / hold labeling |
| `SUPPLIER_INVOICE_SETTLEMENT` | Planned; EXECUTION_BLOCKED; needs W5 |
| `SUPPLIER_ADVANCE` | Planned; EXECUTION_BLOCKED; needs W5 |
| `CONVERSION_COUNTERPARTY` | Planned; needs W4 |
| `CUSTOMER_REFUND` / `EXPENSE_PAYMENT_ON_BEHALF` / `BRANCH_OR_INTERCOMPANY_TRANSFER` | Blocked / review |
| `OTHER_REVIEW_REQUIRED` | Review required; never invent debit CoA |

---

## 11. UI flow

Buy USD → acquisition fields → **Where will the acquired USD be held or used?** → conditional wallet / agent / third party / distribution grid → accounting preview (wallet or custody control) → Confirm & Post (live) or Demo Simulate.

Settings: `agentFxAdvanceClearingAccountId` + **`importFxUsdCustodyControlAccountId`**.

---

## 12. Validation / security

- Amount/rate > 0; RMB→CNY normalize unchanged elsewhere
- Company/branch access fail-closed; Multi Currency OFF → mutations rejected
- Agent must be money_exchange (existing W3 case rules)
- Wallet company/branch USD/TT; third-party contact same company
- Allocation / split equality; supplier settlement needs linked purchase
- RPC-only writes; RLS SELECT company-scoped
- Hard idempotency via `import_fx_client_operations` + `client_operation_id`
- Lock lot/custody rows; reverse compensating JE only (no delete)
- Reverse blocked when lot/custody/distribution consumed

---

## 13. Reporting separation (design + operational stores)

| Report | Dataset |
|--------|---------|
| USD Acquisition Lots | acquisitions / lots |
| FC Custody Positions | custody_positions |
| Currency Held by Agent | holder_type=AGENT |
| Currency Held by Third Party | holder_type=THIRD_PARTY |
| Pending Distribution Instructions | batches/lines not EXECUTED |
| Remaining qty by lot | lot remaining + custody available |
| Recipient Distribution History | lines by recipient |

Do **not** mix Agent AP ledger, Supplier ledger, wallet GL, and custody operational reports by contact identity alone.

UI report screens for these datasets remain a follow-on; schema + demo cards provide the filtered datasets.

---

## 14. Migration strategy

| File | Role |
|------|------|
| `migrations/20260815150000_import_fx_case_w3_1_custody_routing.sql` | Additive columns + custody/distribution tables + RLS |
| `migrations/20260815150100_import_fx_case_w3_1_custody_rpcs.sql` | Capability `w3.1`, custody control helpers, `post_import_fx_usd_acquisition_with_routing` |
| `migrations/20260815150200_import_fx_case_w3_1_reverse_custody.sql` | Reverse uses `gl_debit_account_id`; custody/distribution consumption guards |

Never rewrite already-applied W3 migrations. **Do not apply to remote/prod in this task.**

---

## 15. Acceptance scenarios

1. USD 50k held by agent  
2. USD 50k company wallet  
3. USD 50k third party  
4. Split 10k + 8k + 5k + 27k retained  
5. Supplier intermediary — no AP reduction  
6. Over-allocation rejected  
7. Duplicate `client_operation_id` replay  
8. Reverse blocked after downstream consumption  

Covered in demo store + unit tests; live RPC QA deferred until non-prod migration apply approved.

---

## 16. Implementation status

| Layer | Status |
|-------|--------|
| Additive SQL | Present locally |
| Service `postImportFxUsdAcquisitionWithRouting` | Wired |
| Real Buy USD UI routing fields | Wired when capability `custody_routing` |
| Demo Mode scenarios | Extended |
| Unit/static tests | `npm run test:import-fx-w3` |
| Production / VPS migrate | **Not done** (task constraint) |
| W4/W5 financial execution | **Deferred** |

---

## 17. Exact files changed (this amendment)

- `migrations/20260815150000_import_fx_case_w3_1_custody_routing.sql`
- `migrations/20260815150100_import_fx_case_w3_1_custody_rpcs.sql`
- `migrations/20260815150200_import_fx_case_w3_1_reverse_custody.sql`
- `src/app/lib/importFxCaseW31Helpers.ts` (+ `.test.ts`)
- `src/app/lib/importFxW3DemoStore.ts` (+ `.test.ts`)
- `src/app/services/importFxCaseW3Service.ts`
- `src/app/features/import-fx-case/ImportFxCaseW31RoutingFields.tsx`
- `src/app/features/import-fx-case/ImportFxCaseW3MoneyPanel.tsx`
- `src/app/features/import-fx-case/ImportFxCaseWorkspace.tsx`
- `src/app/features/import-fx-case/ImportFxW3DemoPage.tsx`
- `src/app/context/SettingsContext.tsx` / `SettingsPageNew.tsx` (custody control picker)
- `package.json` (`test:import-fx-w3`)
- This document + cross-refs listed in §18

---

## 18. Cross-references updated

- `IMPORT_FX_CASE_W3_IMPLEMENTATION_AND_QA.md`
- `IMPORT_FX_CASE_W3_AGENT_ADVANCE_USD_ACQUISITION_DESIGN.md`
- `IMPORT_FX_W3_TO_W6_MASTER_IMPLEMENTATION_PLAN.md`
- `MULTI_CURRENCY_SUPPLIER_SETTLEMENT_DATABASE_ACCOUNTING_DESIGN.md`
- `ACCOUNTING_REPORTS_INDEX.md`
- `.cursor/rules/multi-currency-import-fx.mdc`

---

## 19. Tests run and results

| Command | Result |
|---------|--------|
| `npm run test:import-fx-w3` | **PASS** — 33 tests, 0 fail (W3 helpers + W3.1 helpers + demo gate + demo store scenarios) |
| `npm run build` | **PASS** (vite production build) |

Not run in this task: remote migration apply, VPS deploy, live Confirm & Post.

---

## 20. Remaining blockers

1. Owner approval to apply W3.1 migrations on non-prod, then production.  
2. Configure `importFxUsdCustodyControlAccountId` per company before AGENT/THIRD_PARTY posts.  
3. W4 conversion + W5 supplier settlement execution (not invented here).  
4. Full dedicated custody report screens (datasets ready; UI index entry added).  
5. Live Confirm & Post smoke after migrate (P0.2) — out of scope for this local task.
