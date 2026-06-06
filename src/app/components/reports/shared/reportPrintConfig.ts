import type { FieldsConfig } from '@/app/types/printingSettings';

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
