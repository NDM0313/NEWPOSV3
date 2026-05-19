/**
 * Registry for all backup package entities (export + restore wizard).
 */

import type { BackupEntityKey, BackupEntityPhase } from './types';

export interface BackupEntityDefinition {
  key: BackupEntityKey;
  label: string;
  filename: string;
  phase: BackupEntityPhase;
  commitImplemented: boolean;
  description?: string;
}

export const BACKUP_ENTITY_DEFINITIONS: BackupEntityDefinition[] = [
  {
    key: 'contacts_customers',
    label: 'Customers',
    filename: 'contacts_customers.csv',
    phase: 1,
    commitImplemented: true,
  },
  {
    key: 'contacts_suppliers',
    label: 'Suppliers',
    filename: 'contacts_suppliers.csv',
    phase: 1,
    commitImplemented: true,
  },
  {
    key: 'contacts_workers',
    label: 'Workers',
    filename: 'contacts_workers.csv',
    phase: 1,
    commitImplemented: true,
  },
  {
    key: 'products',
    label: 'Products',
    filename: 'products.csv',
    phase: 1,
    commitImplemented: true,
  },
  {
    key: 'product_variations',
    label: 'Product variations',
    filename: 'product_variations.csv',
    phase: 1,
    commitImplemented: false,
    description: 'Exported for reference; variations restored via products CSV groups.',
  },
  {
    key: 'inventory_stock_balances',
    label: 'Inventory stock balances',
    filename: 'inventory_stock_balances.csv',
    phase: 1,
    commitImplemented: true,
  },
  {
    key: 'purchases',
    label: 'Purchases',
    filename: 'purchases.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'purchase_items',
    label: 'Purchase line items',
    filename: 'purchase_items.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'sales',
    label: 'Sales',
    filename: 'sales.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'sales_items',
    label: 'Sale line items',
    filename: 'sales_items.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'sale_returns',
    label: 'Sale returns',
    filename: 'sale_returns.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'sale_return_items',
    label: 'Sale return line items',
    filename: 'sale_return_items.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'purchase_returns',
    label: 'Purchase returns',
    filename: 'purchase_returns.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'purchase_return_items',
    label: 'Purchase return line items',
    filename: 'purchase_return_items.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'rentals',
    label: 'Rentals',
    filename: 'rentals.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'rental_items',
    label: 'Rental line items',
    filename: 'rental_items.csv',
    phase: 2,
    commitImplemented: false,
  },
  {
    key: 'rental_payments',
    label: 'Rental payments',
    filename: 'rental_payments.csv',
    phase: 3,
    commitImplemented: false,
  },
  {
    key: 'expenses',
    label: 'Expenses',
    filename: 'expenses.csv',
    phase: 2,
    commitImplemented: false,
  },
];

export const BACKUP_ENTITY_BY_KEY = Object.fromEntries(
  BACKUP_ENTITY_DEFINITIONS.map((d) => [d.key, d])
) as Record<BackupEntityKey, BackupEntityDefinition>;
