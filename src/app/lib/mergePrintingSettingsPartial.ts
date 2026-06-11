import type { CompanyPrintingSettings } from '@/app/types/printingSettings';

/**
 * Deep-merge a partial printing settings patch into the current draft.
 * Prevents nested slices (fields, reportExport, pageSetup, …) from being wiped on partial updates.
 */
export function mergePrintingSettingsPartial(
  prev: CompanyPrintingSettings | null | undefined,
  partial: Partial<CompanyPrintingSettings>,
): CompanyPrintingSettings {
  const base = prev ?? {};
  const next: CompanyPrintingSettings = { ...base, ...partial };

  if (partial.pageSetup !== undefined) {
    next.pageSetup = {
      ...base.pageSetup,
      ...partial.pageSetup,
      margins: {
        ...base.pageSetup?.margins,
        ...partial.pageSetup.margins,
      },
    };
  }

  if (partial.fields !== undefined) {
    next.fields = { ...base.fields, ...partial.fields };
  }

  if (partial.layout !== undefined) {
    next.layout = {
      ...base.layout,
      ...partial.layout,
      header: { ...base.layout?.header, ...partial.layout.header },
      table: { ...base.layout?.table, ...partial.layout.table },
      footer: { ...base.layout?.footer, ...partial.layout.footer },
    };
  }

  if (partial.pdf !== undefined) {
    next.pdf = { ...base.pdf, ...partial.pdf };
  }

  if (partial.reportExport !== undefined) {
    next.reportExport = {
      ...base.reportExport,
      ...partial.reportExport,
      ledgerColumnWidths: {
        ...base.reportExport?.ledgerColumnWidths,
        ...partial.reportExport.ledgerColumnWidths,
      },
    };
  }

  if (partial.thermal !== undefined) {
    next.thermal = { ...base.thermal, ...partial.thermal };
  }

  return next;
}
