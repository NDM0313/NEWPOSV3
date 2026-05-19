/**
 * FK dependency order and selection validation for selective restore.
 */

import type { BackupEntityKey } from './types';
import { BACKUP_ENTITY_BY_KEY } from './backupEntityRegistry';

/** Parent keys required when child is selected */
const REQUIRES: Partial<Record<BackupEntityKey, BackupEntityKey[]>> = {
  product_variations: ['products'],
  inventory_stock_balances: ['products'],
  purchase_items: ['purchases', 'products', 'contacts_suppliers'],
  purchases: ['contacts_suppliers', 'products'],
  sales_items: ['sales', 'products', 'contacts_customers'],
  sales: ['contacts_customers', 'products'],
  sale_return_items: ['sale_returns', 'sales', 'products', 'contacts_customers'],
  sale_returns: ['sales', 'contacts_customers', 'products'],
  purchase_return_items: ['purchase_returns', 'purchases', 'products', 'contacts_suppliers'],
  purchase_returns: ['purchases', 'contacts_suppliers', 'products'],
  rental_items: ['rentals', 'products', 'contacts_customers'],
  rentals: ['contacts_customers', 'products'],
  rental_payments: ['rentals', 'contacts_customers'],
  expenses: [],
};

/** Topological import order (masters first) */
const IMPORT_ORDER: BackupEntityKey[] = [
  'contacts_customers',
  'contacts_suppliers',
  'contacts_workers',
  'products',
  'product_variations',
  'inventory_stock_balances',
  'purchases',
  'purchase_items',
  'sales',
  'sales_items',
  'sale_returns',
  'sale_return_items',
  'purchase_returns',
  'purchase_return_items',
  'rentals',
  'rental_items',
  'rental_payments',
  'expenses',
];

export function computeImportOrder(selected: Set<BackupEntityKey>): BackupEntityKey[] {
  return IMPORT_ORDER.filter((k) => selected.has(k));
}

export interface DependencyValidationResult {
  ok: boolean;
  errors: string[];
  /** Parents that should be enabled when user selects a child */
  suggestedAdds: BackupEntityKey[];
}

export function validateRestoreSelection(selected: Set<BackupEntityKey>): DependencyValidationResult {
  const errors: string[] = [];
  const suggestedAdds = new Set<BackupEntityKey>();

  for (const key of selected) {
    const needs = REQUIRES[key] ?? [];
    for (const parent of needs) {
      if (!selected.has(parent)) {
        const parentLabel = BACKUP_ENTITY_BY_KEY[parent]?.label ?? parent;
        const childLabel = BACKUP_ENTITY_BY_KEY[key]?.label ?? key;
        errors.push(`${childLabel} requires ${parentLabel} to be selected.`);
        suggestedAdds.add(parent);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    suggestedAdds: [...suggestedAdds],
  };
}

export function mergeSelectionWithDependencies(
  selected: Set<BackupEntityKey>,
  addSuggested: BackupEntityKey[]
): Set<BackupEntityKey> {
  const next = new Set(selected);
  addSuggested.forEach((k) => next.add(k));
  return next;
}

export function getPhaseForEntity(key: BackupEntityKey): 1 | 2 | 3 {
  return BACKUP_ENTITY_BY_KEY[key]?.phase ?? 1;
}
