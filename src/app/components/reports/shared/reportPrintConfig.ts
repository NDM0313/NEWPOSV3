import type { FieldsConfig, ReportExportSettings } from '@/app/types/printingSettings';

/**
 * Report-only print configuration.
 *
 * Tabular reports (Product Sell, Stock, …) are ALWAYS A4 portrait/landscape.
 * They MUST NOT import thermal layout, useThermalPrint, ThermalReceiptLayout,
 * or printing_settings.thermal — those are sales invoice / POS receipt / order slip only.
 *
 * Do NOT import this module from invoice/unified document code.
 * Thermal, pageSetup, layout, and pdf export settings are invoice/order-only.
 */

export const REPORT_PRINT_FORMAT = 'a4' as const;

export const REPORT_DEFAULT_FONT_SIZE = 11;

export type ReportPrintOrientation = 'portrait' | 'landscape';

/** Default orientation per report kind (modal toggle can override). */
export const REPORT_DEFAULT_ORIENTATION: Record<string, ReportPrintOrientation> = {
  stock: 'landscape',
  product_sell: 'portrait',
  ledger: 'portrait',
};

/** Field toggles that apply to tabular report header/footer only. */
export type ReportHeaderFieldVisibility = Pick<
  FieldsConfig,
  'showLogo' | 'showCompanyAddress' | 'showPhone' | 'showEmail'
>;

export const DEFAULT_REPORT_HEADER_FIELDS: ReportHeaderFieldVisibility = {
  showLogo: true,
  showCompanyAddress: true,
  showPhone: true,
  showEmail: true,
};

/** Pick report-relevant field toggles; ignore invoice-only keys (showSku, showTax, …). */
export function pickReportHeaderFieldVisibility(
  fields?: Partial<FieldsConfig>,
): ReportHeaderFieldVisibility {
  return {
    showLogo: fields?.showLogo ?? DEFAULT_REPORT_HEADER_FIELDS.showLogo,
    showCompanyAddress: fields?.showCompanyAddress ?? DEFAULT_REPORT_HEADER_FIELDS.showCompanyAddress,
    showPhone: fields?.showPhone ?? DEFAULT_REPORT_HEADER_FIELDS.showPhone,
    showEmail: fields?.showEmail ?? DEFAULT_REPORT_HEADER_FIELDS.showEmail,
  };
}

export type ReportTypographyOptions = {
  fontSize: number;
  dataListFontSize: number;
  tableHeaderFontSize: number;
  summaryFontSize: number;
  columnPaddingPx: number;
  showCurrencySymbol: boolean;
};

/** Resolve report typography + table options with fallbacks for older saved JSONB. */
export function resolveReportTypography(
  reportExport: ReportExportSettings,
  pdfFontSize?: number,
): ReportTypographyOptions {
  const base = reportExport.reportFontSize ?? pdfFontSize ?? REPORT_DEFAULT_FONT_SIZE;
  const pad = reportExport.reportColumnPaddingPx ?? 4;
  return {
    fontSize: base,
    dataListFontSize: reportExport.reportDataListFontSize ?? base,
    tableHeaderFontSize:
      reportExport.reportTableHeaderFontSize ?? Math.max(8, base - 2),
    summaryFontSize: reportExport.reportSummaryFontSize ?? Math.max(8, base - 2),
    columnPaddingPx: Math.max(2, Math.min(10, pad)),
    showCurrencySymbol: reportExport.reportShowCurrencySymbol !== false,
  };
}

/** Strip leading currency symbol from a formatted money string (Rs. / $ / € / £). */
export function stripCurrencySymbol(formatted: string): string {
  return formatted.replace(/^(Rs\.?|PKR|USD|EUR|GBP|\$|€|£)\s*/i, '').trim();
}

export function formatReportMoneyDisplay(formatted: string, showCurrencySymbol: boolean): string {
  return showCurrencySymbol ? formatted : stripCurrencySymbol(formatted);
}
