import React, { useMemo } from 'react';

import { PdfPreviewModal } from '@/app/components/shared/PdfPreviewModal';
import type { ExportData } from '@/app/utils/exportUtils';

import { ReportActions } from '../ReportActions';
import { FinancialReportPreview } from './FinancialReportPreview';
import { useFinancialReportPrint } from './useFinancialReportPrint';

export interface FinancialReportPrintShellProps {
  companyId: string | null;
  actionsTitle: string;
  reportTitle: string;
  periodLabel: string;
  branchLabel?: string;
  previewReference: string;
  exportPayload: ExportData | null;
  onExcel?: () => void;
  onWhatsapp?: () => void;
}

/** ReportActions + PdfPreviewModal + sr-only print sheet for GL financial reports. */
export function FinancialReportPrintShell({
  companyId,
  actionsTitle,
  reportTitle,
  periodLabel,
  branchLabel,
  previewReference,
  exportPayload,
  onExcel,
  onWhatsapp,
}: FinancialReportPrintShellProps) {
  const financialPrint = useFinancialReportPrint(companyId);
  const generatedAt = useMemo(
    () => new Date().toLocaleString(),
    [financialPrint.previewOpen],
  );

  const previewNode =
    financialPrint.brand && exportPayload ? (
      <FinancialReportPreview
        brand={financialPrint.brand}
        title={reportTitle}
        periodLabel={periodLabel}
        branchLabel={branchLabel}
        generatedAt={generatedAt}
        headers={exportPayload.headers}
        rows={exportPayload.rows}
        fieldVisibility={financialPrint.printOpts.fieldVisibility}
        showHeader={financialPrint.printOpts.showHeader}
        showFooter={financialPrint.printOpts.showFooter}
        orientation={financialPrint.printOrientation}
        fontSize={financialPrint.printOpts.fontSize}
        fontFamily={financialPrint.printOpts.fontFamily}
        margins={financialPrint.printOpts.margins}
      />
    ) : null;

  return (
    <>
      <div className="no-print">
        <ReportActions
          title={actionsTitle}
          onPrint={() => void financialPrint.handleOpenPreview()}
          onOpenPdfPreview={() => void financialPrint.handleOpenPreview()}
          onExcel={onExcel}
          onWhatsapp={onWhatsapp}
          pdfLoading={financialPrint.loadingBrand}
          previewContentRef={financialPrint.printRef}
          previewDocumentType="ledger"
          previewReference={previewReference}
        />
      </div>

      {financialPrint.previewOpen ? (
        <PdfPreviewModal
          open={financialPrint.previewOpen}
          onClose={financialPrint.closePreview}
          title={reportTitle}
          documentType="ledger"
          reference={previewReference}
          format={financialPrint.printFormat}
          orientation={financialPrint.printOrientation}
          showOrientationToggle
          onOrientationChange={financialPrint.setPrintOrientation}
          pageNumbers={financialPrint.printOpts.showFooter}
        >
          {previewNode}
        </PdfPreviewModal>
      ) : null}

      <div ref={financialPrint.printRef} className="sr-only">
        {previewNode}
      </div>
    </>
  );
}
