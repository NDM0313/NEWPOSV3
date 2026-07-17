# DIN BRIDAL targeted parity (HEAD a7471520)

- Company ID: `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`
- Date range: 2026-07-01 → 2026-07-17
- Basis: `official_gl` (Aging: operational)
- Branch: company-wide `null`
- Mode: read-only production RPCs

| Screen | Status | Opening | Closing | Debit | Credit | Rows | Loader |
|---|---|---:|---:|---:|---:|---:|---|
| Customer Party Ledger | **PASS** | 530000 | 530000 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Supplier Party Ledger | **PASS** | -310000 | -310000 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Worker Ledger | **EXPECTED_BASIS_DIFFERENCE** | 0 | 0 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Account Ledger | **PASS** | -2000 | -2000 | 0 | 0 | 0 | `get_unified_account_ledger` |
| Roznamcha | **PASS** | 1522823 | 556243 | 108500 | 1075080 | 15 | `get_unified_cash_bank_ledger` |
| Cash Flow | **PASS** | 1522823 | 556243 | 108500 | 1075080 | 15 | `get_unified_cash_bank_ledger` |
| Trial Balance | **PASS** | — | — | 26952083 | 26952083 | 125 | `get_unified_trial_balance` |
| Operational Aging | **EXPECTED_BASIS_DIFFERENCE** | 968200 | 0 | — | — | 14 | `operational_due_amount` |
| Contact list vs customer statement closing | **EXPECTED_BASIS_DIFFERENCE** | — | — | — | — | — | `get_contact_party_gl_balances` |

Summary: PASS 6 · EXPECTED_BASIS_DIFFERENCE 3 · FAIL 0

- **Customer Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON MR REHAN ALI
- **Supplier Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON ASIF PINDI
- **Worker Ledger**: Company has no workers — Worker Ledger N/A (not a loader defect)  · unified worker GL (2010/1180); operational fallback labelled non-official in UI
- **Account Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Unified account statement; labelled legacy notice on unified error (a7471520) · clientFallbackPolicy=labelled_legacy_on_unified_error · account=1000 Cash
- **Roznamcha**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Day Book cash mode → get_unified_cash_bank_ledger
- **Cash Flow**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Same cash/bank RPC; UI must not silently fall back (a7471520)
- **Trial Balance**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Control totals for statement family
- **Operational Aging**: Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520). Receivables+payables due_amount; not official GL closing
- **Contact list vs customer statement closing**: Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch) MR REHAN ALI
