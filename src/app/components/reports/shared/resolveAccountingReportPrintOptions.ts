import {
  mergeWithDefaults,
  type CompanyPrintingSettings,
  type PageMargins,
} from '@/app/types/printingSettings';

import {
  pickReportHeaderFieldVisibility,
  resolveReportTypography,
  type ReportHeaderFieldVisibility,
  type ReportPrintOrientation,
} from './reportPrintConfig';

export type AccountingReportKind = 'roznamcha' | 'cash_flow' | 'day_book' | 'financial';

export interface AccountingReportPrintOptions {
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
  fontFamily: string;
  margins: PageMargins;
}

const DEFAULT_ORIENTATION: Record<AccountingReportKind, ReportPrintOrientation> = {
  roznamcha: 'landscape',
  cash_flow: 'landscape',
  day_book: 'landscape',
  financial: 'portrait',
};

function orientationFromSettings(
  merged: ReturnType<typeof mergeWithDefaults>,
  kind: AccountingReportKind,
): ReportPrintOrientation {
  const re = merged.reportExport;
  switch (kind) {
    case 'roznamcha':
      return re.roznamchaOrientation ?? DEFAULT_ORIENTATION.roznamcha;
    case 'cash_flow':
      return re.cashFlowOrientation ?? DEFAULT_ORIENTATION.cash_flow;
    case 'day_book':
      return re.dayBookOrientation ?? DEFAULT_ORIENTATION.day_book;
    case 'financial':
      return re.financialReportOrientation ?? DEFAULT_ORIENTATION.financial;
    default:
      return merged.pageSetup.orientation ?? 'portrait';
  }
}

export function resolveAccountingReportPrintOptions(
  settings: CompanyPrintingSettings | null | undefined,
  kind: AccountingReportKind,
): AccountingReportPrintOptions {
  const merged = mergeWithDefaults(settings);
  const typography = resolveReportTypography(merged.reportExport, merged.pdf.fontSize);
  return {
    orientation: orientationFromSettings(merged, kind),
    fieldVisibility: pickReportHeaderFieldVisibility(merged.fields),
    showHeader: merged.reportExport.showReportHeader !== false,
    showFooter: merged.reportExport.showReportFooter !== false,
    ...typography,
    fontFamily: merged.pdf.fontFamily ?? 'Arial',
    margins: merged.pageSetup.margins,
  };
}
