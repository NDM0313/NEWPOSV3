import {
  mergeWithDefaults,
  type CompanyPrintingSettings,
  type PageMargins,
} from '@/app/types/printingSettings';

import {
  pickReportHeaderFieldVisibility,
  type ReportHeaderFieldVisibility,
  type ReportPrintOrientation,
} from './reportPrintConfig';

export type TabularReportKind = 'stock' | 'product_sell' | 'stock_movement_history';

export interface TabularReportPrintOptions {
  orientation: ReportPrintOrientation;
  fieldVisibility: ReportHeaderFieldVisibility;
  showHeader: boolean;
  showFooter: boolean;
  fontSize: number;
  fontFamily: string;
  margins: PageMargins;
}

export function resolveTabularReportPrintOptions(
  settings: CompanyPrintingSettings | null | undefined,
  kind: TabularReportKind,
): TabularReportPrintOptions {
  const merged = mergeWithDefaults(settings);
  const orientation =
    kind === 'stock'
      ? merged.reportExport.stockReportOrientation
      : kind === 'stock_movement_history'
        ? merged.reportExport.stockMovementHistoryOrientation ?? 'landscape'
        : merged.reportExport.productSellOrientation;
  return {
    orientation,
    fieldVisibility: pickReportHeaderFieldVisibility(merged.fields),
    showHeader: merged.reportExport.showReportHeader !== false,
    showFooter: merged.reportExport.showReportFooter !== false,
    fontSize: merged.reportExport.reportFontSize ?? merged.pdf.fontSize ?? 11,
    fontFamily: merged.pdf.fontFamily ?? 'Arial, Helvetica, sans-serif',
    margins: merged.pageSetup.margins,
  };
}
