/**
 * Unified document engine: Proforma Invoice (Step 6).
 * Quotation in invoice format. Uses same InvoiceDocument + A4InvoiceTemplate with title "PROFORMA INVOICE".
 */
import React from 'react';
import type { InvoiceDocument } from '@/app/types/invoiceDocument';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { resolveInvoiceTemplateFromSettings } from './resolveOptions';
import { A4InvoiceTemplate } from '@/app/components/shared/invoice/A4InvoiceTemplate';
import type { InvoiceTemplate, InvoiceTemplateType } from '@/app/types/invoiceDocument';
import type { ResolvedInvoiceTemplate } from './types';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

export interface UnifiedProformaInvoiceViewProps {
  document: InvoiceDocument | null;
  companyId: string | null;
  onClose?: () => void;
  showPrintAction?: boolean;
}

function toTemplate(resolved: ResolvedInvoiceTemplate, companyId: string): InvoiceTemplate {
  return {
    id: '',
    company_id: companyId,
    template_type: 'A4' as InvoiceTemplateType,
    show_sku: resolved.show_sku,
    show_discount: resolved.show_discount,
    show_tax: resolved.show_tax,
    show_studio: resolved.show_studio,
    show_signature: resolved.show_signature,
    logo_url: resolved.logo_url,
    footer_note: resolved.footer_note,
  };
}

export const UnifiedProformaInvoiceView: React.FC<UnifiedProformaInvoiceViewProps> = ({
  document: doc,
  companyId,
  onClose,
  showPrintAction = true,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const { settings, loading, error } = useUnifiedDocumentSettings(companyId, 'proforma_invoice');
  const resolved = settings ? resolveInvoiceTemplateFromSettings(settings, 'proforma_invoice') : null;
  const template = companyId && resolved ? toTemplate(resolved, companyId) : null;

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!doc || !template) {
    return (
      <div className="p-4 text-sm text-gray-600">
        No proforma data or printing settings available.
      </div>
    );
  }

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
    <A4InvoiceTemplate
      document={{ ...doc, meta: { ...doc.meta, type: 'proforma' } }}
      template={template}
      formatCurrency={formatCurrency}
      onPrint={handlePrint}
      onClose={onClose}
      actionChildren={actionChildren}
      documentTitle="PROFORMA INVOICE"
    />
  );
};
