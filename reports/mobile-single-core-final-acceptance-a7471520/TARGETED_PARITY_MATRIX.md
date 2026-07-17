# TARGETED_PARITY_MATRIX.md

Generated: 2026-07-17T18:30:54.693Z
Product HEAD: `a7471520`

Method: read-only production Postgres unified / operational queries via `ssh dincouture-vps`.
Targeted for engineering-completion product changes (Account Ledger fail-loud, Aging fail-loud, Party/Worker/Roznamcha/Cash Flow/TB).

## Company summaries

- **DIN CHINA**: PASS 6, EXPECTED_BASIS_DIFFERENCE 3, FAIL 0
- **DIN BRIDAL**: PASS 6, EXPECTED_BASIS_DIFFERENCE 3, FAIL 0
- **DIN COUTURE**: PASS 7, EXPECTED_BASIS_DIFFERENCE 2, FAIL 0

## Detail

### DIN CHINA — Customer Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: HASSAN   MARDAN
- Payload: `{"opening":3909458,"closing":3709458,"rows":1,"debit":0,"credit":200000,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"ed1abdc6-a701-488b-8a92-8efd1f9750a3","name":"HASSAN   MARDAN","listBalance":3709458}}`

### DIN CHINA — Supplier Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: MR DIN MOHAMMAD
- Payload: `{"opening":1140287.4,"closing":1140286.4,"rows":1,"debit":1,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"36fe85d7-95cf-49ad-8922-cabe5f3596cc","name":"MR DIN MOHAMMAD","listBalance":1140286.4}}`

### DIN CHINA — Worker Ledger
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Company has no workers — Worker Ledger N/A (not a loader defect)
- Notes:  · unified worker GL (2010/1180); operational fallback labelled non-official in UI
- Payload: `{"loader":"get_unified_party_ledger","basis":"official_gl","rows":0,"opening":0,"closing":0,"debit":0,"credit":0,"emptyCompany":true,"party":{"error":"no_worker","emptyCompany":true}}`

### DIN CHINA — Account Ledger
- Status: **PASS**
- Loaders: `get_unified_account_ledger` / `get_unified_account_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Unified account statement; labelled legacy notice on unified error (a7471520) · clientFallbackPolicy=labelled_legacy_on_unified_error · account=1000 Cash
- Payload: `{"opening":0,"closing":0,"rows":0,"debit":0,"credit":0,"loader":"get_unified_account_ledger","basis":"official_gl","clientFallbackPolicy":"labelled_legacy_on_unified_error","account":{"id":"0c6e4169-ed17-45bb-b3ec-1b0664057267","code":"1000","name":"Cash"}}`

### DIN CHINA — Roznamcha
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Day Book cash mode → get_unified_cash_bank_ledger
- Payload: `{"opening":10138342,"closing":9944818,"rows":11,"debit":1111000,"credit":1304524,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","clientFallbackPolicy":"no_silent_legacy"}`

### DIN CHINA — Cash Flow
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Same cash/bank RPC; UI must not silently fall back (a7471520)
- Payload: `{"opening":10138342,"closing":9944818,"rows":11,"debit":1111000,"credit":1304524,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","clientFallbackPolicy":"no_silent_legacy"}`

### DIN CHINA — Trial Balance
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Control totals for statement family
- Payload: `{"totalDebit":394526434.15,"totalCredit":394526434.15,"difference":0,"accounts":57,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN CHINA — Operational Aging
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `operational_due_amount` / `operational_due_amount`
- Basis: operational_due_amount
- Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520).
- Notes: Receivables+payables due_amount; not official GL closing
- Payload: `{"loader":"operational_due_amount","basis":"operational_due_amount","receivablesCount":56,"receivablesTotal":16068815.98,"payablesCount":2,"payablesTotal":1140477.4,"clientErrorPolicy":"fail_loud_on_query_error"}`

### DIN CHINA — Contact list vs customer statement closing
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch)
- Notes: HASSAN   MARDAN
- Payload: `{"loader":"get_contact_party_gl_balances","basis":"official_gl"}`

### DIN BRIDAL — Customer Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: MR REHAN ALI
- Payload: `{"opening":530000,"closing":530000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"cee98d04-0a04-4692-857c-18df75bcb466","name":"MR REHAN ALI","listBalance":530000}}`

### DIN BRIDAL — Supplier Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: ASIF PINDI
- Payload: `{"opening":-310000,"closing":-310000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"420172a2-342d-44fa-bf99-c5ef104ffdec","name":"ASIF PINDI","listBalance":-310000}}`

### DIN BRIDAL — Worker Ledger
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Company has no workers — Worker Ledger N/A (not a loader defect)
- Notes:  · unified worker GL (2010/1180); operational fallback labelled non-official in UI
- Payload: `{"loader":"get_unified_party_ledger","basis":"official_gl","rows":0,"opening":0,"closing":0,"debit":0,"credit":0,"emptyCompany":true,"party":{"error":"no_worker","emptyCompany":true}}`

### DIN BRIDAL — Account Ledger
- Status: **PASS**
- Loaders: `get_unified_account_ledger` / `get_unified_account_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Unified account statement; labelled legacy notice on unified error (a7471520) · clientFallbackPolicy=labelled_legacy_on_unified_error · account=1000 Cash
- Payload: `{"opening":-2000,"closing":-2000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_account_ledger","basis":"official_gl","clientFallbackPolicy":"labelled_legacy_on_unified_error","account":{"id":"75695b61-c0eb-4c9b-84bb-d0e77551d37e","code":"1000","name":"Cash"}}`

