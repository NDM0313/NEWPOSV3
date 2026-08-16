# admin@test.com — production auth investigation

**Generated:** 2026-06-29  
**Method:** VPS `docker exec supabase-db psql` (read-only queries)

---

## auth.users

| Field | Value |
|-------|--------|
| Exists | **Yes** |
| User ID | `db6e3907-94be-4162-922b-9544a0e5e34a` |
| Email | `admin@test.com` |
| created_at | `2026-06-29 19:21:08 UTC` (matches local QA window) |

---

## Linked application data

| Check | Count |
|-------|------:|
| `public.users` (by auth id / email) | **1** |
| `public.companies` (via user company_id) | **1** — "QA Test Business Mac" |
| `public.user_branches` | **1** |
| `public.branches` | **1** |
| `public.accounts` (COA bootstrap) | **6** |
| `public.contacts` | **1** |
| `public.sales` | **0** |
| `public.purchases` | **0** |
| `public.journal_entries` | **0** |
| `auth.identities` | **1** |

### Profile row

- Email: `admin@test.com`
- Name: QA Test Owner
- Role: admin
- Company ID: `d7dac58b-a731-42cb-bc26-0bf7a1b8e292`
- Active: true

---

## Decision

**CLEANUP_REQUIRED — DO NOT DELETE**

User is **not** an orphan auth-only row. Local QA signup completed `create_business_transaction` on production, creating a full company bootstrap (accounts, branch, contact). Deletion would require explicit operator approval and a documented rollback plan for company `d7dac58b-a731-42cb-bc26-0bf7a1b8e292`.

---

## GL / accounting impact

No sales, purchases, or journal entries. COA bootstrap accounts exist (6) but no posted GL transactions from this company.
