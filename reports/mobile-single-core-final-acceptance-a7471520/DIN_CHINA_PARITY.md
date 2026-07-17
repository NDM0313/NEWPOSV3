# DIN CHINA targeted parity (HEAD a7471520)

- Company ID: `30bd8592-3384-4f34-899a-f3907e336485`
- Date range: 2026-07-01 → 2026-07-17
- Basis: `official_gl` (Aging: operational)
- Branch: company-wide `null`
- Mode: read-only production RPCs

| Screen | Status | Opening | Closing | Debit | Credit | Rows | Loader |
|---|---|---:|---:|---:|---:|---:|---|
| Customer Party Ledger | **PASS** | 3909458 | 3709458 | 0 | 200000 | 1 | `get_unified_party_ledger` |
| Supplier Party Ledger | **PASS** | 1140287.4 | 1140286.4 | 1 | 0 | 1 | `get_unified_party_ledger` |
| Worker Ledger | **EXPECTED_BASIS_DIFFERENCE** | 0 | 0 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Account Ledger | **PASS** | 0 | 0 | 0 | 0 | 0 | `get_unified_account_ledger` |
| Roznamcha | **PASS** | 10138342 | 9944818 | 1111000 | 1304524 | 11 | `get_unified_cash_bank_ledger` |
| Cash Flow | **PASS** | 10138342 | 9944818 | 1111000 | 1304524 | 11 | `get_unified_cash_bank_ledger` |
| Trial Balance | **PASS** | — | — | 394526434.15 | 394526434.15 | 57 | `get_unified_trial_balance` |
| Operational Aging | **EXPECTED_BASIS_DIFFERENCE** | 16068815.98 | 1140477.4 | — | — | 56 | `operational_due_amount` |
| Contact list vs customer statement closing | **EXPECTED_BASIS_DIFFERENCE** | — | — | — | — | — | `get_contact_party_gl_balances` |

Summary: PASS 6 · EXPECTED_BASIS_DIFFERENCE 3 · FAIL 0

- **Customer Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON HASSAN   MARDAN
- **Supplier Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON MR DIN MOHAMMAD
- **Worker Ledger**: Company has no workers — Worker Ledger N/A (not a loader defect)  · unified worker GL (2010/1180); operational fallback labelled non-official in UI
- **Account Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Unified account statement; labelled legacy notice on unified error (a7471520) · clientFallbackPolicy=labelled_legacy_on_unified_error · account=1000 Cash
- **Roznamcha**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Day Book cash mode → get_unified_cash_bank_ledger
- **Cash Flow**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Same cash/bank RPC; UI must not silently fall back (a7471520)
- **Trial Balance**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Control totals for statement family
- **Operational Aging**: Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520). Receivables+payables due_amount; not official GL closing
- **Contact list vs customer statement closing**: Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch) HASSAN   MARDAN
