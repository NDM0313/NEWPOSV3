# Pre-delete investigation

**Generated:** 2026-06-29  
**Method:** VPS `docker exec supabase-db psql` (read-only)

---

## Target records (confirmed present)

| Record | Value |
|--------|--------|
| Auth email | `admin@test.com` |
| Auth user id | `db6e3907-94be-4162-922b-9544a0e5e34a` |
| Company name | QA Test Business Mac |
| Company id | `d7dac58b-a731-42cb-bc26-0bf7a1b8e292` |

---

## Linked record counts

| Table / area | Count |
|--------------|------:|
| auth.users | 1 |
| auth.identities | 1 |
| public.users | 1 |
| public.companies | 1 |
| branches | 1 |
| user_branches | 1 |
| accounts (COA bootstrap) | 36 |
| contacts | 1 |
| products | 4 |
| product_categories | 4 |
| units | 4 |
| document_sequences | 11 |
| document_sequences_global | 22 |
| erp_document_sequences | 10 |
| modules_config | 10 |
| settings | 3 |
| business_settings | 1 |
| roles | 0 |

## Transaction tables (all zero)

| Table | Count |
|-------|------:|
| sales | 0 |
| purchases | 0 |
| payments | 0 |
| journal_entries | 0 |
| expenses | 0 |
| rentals | 0 |

---

## Real companies (untouched check)

DIN CHINA, DIN BRIDAL, DIN COUTURE — all **present**.

---

## Decision

**PROCEED** — bootstrap-only rows; zero business/GL transactions.
