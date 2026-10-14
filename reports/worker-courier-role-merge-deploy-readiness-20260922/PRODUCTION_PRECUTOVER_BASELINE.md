# Production pre-cutover baseline (READ ONLY)

Captured immediately before merge/migrate/deploy for DIN COLLECTION  
`company_id = e08a04af-22a8-4869-9b4d-da31fce13158`.

## Application (pre-deploy)

| Item | Value |
|------|-------|
| Repo on VPS (pre-pull) | `c253d4c17e77f3353650a2bd6eee760516e6e95d` |
| Frontend container | `erp-frontend` healthy |
| HTTPS `/` | 200 |
| HTTPS `/health` | 200 |

Note: actual prior intentional app baseline detected as **`c253d4c1`** (not assumed `f7118c6b`).

## Migration bookkeeping (pre-apply)

| Migration | Present |
|-----------|---------|
| `20260922120000_worker_courier_role_model_account_domain.sql` | ABSENT |
| `20260922130000_record_payment_worker_role_leaf_debit.sql` | ABSENT |
| `20260922140000_record_payment_company_auth_and_acl.sql` | ABSENT |

Dry discovery with runner APPLIED-pipe logic: **only these three** would RUN.

## Contacts

| Code | Name | Type |
|------|------|------|
| `SUP-ZHD-0007` | DHL | `supplier` |
| `SUP-ZHD-0036` | KIRAN MUKESH | `supplier` |
| `SUP-ZHD-0046` | SHAHMIM NAZ | `supplier` |

## Role leaves (target cutover)

| Party | DHL-local 203x | WA | WP |
|-------|----------------|----|----|
| DHL local | 0 | — | — |
| KIRAN | — | 0 | 0 |
| SHAHMIM | — | 0 | 0 |

DHL PK `2030162` present and linked to DHL PK contact (`4505905b-…`) — **not** DHL local.

## Historical AP fingerprint (AP-% linked, non-void)

| Contact | Lines | Net (Dr−Cr) |
|---------|------:|------------:|
| SUP-ZHD-0007 | 48 | 4,700,000.00 |
| SUP-ZHD-0036 | 68 | 2,250,000.00 |
| SUP-ZHD-0046 | 86 | 5,000,000.00 |

Composite `hist_fp` = `e2d8dbaf79042b661d354a95d1980d3e`  
(matches staging clone baseline fingerprint).

## Accounting

| Check | Value |
|-------|-------|
| Company GL imbalance (posted non-void) | `0.00` |
| Dual-account cleanup | remains closed |
| Ibrahim | closed (`AP-SUPZHD0026` present; not touched) |
| ID LACE | `210027` lines=0; `AP-SUPZHD0027` lines=89; no-repair-required |

## Verdict

`PRODUCTION_PRECUTOVER_BASELINE_PASS`
