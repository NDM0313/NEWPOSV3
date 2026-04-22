import { useCallback, useState } from 'react';
import { getCompanyBrand, type CompanyBrand } from '../../api/reports';

/**
 * Hook that encapsulates the "load brand + open preview modal" flow used by
 * every report component.  Returns stable handlers/state suitable for passing
 * into `ReportHeader.onShare` and `PdfPreviewModal`.
 */
export function usePdfPreview(companyId: string | null) {
  const [brand, setBrand] = useState<CompanyBrand | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const openPreview = useCallback(async () => {
    if (!companyId) return;
    if (!brand) {
      setLoading(true);
      try {
        const b = await getCompanyBrand(companyId);
        setBrand(b);
      } finally {
        setLoading(false);
      }
    }
    setOpen(true);
  }, [companyId, brand]);

  const close = useCallback(() => setOpen(false), []);

  return { brand, open, loading, openPreview, close };
}