### DIN BRIDAL — Roznamcha
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Day Book cash mode → get_unified_cash_bank_ledger
- Payload: `{"opening":1522823,"closing":556243,"rows":15,"debit":108500,"credit":1075080,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","clientFallbackPolicy":"no_silent_legacy"}`

### DIN BRIDAL — Cash Flow
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Same cash/bank RPC; UI must not silently fall back (a7471520)
- Payload: `{"opening":1522823,"closing":556243,"rows":15,"debit":108500,"credit":1075080,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","clientFallbackPolicy":"no_silent_legacy"}`

### DIN BRIDAL — Trial Balance
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Control totals for statement family
- Payload: `{"totalDebit":26952083,"totalCredit":26952083,"difference":0,"accounts":125,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN BRIDAL — Operational Aging
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `operational_due_amount` / `operational_due_amount`
- Basis: operational_due_amount
- Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520).
- Notes: Receivables+payables due_amount; not official GL closing
- Payload: `{"loader":"operational_due_amount","basis":"operational_due_amount","receivablesCount":14,"receivablesTotal":968200,"payablesCount":0,"payablesTotal":0,"clientErrorPolicy":"fail_loud_on_query_error"}`

### DIN BRIDAL — Contact list vs customer statement closing
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch)
- Notes: MR REHAN ALI
- Payload: `{"loader":"get_contact_party_gl_balances","basis":"official_gl"}`

### DIN COUTURE — Customer Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: DHARIA
- Payload: `{"opening":4488088,"closing":4488088,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"04831980-546b-4ff2-bc9d-2e75a43eb51c","name":"DHARIA","listBalance":4488088}}`

### DIN COUTURE — Supplier Party Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: IBRAHIM
- Payload: `{"opening":5413392,"closing":5413392,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"6a64814f-d472-4e2d-9db7-285eb8f14a32","name":"IBRAHIM","listBalance":5413392}}`

### DIN COUTURE — Worker Ledger
- Status: **PASS**
- Loaders: `get_unified_party_ledger` / `get_unified_party_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: AMJID KG · unified worker GL (2010/1180); operational fallback labelled non-official in UI
- Payload: `{"opening":0,"closing":0,"rows":0,"debit":0,"credit":0,"loader":"get_unified_party_ledger","basis":"official_gl","party":{"id":"650f310d-058f-4d2f-8ece-13ac715b2574","name":"AMJID KG"}}`

### DIN COUTURE — Account Ledger
- Status: **PASS**
- Loaders: `get_unified_account_ledger` / `get_unified_account_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Unified account statement; labelled legacy notice on unified error (a7471520) · clientFallbackPolicy=labelled_legacy_on_unified_error · account=1000 Cash
- Payload: `{"opening":-10000,"closing":-10000,"rows":0,"debit":0,"credit":0,"loader":"get_unified_account_ledger","basis":"official_gl","clientFallbackPolicy":"labelled_legacy_on_unified_error","account":{"id":"9c6e4ab8-f3cd-4780-ab3b-b7145d468ca2","code":"1000","name":"Cash"}}`

### DIN COUTURE — Roznamcha
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Day Book cash mode → get_unified_cash_bank_ledger
- Payload: `{"opening":50500,"closing":50500,"rows":0,"debit":0,"credit":0,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","clientFallbackPolicy":"no_silent_legacy"}`

### DIN COUTURE — Cash Flow
- Status: **PASS**
- Loaders: `get_unified_cash_bank_ledger` / `get_unified_cash_bank_ledger`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Same cash/bank RPC; UI must not silently fall back (a7471520)
- Payload: `{"opening":50500,"closing":50500,"rows":0,"debit":0,"credit":0,"loader":"get_unified_cash_bank_ledger","basis":"official_gl","clientFallbackPolicy":"no_silent_legacy"}`

### DIN COUTURE — Trial Balance
- Status: **PASS**
- Loaders: `get_unified_trial_balance` / `get_unified_trial_balance`
- Basis: official_gl
- Numeric difference: 0
- Same production unified RPC used by web main loaders and mobile Single Core adapter when flags ON
- Notes: Control totals for statement family
- Payload: `{"totalDebit":49747104,"totalCredit":49747104,"difference":0,"accounts":83,"loader":"get_unified_trial_balance","basis":"official_gl"}`

### DIN COUTURE — Operational Aging
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `operational_due_amount` / `operational_due_amount`
- Basis: operational_due_amount
- Aging uses operational due_amount (not official GL). Client fail-loud on query/RLS error (a7471520).
- Notes: Receivables+payables due_amount; not official GL closing
- Payload: `{"loader":"operational_due_amount","basis":"operational_due_amount","receivablesCount":2,"receivablesTotal":42500,"payablesCount":0,"payablesTotal":0,"clientErrorPolicy":"fail_loud_on_query_error"}`

### DIN COUTURE — Contact list vs customer statement closing
- Status: **EXPECTED_BASIS_DIFFERENCE**
- Loaders: `get_contact_party_gl_balances` / `get_contact_party_gl_balances`
- Basis: official_gl
- Numeric difference: 0
- Contact list is as-of GL; Party Ledger closing is period-scoped (company-wide null branch)
- Notes: DHARIA
- Payload: `{"loader":"get_contact_party_gl_balances","basis":"official_gl"}`
