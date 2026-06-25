# Admin Compare Center — Delta Investigation (Phase 2.9A)

**Date:** 2026-06-25  
**Status:** `PHASE 2.9A ADMIN COMPARE DELTA FIXED — continue operator browser QA before Stage 1`  
**Preview container:** `erp-frontend-preview` @ branch `feature/single-core-ledger-phase-2-9a3-preview-deploy-plan` (pre-fix build `20f72a90`)  
**Fix commit:** compare-only patch on same branch (pending redeploy approval)  
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

## Stage 1 gate

| Gate | Status |
|------|--------|
| Feature flags OFF | YES — unchanged |
| Stage 1 SQL | **Still blocked** until operator browser QA on **fixed** preview build |
| Stage 2 SQL | NOT RUN |
| Production ERP | Untouched |

**Recommendation:** Redeploy `erp-frontend-preview` with compare fix → operator re-runs Party + Pilot Batch tabs → if `9/9` PASS, proceed to interactive Stage 1 readiness review.

---

## References

- Golden constants: `src/app/lib/unifiedLedgerGoldenFixtures.ts`
- DIN CHINA `30bd8592-3384-4f34-899a-f3907e336485`, MR JALIL `fe7ec33d-fd6d-4aa6-8d21-416e383b4c93`, BL0002 branch scope in pilot matrix
- Phase 1.8 tie-out: lifetime dates null, hybrid `getCustomerLedger`
