/**
 * Phase A: Single document engine for Print A4, Print Thermal, Download PDF, Share PDF.
 * Fetches document + template and renders A4 or Thermal template. No duplicate layout.
 */
import React from 'react';
import { InvoiceDocument } from './InvoiceDocument';
import { A4InvoiceTemplate } from './A4InvoiceTemplate';
import { ThermalInvoiceTemplate } from './ThermalInvoiceTemplate';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import type { InvoiceTemplateType } from '@/app/types/invoiceDocument';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';

export interface InvoiceDocumentViewProps {
  saleId: string | null;
  companyId: string | null;
  templateType: InvoiceTemplateType;
  onClose?: () => void;
  /** When true, show Print + Close; when false, only Close (e.g. embed mode) */
  showPrintAction?: boolean;
  /** Thermal paper width when templateType is Thermal */
  thermalPaperSize?: '58mm' | '80mm';
}

export const InvoiceDocumentView: React.FC<InvoiceDocumentViewProps> = ({
  saleId,
  companyId,
  templateType,
  onClose,
  showPrintAction = true,
  thermalPaperSize = '80mm',
}) => {
  const { formatCurrency } = useFormatCurrency();

  const handlePrint = () => {
    window.print();
  };

  const actionChildren = showPrintAction ? (
    <div className="flex gap-2">
      <Button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
        <Printer size={16} />
        Print
      </Button>
      {onClose && (
        <Button onClick={onClose} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">
          <X size={16} />
          Close
        </Button>
      )}
    </div>
  ) : undefined;

  return (
    <InvoiceDocument saleId={saleId} companyId={companyId} templateType={templateType}>
      {({ document, template }) =>
        templateType === 'Thermal' ? (
          <ThermalInvoiceTemplate
            document={document}
            template={template}
            formatCurrency={formatCurrency}
            paperSize={thermalPaperSize}
            onPrint={handlePrint}
            onClose={onClose}
            actionChildren={actionChildren}
          />
        ) : (
          <A4InvoiceTemplate
            document={document}
            template={template}
            formatCurrency={formatCurrency}
            onPrint={handlePrint}
            onClose={onClose}
            actionChildren={actionChildren}
          />
        )
      }
    </InvoiceDocument>
  );
};
