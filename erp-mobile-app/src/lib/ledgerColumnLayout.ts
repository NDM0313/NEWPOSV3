import { mergeWithDefaults, type CompanyPrintingSettings } from '../types/printingSettings';

export type LedgerColumnKey =
  | 'date'
  | 'reference'
  | 'type'
  | 'description'
  | 'branch'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'payment'
  | 'createdBy';

export interface LedgerColumnDef {
  key: LedgerColumnKey;
  label: string;
  shortLabel: string;
  align: 'left' | 'right';
  required?: boolean;
}

export const LEDGER_COLUMN_CATALOG: Record<LedgerColumnKey, LedgerColumnDef> = {
  date: { key: 'date', label: 'Date', shortLabel: 'Date', align: 'left' },
  reference: { key: 'reference', label: 'Reference', shortLabel: 'Ref', align: 'left' },
  type: { key: 'type', label: 'Type', shortLabel: 'Type', align: 'left' },
  description: { key: 'description', label: 'Description', shortLabel: 'Description', align: 'left' },
  branch: { key: 'branch', label: 'Branch', shortLabel: 'Branch', align: 'left' },
  debit: { key: 'debit', label: 'Debit', shortLabel: 'Debit', align: 'right' },
  credit: { key: 'credit', label: 'Credit', shortLabel: 'Credit', align: 'right' },
  balance: { key: 'balance', label: 'Balance', shortLabel: 'Balance', align: 'right', required: true },
  payment: { key: 'payment', label: 'Payment Method', shortLabel: 'Payment', align: 'left' },
  createdBy: { key: 'createdBy', label: 'Created By', shortLabel: 'Created By', align: 'left' },
};

export const DEFAULT_LEDGER_PRINT_COLUMN_KEYS: LedgerColumnKey[] = [
  'date',
  'reference',
  'type',
  'description',
  'branch',
  'debit',
  'credit',
  'balance',
];

export const ALL_LEDGER_COLUMN_KEYS: LedgerColumnKey[] = [
  ...DEFAULT_LEDGER_PRINT_COLUMN_KEYS,
  'payment',
  'createdBy',
];

export interface ResolvedLedgerColumn {
  key: LedgerColumnKey;
  label: string;
  shortLabel: string;
  align: 'left' | 'right';
  widthPct: number;
}

const MIN_WIDTH = 5;
const MAX_WIDTH = 50;

function isLedgerColumnKey(k: string): k is LedgerColumnKey {
  return k in LEDGER_COLUMN_CATALOG;
}

export function getSavedLedgerColumnKeys(
  settings: CompanyPrintingSettings | null | undefined,
): LedgerColumnKey[] {
  const merged = mergeWithDefaults(settings);
  const raw = merged.reportExport.ledgerPrintColumns;
  if (!raw?.length) return [...DEFAULT_LEDGER_PRINT_COLUMN_KEYS];

  const seen = new Set<LedgerColumnKey>();
  const ordered: LedgerColumnKey[] = [];
  for (const k of raw) {
    if (isLedgerColumnKey(k) && !seen.has(k)) {
      seen.add(k);
      ordered.push(k);
    }
  }
  if (!ordered.includes('balance')) ordered.push('balance');
  if (ordered.length < 3) return [...DEFAULT_LEDGER_PRINT_COLUMN_KEYS];
  return ordered;
}

export function resolveLedgerColumnLayout(
  settings: CompanyPrintingSettings | null | undefined,
  opts?: { useShortLabels?: boolean },
): ResolvedLedgerColumn[] {
  const merged = mergeWithDefaults(settings);
  const keys = getSavedLedgerColumnKeys(settings);
  const rawWidths = merged.reportExport.ledgerColumnWidths ?? {};

  const specified = keys.map((key) => {
    const w = rawWidths[key];
    return typeof w === 'number' && w >= MIN_WIDTH && w <= MAX_WIDTH ? w : null;
  });

  const specifiedSum = specified.reduce<number>((s, w) => s + (w ?? 0), 0);
  const unspecifiedCount = specified.filter((w) => w === null).length;
  const remainder = Math.max(0, 100 - specifiedSum);
  const autoEach = unspecifiedCount > 0 ? remainder / unspecifiedCount : 0;

  return keys.map((key, i) => {
    const def = LEDGER_COLUMN_CATALOG[key];
    const widthPct = Math.round((specified[i] ?? autoEach) * 10) / 10;
    return {
      key,
      label: opts?.useShortLabels ? def.shortLabel : def.label,
      shortLabel: def.shortLabel,
      align: def.align,
      widthPct: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widthPct || MIN_WIDTH)),
    };
  });
}

export function ledgerColumnLayoutKey(columns: ResolvedLedgerColumn[]): string {
  return columns.map((c) => `${c.key}:${c.widthPct}`).join('|');
}
