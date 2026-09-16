# Bill/REF Local Work Audit — 2026-07-05 (updated 2026-07-06)

## Scope

Audit of Bill/REF-related changes while official Calendar Day 6 was date-blocked. At audit time the working tree was **clean** — prior unstaged work had already been committed as `4759b8ab` (`DON`) on `main`.

## Repo state at audit

| Field | Value |
|-------|-------|
| Branch | `main` |
| HEAD | `4759b8ab` |
| origin/main | `4759b8ab` (synced) |
| Staged files | none |
| Unstaged files | none |
| Audit correction `d6bdc940` | included (ancestor) |
| Official Day 5 `bcbd5fe4` | included (ancestor) |
| Local date/time | 2026-07-06 12:13 +05:00 |

## Files found

### Bill/REF source files (in commit `4759b8ab` since `d6bdc940`)

**New utilities + tests**

- `src/app/utils/saleNotesComposition.ts`
- `src/app/utils/saleNotesComposition.test.ts`
- `erp-mobile-app/src/utils/saleNotesComposition.ts`
- `erp-mobile-app/src/utils/saleNotesComposition.test.ts`

**Mobile**

- `erp-mobile-app/src/components/sales/SaleSummary.tsx` — sync Bill/REF into notes on change + flush before payment
- `erp-mobile-app/src/components/sales/SalesModule.tsx` — merged notes on save; composed `paymentNotes` on initial payment
- `erp-mobile-app/src/components/sales/SalesHome.tsx` — edit save merges Bill/REF; Receive Payment passes `customerBillRef`
- `erp-mobile-app/src/components/sales/MobileReceivePayment.tsx` — threads `customerBillRef`
- `erp-mobile-app/src/components/shared/MobilePaymentSheet.tsx` — auto description + compose on submit
- `erp-mobile-app/src/components/shared/UnifiedPaymentSheet.tsx` — threads bill ref props
- `erp-mobile-app/src/api/sales.ts` — `createSale` / `recordCustomerPayment` compose payment notes with Bill/REF

**Web**

- `src/app/components/sales/SaleForm.tsx` — merge REF into `sales.notes` on save; pass `customerBillRef` to payment dialog
- `src/app/components/sales/SalesPage.tsx` — pass `customerBillRef` on receive payment
- `src/app/components/sales/ViewSaleDetailsDrawer.tsx` — pass `customerBillRef` on edit payment
- `src/app/components/shared/UnifiedPaymentDialog.tsx` — auto notes include Bill/REF; recompose on submit
- `src/app/services/saleService.ts` — `recordPayment` loads sale Bill/REF and composes notes

**Supporting (existing, unchanged contract)**

- `src/app/utils/saleBillRef.ts` / `erp-mobile-app/src/utils/saleBillRef.ts` — `customer_bill_ref` column readers (not modified in diff)

### Bill/REF docs/notes

- None dedicated; behavior documented implicitly via code comments in composition helpers.

### Tests

- `saleNotesComposition.test.ts` (web + mobile) — merge, auto notes, bank trace composition
- Added to `package.json` `test:unit` glob (web)

### Ignored local artifacts (also bundled into `4759b8ab` — hygiene issue)

- `graphify-out/GRAPH_REPORT.md` (large regen)
- `reports/web-sales-purchase-save-performance-deploy-20260705/debug-*.png`
- `reports/single-core-ledger/operational-monitoring/three-company-monitoring-2026-07-05T*.json/.md` (accelerated samples)
- `reports/single-core-ledger/*/production-flags-day1.json` (drift)
- `scripts/web-save-performance/*.mjs` (local Playwright debug — not production scripts)

### Non–Bill/REF code in same commit `4759b8ab` (unrelated to Bill/REF audit scope)

- Mobile rental pickup flow (`CreateRentalFlow`, `RentalPickupModal`, `rentals.ts`, `rentalPickupDocs.ts`)
- `erp-mobile-app/src/services/printService.ts` (large change)
- `erp-mobile-app/src/api/products.ts`
- Web rental/purchase/transaction UI (`TransactionDetailModal`, `RentalsPage`, `ReturnModal`, etc.)
- `src/app/utils/transactionEventDateTime.ts`
- `GIT_WORKFLOW_RULES.txt` (minor)
- `scripts/single-core-ledger/run-calendar-day-office.ps1` (minor)

### Unsafe files

- **None** in commit: no `.env`, credentials, migrations, APK/AAB, keystore.

## Current understanding

### What the Bill/REF changes do

1. **Sale notes:** When user enters customer Bill/REF (e.g. `N226`), idempotently merge `Bill/REF: N226` into `sales.notes` while preserving free-form user text.
2. **Payment notes:** On customer receipt (mobile Receive Payment, web UnifiedPaymentDialog, sale create with payment), auto-compose payment description including party, invoice no, **Bill/REF**, amount, method; user add-on + bank trace appended via existing RPC notes field.
3. **No new DB columns** — uses existing `customer_bill_ref` + `notes` + `payments.notes`.

### Production data

- **No migration run.** Changes only affect **new/edited** sale saves and **new** payment posts going forward.
- Does not backfill historical payments.

### GL / accounting

- **Indirect only:** `payments.notes` and journal description text may include Bill/REF on **future** payment RPCs. No change to debit/credit rules, triggers, or GL posting logic.

### Migration required

- **No.**

### Display vs import/legacy

- Primarily **sales/payment UX + notes text** on mobile and web.
- Does not change import pipelines or legacy REF column mapping beyond existing `readSaleBillRef` fallbacks.

## Risk classification

| Area | Level |
|------|-------|
| Bill/REF feature logic | **Safe / needs review** — client-side composition only; tests pass |
| Commit hygiene (`4759b8ab DON`) | **Needs review** — mixed Bill/REF + graphify + debug PNGs + monitoring artifacts + rental/print unrelated work |
| Calendar stability | **Do not mix** — official Day 6 must be a separate docs-only evidence commit |
| Production deploy | **Needs operator confirmation** before VPS/mobile deploy of `4759b8ab` bundle |

## Validation (HEAD `4759b8ab`)

| Check | Result |
|-------|--------|
| `npm run test:unit` | **PASS** 136/136 |
| `npm run build` | **PASS** |
| Calendar monitoring | **not run** (audit-only prompt) |

## Recommendation

1. **Do not** fold Bill/REF into official Calendar Day 6 commit — keep calendar evidence isolated.
2. **Review `4759b8ab`** — commit message `DON` is not acceptable for production audit trail; consider a follow-up commit that documents intent or split/revert unrelated files in a future approved change (no history rewrite without explicit approval).
3. **Bill/REF feature** is technically ready for separate deploy review: mobile + web, no migration, tests green.
4. **Manual QA:** Mobile Sale Summary Bill/REF → Notes sync; Receive Payment notes; web SaleForm REF + receive payment from Sales list.
5. **Do not deploy** rental/print/monitoring/debug portions of `4759b8ab` without separate review.

## Safety

| Gate | Status |
|------|--------|
| R8 run | no |
| DB migrations run | no |
| Repairs run | no |
| Production mutation | no (audit + local tests only) |
| Passwords committed | no |
| Sensitive files staged | no |
| Calendar monitoring run | no |

## Next

- **Official Calendar Day 6** eligible on **2026-07-06+** — run as separate workflow; do not include Bill/REF source in that commit.
- Bill/REF: operator approval before treating `4759b8ab` as released; ideally isolate feature in a properly named commit going forward.
