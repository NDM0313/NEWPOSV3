# DIN BRIDAL parity

- Company ID: `597a5292-14c8-4cd8-96bd-c61b5a0d8c92`
- Date range: 2026-07-01 → 2026-07-17 (Asia/Karachi calendar dates)
- Basis: `official_gl`
- Branch: company-wide `null`
- Mode: read-only production unified RPCs (web ≡ mobile Single Core contract)

| Screen | Status | Opening/AR | Closing/AP | Debit/TB Dr | Credit/TB Cr | Rows | Loader |
|---|---|---:|---:|---:|---:|---:|---|
| Customer Party Ledger | **PASS** | 530000 | 530000 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Supplier Party Ledger | **PASS** | -310000 | -310000 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Worker Ledger | **EXPECTED_BASIS_DIFFERENCE** | 0 | 0 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Roznamcha | **PASS** | 1522823 | 556243 | 108500 | 1075080 | 15 | `get_unified_cash_bank_ledger` |
| Cash Flow | **PASS** | 1522823 | 556243 | 108500 | 1075080 | 15 | `get_unified_cash_bank_ledger` |
| Trial Balance | **PASS** | — | — | 26952083 | 26952083 | 125 | `get_unified_trial_balance` |
| Dashboard/contact GL totals | **PASS** | 2044800 | -547191 | — | — | — | `get_contact_party_gl_balances` |
| Contact list vs customer statement closing | **EXPECTED_BASIS_DIFFERENCE** | 2044800 | -547191 | — | — | — | `get_contact_party_gl_balances` |
| Operational Aging | **EXPECTED_BASIS_DIFFERENCE** | — | — | — | — | — | `operational_due_amount` |
| Genuine zero/no-activity customer | **PASS** | 15000 | 15000 | 0 | 0 | 0 | `get_unified_party_ledger` |
| Account Ledger / Ledger V2 / BS / PL (control) | **PASS** | — | — | 26952083 | 26952083 | 125 | `get_unified_trial_balance` |

Summary: PASS 8 · EXPECTED_BASIS_DIFFERENCE 3 · FAIL 0

- **Customer Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON MR REHAN ALI
- **Supplier Party Ledger**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON ASIF PINDI
- **Worker Ledger**: Company has no workers table rows — Worker Ledger N/A (not a loader defect)  · unified worker GL contract (2010/1180)
- **Roznamcha**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON UI: Day Book cash mode → get_unified_cash_bank_ledger
- **Cash Flow**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON UI: Cash Flow → same cash/bank RPC; distinct presentation
- **Trial Balance**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- **Dashboard/contact GL totals**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- **Contact list vs customer statement closing**: Contact list is as-of GL; Party Ledger closing is period-scoped (same company-wide null branch) MR REHAN ALI
- **Operational Aging**: Aging uses operational due_amount; not official GL closing
- **Genuine zero/no-activity customer**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- **Account Ledger / Ledger V2 / BS / PL (control)**: Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON TB control total validates unified engine for statement family; UI screens share flags
