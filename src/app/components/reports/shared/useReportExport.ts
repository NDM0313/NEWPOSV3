import { useCallback, useEffect, useRef, useState } from 'react';

import { getCompanyBrand, type CompanyBrand } from '@/app/services/companyBrandService';
import { printingSettingsService } from '@/app/services/printingSettingsService';
import { documentShareService } from '@/app/services/documentShareService';
import type { DocumentType } from '@/app/services/pdfExportService';
import {
  DEFAULT_REPORT_EXPORT,
  mergeWithDefaults,
  type ReportExportSettings,
} from '@/app/types/printingSettings';
import { onPrintingSettingsSaved } from '@/app/lib/printingSettingsEvents';

import {
  pickReportHeaderFieldVisibility,
  REPORT_DEFAULT_FONT_SIZE,
  REPORT_PRINT_FORMAT,
  type ReportHeaderFieldVisibility,
} from './reportPrintConfig';
import {
  resolveLedgerPrintOptions,
  type LedgerPrintOptions,
} from './resolveLedgerPrintOptions';
import {
  resolveTabularReportPrintOptions,
  type TabularReportKind,
  type TabularReportPrintOptions,
} from './resolveTabularReportPrintOptions';

export { buildTabularPrintSnapshot } from './buildTabularPrintSnapshot';
export type { TabularPrintSnapshot, TabularColumnDef } from './buildTabularPrintSnapshot';

export type ReportExportKind = 'ledger' | 'stock' | 'product_sell';

export interface UseReportExportOptions {
  companyId: string | null;
  documentType?: DocumentType;
  /** Which Tier A report page — drives tabular print options. */
  reportKind?: ReportExportKind;
}

/**
 * Shared hook for tabular web reports only.
 * Loads company profile + report header field toggles + reportExport defaults.
 */
export function useReportExport({
  companyId,
  documentType = 'ledger',
  reportKind = 'ledger',
}: UseReportExportOptions) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [brand, setBrand] = useState<CompanyBrand | null>(null);
  const [fieldVisibility, setFieldVisibility] = useState<ReportHeaderFieldVisibility>(
    pickReportHeaderFieldVisibility(),
  );
  const [reportExportSettings, setReportExportSettings] = useState<ReportExportSettings>(DEFAULT_REPORT_EXPORT);
  const [ledgerPrintOptions, setLedgerPrintOptions] = useState<LedgerPrintOptions>(() =>
    resolveLedgerPrintOptions(null),
  );
  const [tabularPrintOptions, setTabularPrintOptions] = useState<TabularReportPrintOptions>(() =>
    resolveTabularReportPrintOptions(null, reportKind === 'product_sell' ? 'product_sell' : 'stock'),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingBrand, setLoadingBrand] = useState(false);

  const tabularKind: TabularReportKind = reportKind === 'product_sell' ? 'product_sell' : 'stock';

  const refreshReportSettings = useCallback(async () => {
    if (!companyId) return;
    const settingsRes = await printingSettingsService.getMerged(companyId);
    const merged = mergeWithDefaults(settingsRes.data);
    setFieldVisibility(pickReportHeaderFieldVisibility(merged.fields));
    setReportExportSettings(merged.reportExport);
    setLedgerPrintOptions(resolveLedgerPrintOptions(settingsRes.data));
    if (reportKind === 'stock' || reportKind === 'product_sell') {
      setTabularPrintOptions(resolveTabularReportPrintOptions(settingsRes.data, tabularKind));
    }
  }, [companyId, reportKind, tabularKind]);

  const ensureBrand = useCallback(async (): Promise<CompanyBrand | null> => {
    if (!companyId) return null;

    setLoadingBrand(true);
    try {
      const settingsPromise = refreshReportSettings();
      if (brand) {
        await settingsPromise;
        return brand;
      }
      const [loadedBrand] = await Promise.all([getCompanyBrand(companyId), settingsPromise]);
      setBrand(loadedBrand);
      return loadedBrand;
    } finally {
      setLoadingBrand(false);
    }
  }, [companyId, brand, refreshReportSettings]);

  const preparePrint = useCallback(async () => {
    if (!companyId) return;
    setLoadingBrand(true);
    try {
      await refreshReportSettings();
    } finally {
      setLoadingBrand(false);
    }
  }, [companyId, refreshReportSettings]);

  useEffect(() => {
    if (!companyId) return;
    return onPrintingSettingsSaved(companyId, () => {
      void refreshReportSettings();
    });
  }, [companyId, refreshReportSettings]);

  const openPreview = useCallback(async () => {
    if (!companyId) return;
    setLoadingBrand(true);
    try {
      const brandPromise = brand ? Promise.resolve(brand) : getCompanyBrand(companyId);
      const [loadedBrand] = await Promise.all([brandPromise, refreshReportSettings()]);
      if (!brand) setBrand(loadedBrand);
    } finally {
      setLoadingBrand(false);
    }
    setPreviewOpen(true);
  }, [companyId, brand, refreshReportSettings]);

  const closePreview = useCallback(() => setPreviewOpen(false), []);

  const shareViaWhatsApp = useCallback(
    (opts: {
      title: string;
      reference?: string;
      period?: string;
      phone?: string | null;
      /** Full message body — when set, skips generic one-liner. */
      message?: string;
    }) => {
      const text =
        opts.message ??
        documentShareService.buildShareMessage({
          documentType,
          reference: opts.reference,
          title: opts.period ? `${opts.title} (${opts.period})` : opts.title,
        });
      documentShareService.shareViaWhatsApp(text, opts.phone ?? undefined);
    },
    [documentType],
  );

  const reportFontSize = reportExportSettings.reportFontSize ?? REPORT_DEFAULT_FONT_SIZE;

  return {
    printRef,
    brand,
    fieldVisibility,
    reportExportSettings,
    ledgerPrintOptions,
    tabularPrintOptions,
    printFormat: REPORT_PRINT_FORMAT,
    reportFontSize,
    previewOpen,
    setPreviewOpen,
    openPreview,
    closePreview,
    loadingBrand,
    ensureBrand,
    refreshReportSettings,
    preparePrint,
    shareViaWhatsApp,
  };
}
