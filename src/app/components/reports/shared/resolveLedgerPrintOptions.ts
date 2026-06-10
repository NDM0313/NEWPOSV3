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

export interface LedgerPrintOptions {
  orientation: ReportPrintOrientation;
  fieldVisibility: ReportHeaderFieldVisibility;
  showHeader: boolean;
  showFooter: boolean;
  fontSize: number;
  fontFamily: string;
  margins: PageMargins;
}

export function resolveLedgerPrintOptions(
  settings: CompanyPrintingSettings | null | undefined,
): LedgerPrintOptions {
  const merged = mergeWithDefaults(settings);
  return {
    orientation:
      merged.reportExport.ledgerReportOrientation ??
      merged.pageSetup.orientation ??
      'portrait',
    fieldVisibility: pickReportHeaderFieldVisibility(merged.fields),
    showHeader: merged.reportExport.showReportHeader !== false,
    showFooter: merged.reportExport.showReportFooter !== false,
    fontSize: merged.reportExport.reportFontSize ?? merged.pdf.fontSize ?? 11,
    fontFamily: merged.pdf.fontFamily ?? 'Arial',
    margins: merged.pageSetup.margins,
  };
}
