import { useCallback, useRef, useState } from 'react';
import { getCompanyBrand, type CompanyBrand } from '../../api/reports';
import {
  getMobilePrintingSettings,
  type MobilePrintingSettingsBundle,
} from '../../api/mobilePrintingSettings';
import type { ReportPrintOrientation } from '../../lib/reportPrintConfig';
import { resolveLedgerPrintOptions } from '../../lib/resolveLedgerPrintOptions';

/**
 * Load brand + printing settings before opening PdfPreviewModal.
 * Settings are refreshed on every open (forceRefresh) so PDF matches web.
 */
export function usePdfPreview(companyId: string | null) {
  const [brand, setBrand] = useState<CompanyBrand | null>(null);
  const [settingsBundle, setSettingsBundle] = useState<MobilePrintingSettingsBundle | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const openLockRef = useRef(false);

  const ledgerOrientation: ReportPrintOrientation = settingsBundle
    ? resolveLedgerPrintOptions(settingsBundle.printingSettings).orientation
    : 'portrait';

  const openPreview = useCallback(async () => {
    if (!companyId || openLockRef.current) return;
    openLockRef.current = true;
    setLoading(true);
    try {
      const [b, settingsRes] = await Promise.all([
        brand ? Promise.resolve(brand) : getCompanyBrand(companyId),
        getMobilePrintingSettings(companyId, { forceRefresh: true }),
      ]);
      setBrand(b);
      setSettingsBundle(settingsRes.data);
      setOpen(true);
    } finally {
      setLoading(false);
      setTimeout(() => {
        openLockRef.current = false;
      }, 300);
    }
  }, [companyId, brand]);

  const close = useCallback(() => setOpen(false), []);

  return {
    brand,
    settingsBundle,
    printingSettings: settingsBundle?.printingSettings ?? null,
    currency: settingsBundle?.currency ?? null,
    receiptFields: settingsBundle?.receiptFields ?? null,
    ledgerOrientation,
    open,
    loading,
    openPreview,
    close,
  };
}
