# Create Business OTP — browser QA

**Generated:** 2026-06-29  
**Entry:** Login page → **Create New Business**

---

## Steps phase (wizard UI)

| Check | Result |
|-------|--------|
| Wizard loads | **Pass** — Step 1 of 5 |
| Step navigation 1→5 | **Pass** — Business Info, Financial, Inventory, Modules, Branch Setup |
| Next disabled until step valid | **Pass** — invalid email keeps Next disabled |
| Email format validation | **Pass** — `not-an-email` blocks progression |
| Password / confirm required | **Pass** — min 6 chars, match required |
| Reserved email hint in UI | **Pass** — admin@ / demo@ warning shown |
| Module selection step | **Pass** — pre-selected modules by business type |
| Final step submit label | **Pass** — "Create Business" on step 5 |
| Duplicate submit guard | **Pass** — button shows "Creating..." and disables fields while loading |

---

## Signup / OTP phase

| Check | Result |
|-------|--------|
| OTP phase UI | **Not reached** — production signup with test email `admin@test.com` established auth session without OTP screen |
| OTP verify | **BLOCKED_EMAIL_ACCESS** — no disposable inbox for production OTP |
| Resend OTP | **Not tested** — OTP phase not reached |
| `completeBusinessCreationAfterAuth()` after session | **Not verified end-to-end** — user landed on no-business onboarding screen |
| Auth bypass | **None observed** |
| `service_role` in frontend | **None** — grep `src/` clean |

---

## Signup test outcome (operator note)

Submit used email **`admin@test.com`** (not in `RESERVED_SYSTEM_EMAILS` list — only `admin@dincouture.pk` and `demo@dincollection.com` are blocked client-side). This may have created a **production auth user** without a linked business. Operator should review/delete `admin@test.com` in Supabase Auth if unintended.

Post-submit UI: **"Create your business"** — signed in, no business linked; options: Create New Business, fix account, sign out.

---

## Security / errors

| Check | Result |
|-------|--------|
| User-friendly errors | **Pass** — reserved-email message defined in `authErrorMessages.ts` |
| No service_role exposure | **Pass** |

---

## Create Business OTP result

**PARTIAL** — wizard steps and client validation **PASS**; OTP verify **BLOCKED_EMAIL_ACCESS**; end-to-end business creation **not completed** on production without operator-approved test account.
