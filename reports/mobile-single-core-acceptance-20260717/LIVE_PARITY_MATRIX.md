# LIVE_PARITY_MATRIX.md

Generated: 2026-07-17T12:08:52.671Z

Method: read-only production Postgres unified RPCs via `ssh dincouture-vps`.
When flags ON, web main loaders and mobile Single Core adapter call the same RPCs — numeric identity is the contract under test.

## Company summaries

- **DIN CHINA**: PASS 8, EXPECTED_BASIS_DIFFERENCE 3, FAIL 0
- **DIN BRIDAL**: PASS 8, EXPECTED_BASIS_DIFFERENCE 3, FAIL 0
- **DIN COUTURE**: PASS 9, EXPECTED_BASIS_DIFFERENCE 2, FAIL 0

## Detail

### DIN CHINA — Customer Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":3909458,"closing":3709458,"rows":1,"debit":0,"credit":200000,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"ed1abdc6-a701-488b-8a92-8efd1f9750a3","name":"HASSAN   MARDAN","listBalance":3709458}}`

### DIN CHINA — Supplier Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":1140287.4,"closing":1140286.4,"rows":1,"debit":1,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"36fe85d7-95cf-49ad-8922-cabe5f3596cc","name":"MR DIN MOHAMMAD","listBalance":1140286.4}}`

### DIN CHINA — Worker Ledger
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Company has no workers table rows — Worker Ledger N/A (not a loader defect)
- Payload: `{"loader":"get_unified_party_ledger","basis":"official_gl","rows":0,"opening":0,"closing":0,"debit":0,"credit":0,"emptyCompany":true,"party":{"error":"no_worker","emptyCompany":true}}`

### DIN CHINA — Roznamcha
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":10138342,"closing":9944818,"rows":11,"debit":1111000,"credit":1304524,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","liquidityAccounts":13}`

### DIN CHINA — Cash Flow
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":10138342,"closing":9944818,"rows":11,"debit":1111000,"credit":1304524,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","liquidityAccounts":13}`

### DIN CHINA — Trial Balance
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"totalDebit":394526434.15,"totalCredit":394526434.15,"difference":0,"accounts":57,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN CHINA — Dashboard/contact GL totals
- Status: **PASS**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"ar":13025647.98,"ap":1140286.4,"wp":0,"loader":"get_contact_party_gl_balances"}`

### DIN CHINA — Contact list vs customer statement closing
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Contact list is as-of GL; Party Ledger closing is period-scoped (same company-wide null branch)
- Payload: `{"ar":13025647.98,"ap":1140286.4,"wp":0,"loader":"get_contact_party_gl_balances"}`

### DIN CHINA — Operational Aging
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `operational_due_amount` / `operational_due_amount`
- Basis: official_gl
- Aging uses operational due_amount; not official GL closing
- Payload: `{"loader":"operational_due_amount"}`

### DIN CHINA — Genuine zero/no-activity customer
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":1319586,"closing":1319586,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"26f8df5e-d847-47b2-845a-a6d983c2b2e9","name":"AHMED   ZEB"}}`

### DIN CHINA — Account Ledger / Ledger V2 / BS / PL (control)
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"totalDebit":394526434.15,"totalCredit":394526434.15,"difference":0,"accounts":57,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN BRIDAL — Customer Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":530000,"closing":530000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"cee98d04-0a04-4692-857c-18df75bcb466","name":"MR REHAN ALI","listBalance":530000}}`

### DIN BRIDAL — Supplier Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":-310000,"closing":-310000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"420172a2-342d-44fa-bf99-c5ef104ffdec","name":"ASIF PINDI","listBalance":-310000}}`

### DIN BRIDAL — Worker Ledger
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Company has no workers table rows — Worker Ledger N/A (not a loader defect)
- Payload: `{"loader":"get_unified_party_ledger","basis":"official_gl","rows":0,"opening":0,"closing":0,"debit":0,"credit":0,"emptyCompany":true,"party":{"error":"no_worker","emptyCompany":true}}`

### DIN BRIDAL — Roznamcha
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":1522823,"closing":556243,"rows":15,"debit":108500,"credit":1075080,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","liquidityAccounts":14}`

### DIN BRIDAL — Cash Flow
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":1522823,"closing":556243,"rows":15,"debit":108500,"credit":1075080,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","liquidityAccounts":14}`

### DIN BRIDAL — Trial Balance
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"totalDebit":26952083,"totalCredit":26952083,"difference":0,"accounts":125,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN BRIDAL — Dashboard/contact GL totals
- Status: **PASS**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"ar":2044800,"ap":-547191,"wp":0,"loader":"get_contact_party_gl_balances"}`

### DIN BRIDAL — Contact list vs customer statement closing
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Contact list is as-of GL; Party Ledger closing is period-scoped (same company-wide null branch)
- Payload: `{"ar":2044800,"ap":-547191,"wp":0,"loader":"get_contact_party_gl_balances"}`

### DIN BRIDAL — Operational Aging
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `operational_due_amount` / `operational_due_amount`
- Basis: official_gl
- Aging uses operational due_amount; not official GL closing
- Payload: `{"loader":"operational_due_amount"}`

### DIN BRIDAL — Genuine zero/no-activity customer
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":15000,"closing":15000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"6efb2d99-6d50-4dea-b486-7f82285f7127","name":"Adnan N41"}}`

### DIN BRIDAL — Account Ledger / Ledger V2 / BS / PL (control)
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"totalDebit":26952083,"totalCredit":26952083,"difference":0,"accounts":125,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN COUTURE — Customer Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":4488088,"closing":4488088,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"04831980-546b-4ff2-bc9d-2e75a43eb51c","name":"DHARIA","listBalance":4488088}}`

### DIN COUTURE — Supplier Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":5413392,"closing":5413392,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"6a64814f-d472-4e2d-9db7-285eb8f14a32","name":"IBRAHIM","listBalance":5413392}}`

### DIN COUTURE — Worker Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":0,"closing":0,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"650f310d-058f-4d2f-8ece-13ac715b2574","name":"AMJID KG"}}`

### DIN COUTURE — Roznamcha
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":50500,"closing":50500,"rows":0,"debit":0,"credit":0,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","liquidityAccounts":9}`

### DIN COUTURE — Cash Flow
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":50500,"closing":50500,"rows":0,"debit":0,"credit":0,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","liquidityAccounts":9}`

### DIN COUTURE — Trial Balance
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"totalDebit":49747104,"totalCredit":49747104,"difference":0,"accounts":83,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN COUTURE — Dashboard/contact GL totals
- Status: **PASS**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"ar":22625273,"ap":26908831,"wp":0,"loader":"get_contact_party_gl_balances"}`

### DIN COUTURE — Contact list vs customer statement closing
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Contact list is as-of GL; Party Ledger closing is period-scoped (same company-wide null branch)
- Payload: `{"ar":22625273,"ap":26908831,"wp":0,"loader":"get_contact_party_gl_balances"}`

### DIN COUTURE — Operational Aging
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `operational_due_amount` / `operational_due_amount`
- Basis: official_gl
- Aging uses operational due_amount; not official GL closing
- Payload: `{"loader":"operational_due_amount"}`

### DIN COUTURE — Genuine zero/no-activity customer
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"opening":1384000,"closing":1384000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"d35a37f9-7029-4550-b899-b7156e39b940","name":"1850 VANI WHOLESALE"}}`

### DIN COUTURE — Account Ledger / Ledger V2 / BS / PL (control)
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Payload: `{"totalDebit":49747104,"totalCredit":49747104,"difference":0,"accounts":83,"loader":"get_unified_trial_balance","basis":"official_gl"}`
