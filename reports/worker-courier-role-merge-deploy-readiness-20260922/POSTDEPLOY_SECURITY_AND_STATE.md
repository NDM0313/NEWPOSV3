# Post-deploy security catalog & business-state (READ ONLY)

## Installed functions

| Function | Security | PUBLIC/anon EXECUTE | authenticated | service_role | Company gate in body |
|----------|----------|---------------------|---------------|--------------|----------------------|
| `_ensure_worker_advance_subaccount` | DEFINER | denied | allow | allow | YES |
| `_ensure_worker_payable_subaccount` | DEFINER | denied | allow | allow | YES |
| `get_or_create_courier_payable_account` | DEFINER | denied | allow | allow | YES |
| `_resolve_worker_payment_debit_account` | DEFINER | denied | allow | allow | YES |
| `get_contact_party_gl_balances` | DEFINER | denied | allow | allow | (existing + WA path) |
| `record_payment_with_accounting` (12-arg) | DEFINER | denied | allow | allow | YES |
| `record_payment_with_accounting` (13-arg) | DEFINER | denied | allow | allow | YES |
| `_party_role_account_assert_company_access` | INVOKER | denied | — | — | helper |

Verdict: `PRODUCTION_CAPABILITY_SECURITY_CATALOG_PASS`

## Pre-T0 contact state (unchanged)

| Code | Type |
|------|------|
| SUP-ZHD-0007 DHL local | **supplier** |
| SUP-ZHD-0036 KIRAN | **supplier** |
| SUP-ZHD-0046 SHAHMIM | **supplier** |

## Target role leaves after capability deploy

| Leaf | Count |
|------|------:|
| DHL-local new 203x | **0** |
| KIRAN WA | **0** |
| KIRAN WP | **0** |
| SHAHMIM WA | **0** |
| SHAHMIM WP | **0** |

DHL PK `2030162` unchanged.

Verdict: `PRODUCTION_PRE_T0_STATE_PRESERVED`

## Historical AP freeze

Same AP-% linked non-void fingerprint as pre-deploy / staging baseline:

| Contact | Lines | Net |
|---------|------:|----:|
| SUP-ZHD-0007 | 48 | 4,700,000.00 |
| SUP-ZHD-0036 | 68 | 2,250,000.00 |
| SUP-ZHD-0046 | 86 | 5,000,000.00 |

`hist_fp` = `e2d8dbaf79042b661d354a95d1980d3e` (unchanged)

Verdict: `HISTORICAL_AP_POSTDEPLOY_FREEZE_PASS`

## Accounting invariants

| Check | Result |
|-------|--------|
| GL imbalance (posted non-void) | `0.00` |
| New `210xxx` dual-write for targets | none |
| Ibrahim | closed / untouched |
| ID LACE | `210027` empty; AP 89 lines; no-repair-required |
| Worker/courier role postings for three targets | **0** |

## Logs

PostgREST schema cache reload after migration — expected.  
No legitimate `PARTY_ROLE_ACCOUNT_FORBIDDEN` / payment RPC failure storm attributed to normal supplier flows in the deploy window.
