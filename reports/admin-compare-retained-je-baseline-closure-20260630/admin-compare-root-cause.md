# Admin Compare root cause

**Classification:** `LEGACY_FALLBACK_MISSING_PARTY_DISCOUNT`

## Code path

1. Admin Compare **Pilot Batch** (`PilotBatchCompareTab`) runs `runDinChinaPilotBatchCompare` with `useHybridOldEngine: true`.
2. Each row calls `comparePartyLedgerTieOut` → `loadLegacyPartyLedgerForTieOut` → **`getCustomerLedger` (hybrid)** vs **`getUnifiedPartyLedger`**.
3. Pass/fail: `|oldBalance - newBalance| <= 0.01` per row (`unifiedLedgerAllCompanyTieOutService.ts`).

## Why legacy showed 216300

`getCustomerLedger` filters AR journal lines via `arJournalLineMatchesCustomer`. That matcher handled sale, payment, rental, opening balance, etc., but **not** `party_discount`.

JE-0003 posts with `reference_type: party_discount`, `reference_id: contactId` (MR JALIL). The Cr AR line was excluded from the hybrid ledger → closing stayed **216300**. Unified RPC correctly returns **216299**.

## Not the cause

- **GOLDEN_CONSTANT_STALE** — frontend already deployed with 216299.
- **MONITORING_COMPARE_RULE_STALE** — rule is correct; legacy data path was incomplete.
- **REAL_REGRESSION** — intentional retained QA JE; legacy path lagged feature.
