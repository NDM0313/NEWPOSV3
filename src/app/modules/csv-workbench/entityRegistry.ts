/**
 * Registry of CSV entity profiles. Stubs reserve extension points without UI wiring.
 */

import type { CsvEntityProfile, CsvEntityId, CsvWorkbenchResult } from './types';
import { productsProfile } from './profiles/productsProfile';
import { contactsProfile } from './profiles/contactsProfile';

const notImplemented = (id: CsvEntityId, name: string): CsvEntityProfile<never> => ({
  id,
  displayName: name,
  canonicalHeaders: [],
  buildBlankTemplate: () => {
    throw new Error(`${name} CSV template is not implemented yet.`);
  },
  parseFile: (): CsvWorkbenchResult<never> => ({
    ok: false,
    error: `${name} CSV import is not implemented yet. Use forward migrations + UI when ready.`,
  }),
  isImplemented: false,
});

const chartOfAccountsProfile = notImplemented('chart_of_accounts', 'Chart of accounts');
const stockAdjustmentsProfile = notImplemented('stock_adjustments', 'Stock adjustments');

export const csvEntityRegistry: Record<CsvEntityId, CsvEntityProfile<unknown>> = {
  products: productsProfile as CsvEntityProfile<unknown>,
  contacts: contactsProfile as CsvEntityProfile<unknown>,
  chart_of_accounts: chartOfAccountsProfile as CsvEntityProfile<unknown>,
  stock_adjustments: stockAdjustmentsProfile as CsvEntityProfile<unknown>,
};

export function getCsvEntityProfile(id: CsvEntityId): CsvEntityProfile<unknown> {
  return csvEntityRegistry[id];
}
