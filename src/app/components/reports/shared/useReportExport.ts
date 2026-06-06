import { useCallback, useRef, useState } from 'react';

import { getCompanyBrand, type CompanyBrand } from '@/app/services/companyBrandService';
import { printingSettingsService } from '@/app/services/printingSettingsService';
import { documentShareService } from '@/app/services/documentShareService';
import type { DocumentType } from '@/app/services/pdfExportService';
import {
  DEFAULT_REPORT_EXPORT,
  mergeWithDefaults,
  type ReportExportSettings,
} from '@/app/types/printingSettings';

import {
  pickReportHeaderFieldVisibility,
  REPORT_DEFAULT_FONT_SIZE,
  REPORT_PRINT_FORMAT,
  type ReportHeaderFieldVisibility,
} from './reportPrintConfig';

export { buildTabularPrintSnapshot } from './buildTabularPrintSnapshot';
export type { TabularPrintSnapshot, TabularColumnDef } from './buildTabularPrintSnapshot';

export interface UseReportExportOptions {
  companyId: string | null;
  documentType?: DocumentType;
}

/**
 * Shared hook for tabular web reports only.
 * Loads company profile + report header field toggles + reportExport defaults.
 */
export function useReportExport({ companyId, documentType = 'ledger' }: UseReportExportOptions) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [brand, setBrand] = useState<CompanyBrand | null>(null);
  const [fieldVisibility, setFieldVisibility] = useState<ReportHeaderFieldVisibility>(
    pickReportHeaderFieldVisibility(),
  );
  const [reportExportSettings, setReportExportSettings] = useState<ReportExportSettings>(DEFAULT_REPORT_EXPORT);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingBrand, setLoadingBrand] = useState(false);

  const refreshReportSettings = useCallback(async () => {
    if (!companyId) return;
    const settingsRes = await printingSettingsService.getMerged(companyId);
    setFieldVisibility(pickReportHeaderFieldVisibility(settingsRes.data?.fields));
    setReportExportSettings(mergeWithDefaults(settingsRes.data).reportExport);
  }, [companyId]);

  const ensureBrand = useCallback(async (): Promise<CompanyBrand | null> => {
    if (!companyId) return null;
    if (brand) return brand;

    setLoadingBrand(true);
    try {
      const [loadedBrand, settingsRes] = await Promise.all([
        getCompanyBrand(companyId),
        printingSettingsService.getMerged(companyId),
      ]);
      setBrand(loadedBrand);
      setFieldVisibility(pickReportHeaderFieldVisibility(settingsRes.data?.fields));
      setReportExportSettings(mergeWithDefaults(settingsRes.data).reportExport);
      return loadedBrand;
    } finally {
      setLoadingBrand(false);
    }
  }, [companyId, brand]);

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
    (opts: { title: string; reference?: string; period?: string; phone?: string | null }) => {
      const msgTitle = opts.period ? `${opts.title} (${opts.period})` : opts.title;
      documentShareService.shareViaWhatsApp(
        documentShareService.buildShareMessage({
          documentType,
          reference: opts.reference,
          title: msgTitle,
        }),
        opts.phone ?? undefined,
      );
    },
    [documentType],
  );

  return {
    printRef,
    brand,
    fieldVisibility,
    reportExportSettings,
    printFormat: REPORT_PRINT_FORMAT,
    reportFontSize: REPORT_DEFAULT_FONT_SIZE,
    previewOpen,
    setPreviewOpen,
    openPreview,
    closePreview,
    loadingBrand,
    ensureBrand,
    refreshReportSettings,
    shareViaWhatsApp,
  };
}
