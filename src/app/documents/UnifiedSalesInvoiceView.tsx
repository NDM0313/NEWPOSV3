/**
 * Unified document engine: Sales Invoice.
 * Reads layout/fields from company printing_settings (Settings → Printing).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoiceDocumentService } from '@/app/services/invoiceDocumentService';
import type { InvoiceDocument } from '@/app/types/invoiceDocument';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { A4InvoiceTemplate } from '@/app/components/shared/invoice/A4InvoiceTemplate';
import { ThermalInvoiceTemplate } from '@/app/components/shared/invoice/ThermalInvoiceTemplate';
import { getContactWhatsAppPhone } from '@/app/lib/phoneWhatsApp';
import { DocumentShareActions } from '@/app/components/shared/DocumentShareActions';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useDocumentPrint } from '@/app/hooks/useDocumentPrint';
import { useThermalPrint } from '@/app/hooks/useThermalPrint';
import type { InvoiceTemplateType } from '@/app/types/invoiceDocument';
import type { InvoiceTemplate } from '@/app/types/invoiceDocument';
import type { ResolvedInvoiceTemplate } from './types';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';

function toInvoiceTemplate(
  resolved: ResolvedInvoiceTemplate,
  companyId: string,
  templateType: InvoiceTemplateType
): InvoiceTemplate {
  return {
    id: '',
    company_id: companyId,
    template_type: templateType,
    show_sku: resolved.show_sku,
    show_discount: resolved.show_discount,
    show_tax: resolved.show_tax,
    show_studio: resolved.show_studio,
    show_signature: resolved.show_signature,
    logo_url: resolved.logo_url,
    footer_note: resolved.footer_note,
  };
}

export interface UnifiedSalesInvoiceViewProps {
  saleId?: string | null;
  document?: InvoiceDocument | null;
  companyId: string | null;
  templateType: InvoiceTemplateType;
  onClose?: () => void;
  showPrintAction?: boolean;
  /** Override saved paper size when set. */
  thermalPaperSize?: '58mm' | '80mm';
}

export const UnifiedSalesInvoiceView: React.FC<UnifiedSalesInvoiceViewProps> = ({
  saleId = null,
  document: documentProp,
  companyId,
  templateType,
  onClose,
  showPrintAction = true,
  thermalPaperSize: thermalPaperSizeProp,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const { printThermal } = useThermalPrint();
  const { runDocumentPrint } = useDocumentPrint();
  const [document, setDocument] = useState<InvoiceDocument | null>(documentProp ?? null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const loadDocument = useCallback(async () => {
    if (documentProp != null) {
      setDocument(documentProp);
      setDocError(null);
      return;
    }
    if (!saleId) {
      setDocument(null);
      setDocError(null);
      return;
    }
    setDocLoading(true);
    setDocError(null);
    try {
      const res = await invoiceDocumentService.getDocument(saleId);
      if (res.error) {
        setDocError(res.error);
        setDocument(null);
      } else {
        setDocument(res.data);
      }
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'Failed to load invoice');
      setDocument(null);
    } finally {
      setDocLoading(false);
    }
  }, [saleId, documentProp]);

  useEffect(() => {
    if (documentProp != null) {
      setDocument(documentProp);
      setDocLoading(false);
      setDocError(null);
      return;
    }
    loadDocument();
  }, [loadDocument, documentProp]);

  const printContentRef = useRef<HTMLDivElement | null>(null);
  const { resolvedInvoice, merged, showLogo, loading: settingsLoading, error: settingsError } =
    useUnifiedDocumentSettings(companyId, 'sales_invoice');

  const effectivePaperSize =
    thermalPaperSizeProp ?? merged?.thermal.paperSize ?? '58mm';

  const handlePrint = () => {
    if (templateType === 'Thermal') {
      printThermal(effectivePaperSize);
    } else {
      runDocumentPrint(() => window.print());
    }
  };

  const loading = docLoading || settingsLoading;
  const error = docError || settingsError;
  const template = companyId && resolvedInvoice ? toInvoiceTemplate(resolvedInvoice, companyId, templateType) : null;

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
        No invoice data or printing settings available.
      </div>
    );
  }

  const docType = document?.meta?.type === 'quotation' ? 'quotation' : document?.meta?.type === 'proforma' ? 'proforma' : 'sales_invoice';
  const isThermal = templateType === 'Thermal';
  const actionChildren = showPrintAction ? (
    <DocumentShareActions
      contentRef={printContentRef}
      documentType={docType}
      reference={document?.meta?.invoice_no}
      sharePhone={
        document?.customer
          ? getContactWhatsAppPhone({
              phone: (document.customer as { phone?: string }).phone,
              mobile: (document.customer as { mobile?: string }).mobile,
              contact_number: document.customer.contact_number,
            }) || null
          : null
      }
      format={isThermal ? 'thermal' : 'a4'}
      thermalPaperSize={isThermal ? effectivePaperSize : undefined}
      onPrint={handlePrint}
      onClose={onClose}
      showPrint
      showClose={!!onClose}
    />
  ) : undefined;

  return isThermal ? (
    <ThermalInvoiceTemplate
      document={document}
      template={template}
      formatCurrency={formatCurrency}
      paperSize={effectivePaperSize}
      thermal={merged?.thermal}
      onPrint={handlePrint}
      onClose={onClose}
      actionChildren={actionChildren}
      contentRef={printContentRef}
      showLogo={showLogo}
    />
  ) : (
    <A4InvoiceTemplate
      document={document}
      template={template}
      formatCurrency={formatCurrency}
      onPrint={handlePrint}
      onClose={onClose}
      actionChildren={actionChildren}
      contentRef={printContentRef}
      showLogo={showLogo}
    />
  );
};
