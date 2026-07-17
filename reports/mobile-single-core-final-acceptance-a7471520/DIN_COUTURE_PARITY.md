# DIN COUTURE targeted parity (HEAD a7471520)

- Company ID: `2ab65903-62a3-4bcf-bced-076b681e9b74`
- Date range: 2026-07-01 → 2026-07-17
- Basis: `official_gl` (Aging: operational)
- Branch: company-wide `null`
- Mode: read-only production RPCs

| Screen | Status | Opening | Closing | Debit | Credit | Rows | Loader |
|---|---|---:|---:|---:|---:|---:|---|
| Customer Party Ledger | **PASS** | 4488088 | 4488088 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Supplier Party Ledger | **PASS** | 5413392 | 5413392 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Worker Ledger | **PASS** | 0 | 0 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Account Ledger | **PASS** | -10000 | -10000 | 0 | 0 | 0 | `get_unified_account_ledger` |
| Roznamcha | **PASS** | 50500 | 50500 | 0 | 0 | 0 | `get_unified_cash_bank_ledger` |
| Cash Flow | **PASS** | 50500 | 50500 | 0 | 0 | 0 | `get_unified_cash_bank_ledger` |
| Trial Balance | **PASS** | — | — | 49747104 | 49747104 | 83 | `get_unified_trial_balance` |
| Operational Aging | **EXPECTED_BASIS_DIFFERENCE** | 42500 | 0 | — | — | 2 | `operational_due_amount` |
| Contact list vs customer statement closing | **EXPECTED_BASIS_DIFFERENCE** | — | — | — | — | — | `get_contact_party_gl_balances` |

Summary: PASS 7 · EXPECTED_BASIS_DIFFERENCE 2 · FAIL 0

- **Customer Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON DHARIA
- **Supplier Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON IBRAHIM
- **Worker Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON AMJID KG · unified worker GL (2010/1180); operational fallback labelled non-official in UI
- **Account Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Unified account statement; labelled legacy notice on unified error (a7471520) · clientFallbackPolicy=labelled_legacy_on_unified_error · account=1000 Cash
- **Roznamcha**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Day Book cash mode → get_unified_cash_bank_ledger
- **Cash Flow**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Same cash/bank RPC; UI must not silently fall back (a7471520)
- **Trial Balance**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON Control totals for statement family
- **Operational Aging**: Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520). Receivables+payables due_amount; not official GL closing
- **Contact list vs customer statement closing**: Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch) DHARIA
