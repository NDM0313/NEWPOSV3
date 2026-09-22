# Auth / company investigation

**Email (masked):** `k***+1@gmail.com`  
**Method:** VPS read-only `psql` on `supabase-db`

## Auth user — **found**

| Field | Value |
|-------|--------|
| id | `a5ed7b79-0e25-4a1b-8c48-69113fec6ade` |
| email_confirmed_at | **Set at signup** (same second as `created_at`) |
| provider | email |

## Company — **found**

| Field | Value |
|-------|--------|
| id | `845154ff-7c30-41b5-b69a-f1cd15c163a4` |
| name (DB) | `test` |
| UI reported | ERP Master (may differ from wizard step-1 input or display label) |

## Transactions — **all zero**

sales, purchases, payments, journal_entries, expenses, rentals = **0**

## Bootstrap

36 accounts, 1 branch, 1 contact, 4 products, 1 user_branch

DIN CHINA / DIN BRIDAL / DIN COUTURE — **present** (unchanged)
