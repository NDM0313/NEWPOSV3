import {
  mergeWithDefaults,
  DEFAULT_LEDGER_COLUMN_WIDTHS,
  type CompanyPrintingSettings,
  type LedgerColumnWidthKey,
  type LedgerColumnWidthSetting,
  type PageMargins,
} from '@/app/types/printingSettings';

import {
  pickReportHeaderFieldVisibility,
  resolveReportTypography,
  type ReportHeaderFieldVisibility,
  type ReportPrintOrientation,
} from './reportPrintConfig';

export type LedgerColumnWidthValue = LedgerColumnWidthSetting;

export interface LedgerPrintOptions {
  orientation: ReportPrintOrientation;
  fieldVisibility: ReportHeaderFieldVisibility;
  showHeader: boolean;
  showFooter: boolean;
  fontSize: number;
  dataListFontSize: number;
  tableHeaderFontSize: number;
  summaryFontSize: number;
  columnPaddingPx: number;
  showCurrencySymbol: boolean;
  /** Per-column width % or 'auto'. */
  columnWidths: Record<string, LedgerColumnWidthValue>;
  fontFamily: string;
  margins: PageMargins;
}

export const LEDGER_COLUMN_WIDTH_KEYS = Object.keys(
  DEFAULT_LEDGER_COLUMN_WIDTHS,
) as LedgerColumnWidthKey[];

function clampWidthPercent(n: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(5, Math.min(30, Math.round(n)));
}

function normalizeWidthSetting(raw: LedgerColumnWidthSetting | undefined, fallback: LedgerColumnWidthSetting): LedgerColumnWidthValue {
  const v = raw ?? fallback;
  if (v === 'auto') return 'auto';
  if (typeof v === 'number') return clampWidthPercent(v);
  return fallback === 'auto' ? 'auto' : clampWidthPercent(Number(fallback) || 10);
}

/** Merge saved ledger column widths; any column may be % or auto. */
export function resolveLedgerColumnWidths(
  saved?: Partial<Record<LedgerColumnWidthKey, LedgerColumnWidthSetting>> | null,
): Record<string, LedgerColumnWidthValue> {
  const out: Record<string, LedgerColumnWidthValue> = {};
  for (const key of LEDGER_COLUMN_WIDTH_KEYS) {
    out[key] = normalizeWidthSetting(saved?.[key], DEFAULT_LEDGER_COLUMN_WIDTHS[key]);
  }
  return out;
}

/** Sum of fixed % columns (auto ignored). */
export function sumFixedLedgerColumnPercents(
  widths: Record<string, LedgerColumnWidthValue>,
): number {
  let sum = 0;
  for (const v of Object.values(widths)) {
    if (typeof v === 'number') sum += v;
  }
  return sum;
}

export function resolveLedgerPrintOptions(
  settings: CompanyPrintingSettings | null | undefined,
): LedgerPrintOptions {
  const merged = mergeWithDefaults(settings);
  const typography = resolveReportTypography(merged.reportExport, merged.pdf.fontSize);
  return {
    orientation:
      merged.reportExport.ledgerReportOrientation ??
      merged.pageSetup.orientation ??
      'portrait',
    fieldVisibility: pickReportHeaderFieldVisibility(merged.fields),
    showHeader: merged.reportExport.showReportHeader !== false,
    showFooter: merged.reportExport.showReportFooter !== false,
    ...typography,
    columnWidths: resolveLedgerColumnWidths(merged.reportExport.reportLedgerColumnWidths),
    fontFamily: merged.pdf.fontFamily ?? 'Arial',
    margins: merged.pageSetup.margins,
  };
}
