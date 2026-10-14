# Cleanup execution

**Generated:** 2026-06-29  
**Method:** Scoped SQL transaction on VPS `supabase-db`

---

## Scope

Only approved QA test records:

- Auth: `admin@test.com` / `db6e3907-94be-4162-922b-9544a0e5e34a`
- Company: `d7dac58b-a731-42cb-bc26-0bf7a1b8e292`

---

## Execution order (single transaction)

| Step | Action | Rows deleted |
|------|--------|-------------:|
| 1 | `user_branches` for auth user | 1 |
| 2 | `contacts` — cleared `is_default` then deleted | 1 |
| 3 | `accounts` | 36 |
| 4 | Bootstrap: products, categories, units, sequences, modules, settings, business_settings, roles | 68 |
| 5 | `branches` | 1 |
| 6 | `public.users` | 1 |
| 7 | `companies` | 1 |
| 8 | `auth.identities` | 1 |
| 9 | `auth.users` | 1 |

**Note:** Walk-in Customer required `is_default = false` update before delete (trigger `prevent_delete_default_customer`).

---

## Result

**COMMIT successful** — all scoped deletes completed.

No DIN CHINA / DIN BRIDAL / DIN COUTURE data touched.
