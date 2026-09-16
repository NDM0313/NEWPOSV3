# Legacy fallback alignment

**Fix:** Code-only — include `party_discount` in hybrid legacy party ledger matchers.

## Changes

| File | Change |
|------|--------|
| `partyLedgerLegacyJournalMatch.ts` | New helper `isPartyDiscountJournalForContact` |
| `accountingService.ts` | Customer `arJournalLineMatchesCustomer` + supplier `supplierApJournalLineMatchesSupplier` call helper |
| `partyDiscountLegacyLedgerMatch.test.ts` | Matcher + JE-0003 closing 216299 tests |

## Accounting direction preserved

- **Customer:** Dr 5200 / Cr AR — credit on AR reduces receivable (216300 → 216299).
- **Supplier:** Dr AP / Cr 5210 — matcher ready for supplier `party_discount` by `reference_id`.

No database changes. No feature flags. No waiver.
