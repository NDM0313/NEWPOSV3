import {
  mergeWithDefaults,
  type CompanyPrintingSettings,
  type PageMargins,
  type Orientation,
} from '@/app/types/printingSettings';

import {
  pickReportHeaderFieldVisibility,
  type ReportHeaderFieldVisibility,
  type ReportPrintOrientation,
} from './reportPrintConfig';
import {
  resolveLedgerColumnLayout,
  ledgerColumnLayoutKey,
  type ResolvedLedgerColumn,
} from './ledgerColumnLayout';

export interface LedgerPrintOptions {
  orientation: ReportPrintOrientation;
  fieldVisibility: ReportHeaderFieldVisibility;
  showHeader: boolean;
  showFooter: boolean;
  fontSize: number;
  fontFamily: string;
  margins: PageMargins;
  columns: ResolvedLedgerColumn[];
}

export function resolveLedgerPrintOptions(
  settings: CompanyPrintingSettings | null | undefined,
): LedgerPrintOptions {
  const merged = mergeWithDefaults(settings);
  const columns = resolveLedgerColumnLayout(settings, { useShortLabels: true });
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
    columns,
  };
}

/** Stable key for settings preview remount when layout toggles change. */
export function ledgerPreviewOptionsKey(opts: LedgerPrintOptions): string {
  const fv = opts.fieldVisibility;
  return [
    opts.orientation,
    opts.showHeader,
    opts.showFooter,
    opts.fontSize,
    opts.fontFamily,
    fv.showLogo,
    fv.showCompanyAddress,
    fv.showPhone,
    fv.showEmail,
    opts.margins.top,
    opts.margins.bottom,
    opts.margins.left,
    opts.margins.right,
    ledgerColumnLayoutKey(opts.columns),
  ].join('|');
}

/** Sync A4 page orientation into ledger report export (settings preview + save). */
export function patchPageSetupOrientationWithLedgerSync(
  settings: CompanyPrintingSettings | null | undefined,
  orientation: Orientation,
): Partial<CompanyPrintingSettings> {
  const merged = mergeWithDefaults(settings);
  return {
    pageSetup: { ...merged.pageSetup, orientation },
    reportExport: { ...merged.reportExport, ledgerReportOrientation: orientation },
  };
}
