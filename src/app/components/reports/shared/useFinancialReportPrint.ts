import { useCallback, useEffect, useState } from 'react';

import type { PdfPreviewOrientation } from '@/app/components/shared/PdfPreviewModal';

import { useReportExport } from './useReportExport';

/** Shared print/PDF wiring for Trial Balance, P&L, Balance Sheet, etc. */
export function useFinancialReportPrint(companyId: string | null) {
  const reportExport = useReportExport({
    companyId,
    documentType: 'ledger',
    reportKind: 'financial',
  });
  const [printOrientation, setPrintOrientation] = useState<PdfPreviewOrientation>('portrait');

  useEffect(() => {
    setPrintOrientation(reportExport.accountingPrintOptions.orientation);
  }, [reportExport.accountingPrintOptions.orientation]);

  const handleOpenPreview = useCallback(async () => {
    await reportExport.openPreview();
  }, [reportExport]);

  return {
    ...reportExport,
    printOpts: reportExport.accountingPrintOptions,
    printOrientation,
    setPrintOrientation,
    handleOpenPreview,
  };
}
