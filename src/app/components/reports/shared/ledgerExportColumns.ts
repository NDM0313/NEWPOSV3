import type { TabularColumnDef } from './buildTabularPrintSnapshot';

/** Print/PDF columns for ledger statements (no action/UI columns). */
export const LEDGER_PRINT_COLUMNS: TabularColumnDef[] = [
  { key: 'date', label: 'Date', align: 'left' },
  { key: 'reference', label: 'Reference', align: 'left' },
  { key: 'type', label: 'Type', align: 'left' },
  { key: 'description', label: 'Description', align: 'left' },
  { key: 'branch', label: 'Branch', align: 'left' },
  { key: 'debit', label: 'Debit', align: 'right' },
  { key: 'credit', label: 'Credit', align: 'right' },
  { key: 'balance', label: 'Balance', align: 'right' },
];

/** Optional print columns when landscape or extra detail is enabled. */
export const LEDGER_PRINT_OPTIONAL_COLUMNS: TabularColumnDef[] = [
  { key: 'payment', label: 'Payment Method', align: 'left' },
  { key: 'createdBy', label: 'Created By', align: 'left' },
];

/** CSV/Excel export — clean data columns only. */
export const LEDGER_EXPORT_COLUMNS: TabularColumnDef[] = [
  ...LEDGER_PRINT_COLUMNS,
  { key: 'payment', label: 'Payment Method', align: 'left' },
  { key: 'createdBy', label: 'Created By', align: 'left' },
];

export const LEDGER_PRINT_HEADER_LABELS = [
  'Date',
  'Ref',
  'Type',
  'Description',
  'Branch',
  'Debit',
  'Credit',
  'Balance',
] as const;

export const LEDGER_PRINT_HEADER_LABELS_WITH_OPTIONAL = [
  ...LEDGER_PRINT_HEADER_LABELS,
  'Payment',
  'Created By',
] as const;
