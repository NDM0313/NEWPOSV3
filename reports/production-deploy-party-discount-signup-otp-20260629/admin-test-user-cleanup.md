# admin@test.com — cleanup decision

**Generated:** 2026-06-29

---

## Action taken

**NOT DELETED**

---

## Reason

Investigation found linked production data beyond auth-only:

- `public.users` profile (admin role)
- Company **QA Test Business Mac** (`d7dac58b-a731-42cb-bc26-0bf7a1b8e292`)
- Branch, user_branch, COA accounts (6), contact (1)
- Zero sales, purchases, journal entries

Per operator rules: **STOP** when business/company/profile links exist.

---

## Operator follow-up required

Explicit approval needed before removing:

- Auth user `db6e3907-94be-4162-922b-9544a0e5e34a`
- Company `d7dac58b-a731-42cb-bc26-0bf7a1b8e292` and bootstrap rows

No GL journal data to reverse; bootstrap COA only.
