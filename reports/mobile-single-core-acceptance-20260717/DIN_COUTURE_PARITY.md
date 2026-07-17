# DIN COUTURE parity

- Company ID: `2ab65903-62a3-4bcf-bced-076b681e9b74`
- Date range: 2026-07-01 → 2026-07-17 (Asia/Karachi calendar dates)
- Basis: `official_gl`
- Branch: company-wide `null`
- Mode: read-only production unified RPCs (web ≡ mobile Single Core contract)

| Screen | Status | Opening/AR | Closing/AP | Debit/TB Dr | Credit/TB Cr | Rows | Loader |
|---|---|---:|---:|---:|---:|---:|---|
| Customer Party Ledger | **PASS** | 4488088 | 4488088 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Supplier Party Ledger | **PASS** | 5413392 | 5413392 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Worker Ledger | **PASS** | 0 | 0 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Roznamcha | **PASS** | 50500 | 50500 | 0 | 0 | 0 | `get_unified_cash_bank_ledger` |
| Cash Flow | **PASS** | 50500 | 50500 | 0 | 0 | 0 | `get_unified_cash_bank_ledger` |
| Trial Balance | **PASS** | — | — | 49747104 | 49747104 | 83 | `get_unified_trial_balance` |
| Dashboard/contact GL totals | **PASS** | 22625273 | 26908831 | — | — | — | `get_contact_party_gl_balances` |
| Contact list vs customer statement closing | **EXPECTED_BASIS_DIFFERENCE** | 22625273 | 26908831 | — | — | — | `get_contact_party_gl_balances` |
| Operational Aging | **EXPECTED_BASIS_DIFFERENCE** | — | — | — | — | — | `operational_due_amount` |
| Genuine zero/no-activity customer | **PASS** | 1384000 | 1384000 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Account Ledger / Ledger V2 / BS / PL (control) | **PASS** | — | — | 49747104 | 49747104 | 83 | `get_unified_trial_balance` |

Summary: PASS 9 · EXPECTED_BASIS_DIFFERENCE 2 · FAIL 0

- **Customer Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON DHARIA
- **Supplier Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON IBRAHIM
- **Worker Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON AMJID KG · unified worker GL contract (2010/1180)
- **Roznamcha**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON UI: Day Book cash mode → get_unified_cash_bank_ledger
- **Cash Flow**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON UI: Cash Flow → same cash/bank RPC; distinct presentation
- **Trial Balance**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- **Dashboard/contact GL totals**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- **Contact list vs customer statement closing**: Contact list is as-of GL; Party Ledger closing is period-scoped (same company-wide null branch) DHARIA
- **Operational Aging**: Aging uses operational due_amount; not official GL closing
- **Genuine zero/no-activity customer**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- **Account Ledger / Ledger V2 / BS / PL (control)**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON TB control total validates unified engine for statement family; UI screens share flags
