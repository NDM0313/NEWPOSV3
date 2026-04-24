# Rental mobile COA — completed work & remaining tasks

**Last updated:** 2026-04-24  
**Scope:** Mobile rental booking ↔ chart of accounts / journal parity, customer ledger fixes, TypeScript config.

---

## Completed (code in repo)

### Mobile rental → GL (COA parity)

- **`erp-mobile-app/src/api/rentalBookingAccounting.ts`** (new): resolves Rental Advance (~2020), expense (5300/6100), cash (1000); posts **advance JE** (Dr payment account / Cr Rental Advance) with `reference_type: rental`, idempotency fingerprint; posts **expense JE** for devaluation / extra costs (Dr expense / Cr cash), aligned with web `rentalService.createBooking`.
- **`erp-mobile-app/src/api/rentals.ts`**: `expenses[]` + `rental_expenses` persistence (with fallback if columns missing); **commission eligible** = `rental_charges − sum(expenses)`; on **advance + payment account**, inserts `rental_payments`, creates JE, **links** `journal_entry_id`, **rolls back** rental if JE fails; dispatches `accountingEntriesChanged` / `ledgerUpdated` for web `AccountingContext` refresh.
- **`erp-mobile-app/src/components/rental/CreateRentalFlow.tsx`**: **extra expense** no longer added into `rental_charges`; passed as structured **expenses**; UI uses **customer rent total** vs **commission base** (after devaluation).

### Web / shared ledger & tooling

- **`src/app/services/accountingService.ts`**: `arJournalLineMatchesCustomer` includes **rental** JEs when `reference_id` is in party’s rental set; merge skips **duplicate synthetic** rental charges if JE already carries `rental_id`.
- **Customer statement UI** (`CustomerLedgerPageOriginal`, `TransactionsTab`, `TransactionClassicView` — test + modern-original copies): **period totals** exclude synthetic opening row (match summary API); **`branchId`** passed into `customerLedgerAPI` options.
- **`tsconfig.json`**: `ignoreDeprecations: "6.0"` for TS 6 `baseUrl` deprecation (local `npx tsc --noEmit`).

### Other files in this commit batch

The same git push may include **additional** mobile/web changes already in the working tree (e.g. party ledger, sale/purchase edit accounting, integrity lab, studio, migrations). Review `git log -1` and `git show` after pull for the exact diff.

---

## Remaining tasks (Roman Urdu + English)

### COA / accounts abhi bhi change nahi ho rahe (possible reasons)

Agar aap ne **naya mobile build deploy** nahi kiya ya **purani booking** (code se pehle) dekhi hai to **journal_entries** nahi banay — balances same dikhen ge.

1. **Naya build / refresh:** Mobile app ko latest `main` se rebuild + reinstall karein; web par hard refresh.
2. **Advance zero:** Agar booking pe **paidAmount = 0** hai to advance **JE abhi bhi nahi** banta (web jaisa — posting zyada tar payment flow se). Expense-only booking par **expense JE** tabhi jab `expenses` amount > 0.
3. **Accounts resolve fail:** Agar company mein **2020 / 1000 / 5300** jaisa chart missing ho to insert rollback ho sakta hai — Supabase error message check karein.
4. **RLS / service role:** Agar mobile user ko `journal_entries` insert ki permission nahi to entry fail — logs / RLS policies verify karein.

**English:** Until you **verify new bookings after deploy** with advance + payment account selected, “COA not changing” can mean **no new JEs**, **old data**, or **permissions / missing accounts**.

### Product / follow-ups (plan Phase 3–4)

| Task | Notes |
|------|--------|
| **AR-first rental (optional)** | Web `recordRentalDelivery` credits **Rental Income** on cash; party **AR sub-ledger** policy alag design chahiye ho to alag migration + spec. |
| **Rental salesman commission GL** | Row-level `commission_*` save hota hai; **accrual/settlement JE** ka web hook trace karke mobile parity agar zaroorat ho. |
| **Sale return vs journal watcher** | Agar list mein dikhe GL watcher mein na ho to `reference_type` / `convertFromJournalEntry` alag investigation. |
| **Prod SQL sanity** | `reference_type = 'rental'` counts — sirf staging / read-only queries; prod par user-approved runbook. |

---

## Quick verification checklist

1. Mobile: new rental, **advance > 0**, payment account select → save.  
2. Supabase: `journal_entries` where `reference_type = 'rental'` and `reference_id = <rental_id>`.  
3. Web: Accounting / journal list refresh — naya entry dikhna chahiye.  
4. `rentals.rental_charges` vs `rental_expenses` JSON — extra line items rent se alag.

---

## Git

After `git pull origin main`, this document lives at:

`docs/RENTAL_MOBILE_COA_COMPLETION_AND_REMAINING.md`

Push with the rest of `main` per `GIT_WORKFLOW_RULES.txt`.
