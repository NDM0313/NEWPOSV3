# Mobile rental AR sub-ledger fix

## Root cause

Mobile booking GL (`erp-mobile-app/src/api/rentalBookingAccounting.ts`) used `resolveReceivablePostingAccountIdMobile`, which **looked up** an existing AR-CUS* row and **silently fell back to control 1100** when missing. Web uses `ensureReceivableSubaccountForContact`, which creates the sub-account first.

## Fixes applied

| Layer | Change |
|-------|--------|
| Mobile booking GL | RPC `ensure_party_subledgers_for_contact`; fail-closed if resolved account is 1100 |
| Mobile `addRentalPayment` | Link `rental_payments.journal_entry_id` from RPC; require payment account for named customers |
| Flutter | `rental_booking_accounting.dart`: sub-ledger ensure + revenue JE on booking; payment JE link |
| DB forward fix | `20260618120000_rental_ar_subledger_fail_closed.sql`: RPC fail-closed + trigger |
| DB historical repair | `20260618140000_hybrid_repair_gl_correction_targets.sql`: parametric GL correction per line |

## Phase D — historical repair (Hybrid Auto-Fix)

After deploying [`migrations/20260618140000_hybrid_repair_gl_correction_targets.sql`](../../migrations/20260618140000_hybrid_repair_gl_correction_targets.sql):

1. AR/AP Reconciliation Center → **Hybrid Repair** → Refresh
2. Each mis-posted rental line on 1100 appears as **Rental 1100 leakage — REN-*** (customer)
3. Enable **Auto-Fix** → **Run Full Reconciliation Fix** → confirm phrase `APPLY GL CORRECTION`
4. One additive `gl_correction` JE per source line (fingerprint `developer_repair:gl_correction:rental-1100-leakage:{line_id}`)
5. Fixed rows auto-hide on refresh; HQ-SL-0003 hides once its correction exists too

Correction direction:
- Revenue Dr on 1100 → correction **Dr AR-CUS* / Cr 1100**
- Payment Cr on 1100 → correction **Dr 1100 / Cr AR-CUS***

## Historical repair (manual)

Do **not** auto-rewrite historical 1100 postings without the Hybrid Repair RPC. Use:

1. [`scripts/sql/diag_rental_1100_leakage.sql`](../../scripts/sql/diag_rental_1100_leakage.sql) to list affected rows
2. Hybrid Repair panel or GL Correction Draft modal per defect

## Verification checklist

- [ ] Mobile booking with advance: revenue JE Dr AR-CUS* / Cr 4200; advance Cr AR-CUS*
- [ ] Mobile remaining payment: `payments` + JE; `rental_payments.journal_entry_id` set
- [ ] Flutter booking: revenue JE on AR-CUS* (no 1100)
- [ ] Flutter payment: `rental_payments.journal_entry_id` linked
- [ ] Named-customer RPC payment to 1100 rejected after migration deploy
- [ ] Hybrid Auto-Fix clears rental 1100 leakage rows; candidates disappear after apply
- [ ] HQ-SL-0003 hidden after its correction JE exists
