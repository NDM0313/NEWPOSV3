# Rental dress devaluation — shipped vs remaining

## Done (this branch)

- **GL (named customer):** Dr Rental Income (4200) / Cr party AR; `reference_type: rental`, idempotent fingerprints (`rental_party_devaluation:…`).
- **Walk-in / no customer:** Legacy Dr 5300 (or 6100) / Cr cash; `reference_type: expense` where applicable.
- **Web:** `rentalService`, `rentalPartyArAccounting`; **mobile:** `rentalBookingAccounting`, `rentals`, `CreateRentalFlow` copy.
- **UI:** Rental booking drawer labels; `TransactionDetailModal` rental vs sale expense banners.
- **Integrity Lab:** Tab **G · Rental GL repair** — scan, preview, dry-run apply, live apply (reversal + correcting JE + repair fingerprint).
- **DBA:** `scripts/sql/rental_devaluation_backfill_preview.sql` (read-only preview + commented template).
- **Optional schema:** `migrations/20260499_rentals_discount_amount.sql` for `rentals.discount_amount` (party discount JE path).

## Remaining (manual / ops)

1. **QA — new booking**  
   Create a rental with a named customer and devaluation lines; confirm ledger shows **4200 + party AR**, not cash, for devaluation.

2. **QA — Lab tab G**  
   On a legacy **5300 + cash** rental expense JE: **Scan → Preview → Apply dry-run**; verify JSON; then **Apply (live)** only on a copy/staging company first if unsure.

3. **Root web `tsc` (optional tech debt)**  
   `erp-mobile-app` passes `npx tsc --noEmit`. Monorepo root may still report unrelated historical TS errors; fix separately if you need a green root check.

4. **Production backfill**  
   Run Lab G (or DBA-reviewed SQL) per company after backup; rows without `customer_id` stay **WARN** / not auto-fixable.

---

*Last updated with this git commit. Update this file when QA or backfill steps complete.*
