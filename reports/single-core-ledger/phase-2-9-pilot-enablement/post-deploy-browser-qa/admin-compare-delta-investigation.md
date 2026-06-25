# Admin Compare Center — Delta Investigation (Phase 2.9A)

**Date:** 2026-06-25  
**Status:** `PHASE 2.9A STILL BLOCKED — Party/Pilot/Ledger V2 gate not passed (Cash/Bank waived)`  
**Preview container:** `erp-frontend-preview` @ branch `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan`  
**Latest compare commits:** `4880a966` … `b506773e` (economic keys, TB `official_gl`, Cash/Bank row-parity PASS semantics)  
**Flags / Stage 1 / Stage 2:** NOT RUN — unchanged  

---

## Screenshot-based issue summary (operator report)

| Tab | Symptom | Expected (Phase 1.8 / 2.8) |
|-----|---------|----------------------------|
| **Party** — MR JALIL | Old `0.00`, new `216,300.00`, FAIL | Both `216,300`, PASS |
| **Pilot Batch** | `0/9` PASS; all old balances `0.00` | `9/9` PASS |
| **Account** — 1202 WALI T/T | Old `0.00`, new `5,211,200.00` | Closing parity within tolerance |
| **Cash/Bank** | Large balance diff; same refs in Missing + Extra | Economic rows should match |
| **Trial Balance** | Large account/total diff | Known-period vs as-of scope alignment |

Common pattern: **old closing balance always `0.00`** despite rows loading; row diffs showed **blank old `referenceType`** vs new `payment` / `transfer` / `expense`; identical ref/date/amount appeared in both Missing and Extra lists.

---

## Root cause

### 1. Closing balance read wrong field (primary — Pilot Batch 0/9)

`closingBalanceFromLegacyRows` in `unifiedLedgerCompareDiff.ts` read `last.balance`, but legacy loaders (`getCustomerLedger`, `getAccountLedger`, GL RPC wrappers) populate **`running_balance`** on `AccountLedgerEntry`. Result: old closing balance was **always 0** whenever rows existed.

### 2. Row-key mismatch (false Missing/Extra)

- Old party/account compare keyed rows on `journal_entry_id` (JE-level).
- Unified RPC keys on `journalEntryLineId` (line-level).
- Same economic transaction appeared as missing on one side and extra on the other.

### 3. Reference type not mapped on old side

`legacyToCompareSummary` used `reference_type`, but legacy entries expose type as **`je_reference_type`**. UI showed blank old type vs new `payment` / `transfer`.

### 4. Pilot Batch used non-hybrid GL old engine

