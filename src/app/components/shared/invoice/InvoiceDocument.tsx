/**
 * Phase A: Data-only layer for invoice.
 * Fetches document (RPC) + template (invoice_templates) and passes to children.
 * No layout; single source for Print A4, Print Thermal, Download PDF, Share PDF.
 */
import React from 'react';
import { useInvoiceDocument } from '@/app/hooks/useInvoiceDocument';
import type { InvoiceTemplateType } from '@/app/types/invoiceDocument';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';

export interface InvoiceDocumentProps {
  saleId: string | null;
  companyId: string | null;
  templateType: InvoiceTemplateType;
  children: (props: {
    document: import('@/app/types/invoiceDocument').InvoiceDocument;
    template: import('@/app/types/invoiceDocument').InvoiceTemplate;
  }) => React.ReactNode;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  saleId,
  companyId,
  templateType,
  children,
}) => {
  const { document, template, loading, error } = useInvoiceDocument(saleId, companyId, templateType);

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

  if (!document || !template) {
    return (
      <div className="p-4 text-sm text-gray-600">
        No invoice data available.
      </div>
    );
  }

  return <>{children({ document, template })}</>;
};
