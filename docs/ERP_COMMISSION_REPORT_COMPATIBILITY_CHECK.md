# ERP Commission Report — Compatibility Check

## Purpose

Ensure the commission report query/filter fix does not break existing commission behavior: default commission % from user profile, admin override per invoice, and correct persistence of commission data on the sale.

## Behaviors Verified (Unchanged)

1. **Salesman default commission % from user profile**  
   - Still applied when a salesman is selected on the sale (user profile / `users` commission %).  
   - No changes were made in sale form, user service, or commission calculation on save.

2. **Admin override for one invoice**  
   - Admin can override commission % for a single sale; the saved sale stores the overridden value.  
   - No changes were made to sale save or commission fields.

3. **Persistence of commission data on save**  
   - Sale still persists `salesman_id`, `commission_amount`, `commission_percent`, `commission_eligible_amount`, `commission_status`, and (after posting) `commission_batch_id`.  
   - No changes were made to `saleService`, SalesContext, or any write path.

## Changes Made (Report Only)

- **CommissionReportPage.tsx**: Default UI state for “Payment eligibility” set to **Include due sales** instead of **Fully paid only**.
- **commissionReportService.ts**: Default for `paymentEligibility` in `getCommissionReport` set to **include_due**; comment updated.

These affect only:
- Which sales are **included in the report** by default (include due vs fully paid only).
- They do **not** affect how commission is calculated, saved, or posted.

## Conclusion

- Default commission % from user profile: **intact**.  
- Admin override per invoice: **intact**.  
- Correct persistence of commission on the sale: **intact**.  
- Report now shows commission sales by default (include due); “Fully paid only” remains available and behaves as designed.