`PilotBatchCompareTab` and service default had `useHybridOldEngine: false`. Phase 1.8 golden tie-out used **`getCustomerLedger` hybrid** for MR JALIL. GL-only path diverges from golden methodology (balance may still have been wrong due to #1).

### 5. Asymmetric date scope

Compare UI defaulted `dateTo = today` with empty `dateFrom`. Legacy and unified paths received **partial date filters** instead of Phase 1.8 lifetime scope (both dates `null`). `normalizeCompareDateRange` now sends both `null` when From is empty; UI defaults both dates empty with operator hint.

### 6. `getCustomerArGlJournalLedger` line id gap

GL RPC rows lacked `journal_line_id` for compare keys. Mapping `journal_entry_line_id → journal_line_id` added for tie-out only (no production statement change).

---

## Fix applied (compare-only)

| File | Change |
|------|--------|
| `src/app/lib/unifiedLedgerCompareDiff.ts` | `closingBalanceFromLegacyRows` → `running_balance`; `legacyAccountRowKey` / `legacyPartyCompareRowKey` prefer `journal_line_id`; `legacyToCompareSummary` reads `je_reference_type` |
| `src/app/services/unifiedLedgerTieOutService.ts` | Uses shared diff helpers + date normalization |
| `src/app/components/admin/unified-ledger-compare/compareFilters.ts` | `normalizeCompareDateRange()` |
| `src/app/services/unifiedLedger*CompareService.ts` | Date normalization on account/cash/TB compare |
| `src/app/services/unifiedLedgerPilotBatchCompareService.ts` | Default `useHybridOldEngine: true` |
| `src/app/components/admin/unified-ledger-compare/PilotBatchCompareTab.tsx` | `useHybridOldEngine: true` |
| `src/app/services/unifiedLedgerAllCompanyTieOutService.ts` | Default hybrid true for company tie-out rows |
| `src/app/services/accountingService.ts` | `getCustomerArGlJournalLedger` maps `journal_line_id` (tie-out path only) |
| `src/app/components/admin/UnifiedLedgerTieOutPage.tsx` | Lifetime compare hint; empty default dates |

**Not changed:** production loaders, feature flags, migrations, Ledger V2 / Account Statement / TB / Roznamcha default data sources.

---

## Tests

`npm run test:unified-ledger` — **124/124 PASS** (12 new compare tests):

- `closingBalanceFromLegacyRows` / MR JALIL balance fixture
- Row-key alignment (`journal_line_id`)
- `je_reference_type` mapping
- `normalizeCompareDateRange` lifetime scope
- Pilot batch hybrid default guard
- Production loader scope guard (no compare imports in Ledger V2 main path)

`npm run build` — **PASS**

---

## Before / after (expected on preview after redeploy)

| Check | Before (20f72a90) | After (compare fix) |
|-------|-------------------|---------------------|
| Party MR JALIL old balance | `0.00` | `216,300.00` |
| Party MR JALIL pass | FAIL | PASS (within tolerance) |
| Pilot Batch | `0/9` | `9/9` (DIN CHINA MR JALIL matrix) |
| Account 1202 closing | Old `0.00` | Old matches new within tolerance |
| Row Missing/Extra noise | High (JE vs line keys) | Reduced — keys align on line id |
| Old referenceType column | Blank | Populated from `je_reference_type` |

**Verification note:** Preview container still serves pre-fix build until separately approved redeploy. Local tests + static analysis confirm fix; operator should re-run Admin Compare after preview image rebuild.

---

## Trial Balance / Cash-Bank residual risk

TB and Cash/Bank may still show **documented scope deltas** if:

- Legacy TB uses period debits/credits vs unified `asOfDate` lens
- Cash/Bank roznamcha keys differ from unified liquidity filter

These are **out of pilot-batch golden scope** (MR JALIL party 9/9). TB/Cash fixes in this pass: shared `running_balance` closing + row-key/type normalization only. Any remaining TB diff requires separate waiver doc if operator still sees mismatch post-redeploy.

---

## Stage 1 gate (Ledger V2 — Cash/Bank excluded)

| Gate | Status |
|------|--------|
| Feature flags OFF | YES — unchanged |
| Party / MR JALIL compare | **Required** — operator sign-off on fixed preview |
| Pilot Batch 9/9 | **Required** — operator sign-off on fixed preview |
| Ledger V2 browser QA | **Required** — interactive checklist (see `browser-qa-notes.md`) |
| Trial Balance compare | Use **`official_gl`** basis for GL parity |
| **Cash/Bank compare** | **Waiver — not Stage 1 blocker** (see below) |
| Stage 1 SQL | **Blocked** until core gates above signed PASS |
| Stage 2 SQL | NOT RUN |
| Production ERP | Untouched |

**Recommendation:** Operator confirms Party + Pilot Batch + Ledger V2 on preview (`312716e7+`) → open Stage 1 ops approval ticket. **Do not** block Stage 1 on Cash/Bank Admin Compare.

---

## Cash/Bank waiver — not Stage 1 blocker

| Point | Detail |
|-------|--------|
| **Pilot screen** | Stage 1 target is **Ledger Statement V2 only** — not Cash/Bank or Roznamcha |
| **Loader behavior** | Stage 1 does **not** switch any default screen loader; legacy roznamcha/cashbook paths stay in production |
| **Production screens** | Cash/Bank and Roznamcha reports remain **`roznamchaService.getRoznamcha`** |
| **Admin Compare tab** | Shadow diagnostic (`get_unified_cash_bank_ledger` + `shadowForce: true`) — compare-only, not user-facing pilot |
| **Observed delta** | Native roznamcha closing vs unified GL closing may differ (e.g. DIN CHINA ~−4.08M on All/Bank) while row parity is clean on current preview bundle |
| **Semantics** | Operational roznamcha cashbook vs unified GL liquidity ledger — **separate remediation track** |
| **Flags** | **Do not** enable Cash/Bank, Roznamcha, or any non–Ledger-V2 pilot flag in Stage 1 |
| **Future work** | [`SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md`](../../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md) |

### Operator Cash/Bank summary (2026-06-25)

- Old engine: `roznamchaService.getRoznamcha` (+ compare-only `manual_receipt` supplement when on fixed bundle)
- New engine: `get_unified_cash_bank_ledger` (`official_gl` in compare service)
- Row counts and native closings still differ; **not** treated as Ledger V2 Stage 1 failure
- Stale-bundle exports (`basis: audit_full_history`, 138 missing + 151 extra with identical RCV refs) indicate wrong JS bundle — use tunnel `localhost:3002 → VPS :3003` and hard refresh; expect `basis: official_gl` and `buildCommit` ≥ `312716e7` in export

---

## Stage 1 gate (historical — pre-waiver)

| Gate | Status |
|------|--------|
| Feature flags OFF | YES — unchanged |
| Stage 1 SQL | **Still blocked** until operator browser QA on **fixed** preview build |
| Stage 2 SQL | NOT RUN |
| Production ERP | Untouched |

**Recommendation (superseded):** Redeploy `erp-frontend-preview` with compare fix → operator re-runs Party + Pilot Batch tabs → if `9/9` PASS, proceed to interactive Stage 1 readiness review.

### Redeploy executed (2026-06-25T15:05Z)

- Preview @ **`5b520cef`** on VPS **:3003**
- Bundle strings: all **FOUND**
- DIN CHINA `unified_ledger%` flags: **0 rows / OFF**
- Evidence: [`compare-fix-redeploy-notes.md`](compare-fix-redeploy-notes.md), [`admin-compare-delta-after.json`](admin-compare-delta-after.json)

---

## Appendix — Operator exports 2026-06-25 (Cash/Bank + TB JSON)

### Cash/Bank (`phase2-compare-cashbank-*.json`)

| Field | Value |
|-------|-------|
| Scope | DIN CHINA branch `92f4184e…`, `2025-12-01` → `2026-06-25`, `effective_party` |
| Old closing | -7,752,614 |
| New closing | -8,540,887 |
| Difference | 788,273 (real, not key noise) |
| Row diff | 195 missing + 216 extra, **0 amount mismatches** |

**Diagnosis:** 194/195 missing rows have an exact economic twin in extra (same `journalEntryId`, date, debit, credit). Root cause: roznamcha keyed on entity id (`pay:…`) while unified keyed on `journalEntryLineId`. **Fix:** compare mappers now key both sides on `journalEntryId` when present (`4880a966+`).

After fix: expect ~195 matched rows; ~21 extra unified-only rows may remain (basis/liquidity); closing diff ~788k may shrink but not necessarily zero.

### Trial Balance (`phase2-compare-tb-*.json`)

| Field | Value |
|-------|-------|
| Scope | Same branch, `2025-12-01` → `2026-06-25`, `effective_party` |
| Old totals | D 124.8M / C 124.8M (balanced period slice) |
| New totals | D 390.5M / C 390.5M (cumulative as-of) |
| Account diffs | 33 mismatches + 6 extra_in_new |

**Diagnosis (two stacked issues):**

1. **Period vs as-of:** Legacy `getTrialBalance` summed only Dec 2025–Jun 2026 activity; unified RPC sums **all lines through as-of 2026-06-25**. Compare service now loads legacy from `1900-01-01` → as-of to match unified semantics.

2. **Basis asymmetry:** Legacy TB is always **official GL**; unified ran with **`effective_party`** (hides voided/correction rows). MR JALIL `AR-FE7EC3`: old -1,900,000 (period credit-normal) vs new +216,300 (effective cumulative) — not a party-tab bug; different lens + scope.

**Operator guidance:** Re-run TB compare with **`official_gl`** basis after preview redeploy. Residual AR subledger presentation deltas may still warrant waiver (legacy flat TB vs unified party-effective).

---

## References

- Golden constants: `src/app/lib/unifiedLedgerGoldenFixtures.ts`
- DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485`, MR JALIL `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93`, BL0002 branch scope in pilot matrix
- Phase 1.8 tie-out: lifetime dates null, hybrid `getCustomerLedger`
- Cash/Bank waiver plan: [`SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md`](../../../../docs/accounting/SINGLE_CORE_LEDGER_PHASE_2_9A_CB_CASH_BANK_PARITY_PLAN.md)

---

## Phase 2.9A-6 — Ledger V2 Stage 1 gate confirmation (2026-06-25)

**Evidence:** [`phase-2.9a-6-gate-confirmation.json`](phase-2.9a-6-gate-confirmation.json), [`browser-qa-notes.md`](browser-qa-notes.md)

| Gate | Result | Notes |
|------|--------|-------|
| 1 Party / MR JALIL | **OPEN** | Browser Admin Compare required; RPC read-only **216,300 PASS** |
| 2 Pilot Batch 9/9 | **OPEN** | Operator run on preview `312716e7+` |
| 3 Ledger V2 browser QA | **OPEN** | `QA_BROWSER_PASSWORD` + `run-phase-29a4-browser-qa.mjs` |
| 4 Flags OFF | **PASS** | 0 rows `unified_ledger%` |
| Cash/Bank | **WAIVED** | Not Stage 1 blocker → Phase 2.9A-CB |

**Stage 1 SQL (when approved):** enables **`unified_ledger_pilot` only** — not `unified_ledger_engine` or `unified_ledger_screen_ledger_v2` (those are Stage 2 per pilot plan §7).

**Sign-off:** `PHASE 2.9A STILL BLOCKED — Party/Pilot/Ledger V2 gate not passed (Cash/Bank waived)`

### Phase 2.9A-7 operator browser sign-off (2026-06-25)

**Evidence:** [`phase-2.9a-7-gate-signoff.json`](phase-2.9a-7-gate-signoff.json)

| Gate | Result |
|------|--------|
| 1 Party / MR JALIL | **SKIP** — `QA_BROWSER_PASSWORD` required |
| 2 Pilot Batch 9/9 | **SKIP** |
| 3 Ledger V2 | **SKIP** |
| 4 Flags OFF | **PASS** |

**Script:** `scripts/single-core-ledger/run-phase-29a7-operator-gate-signoff.mjs`
