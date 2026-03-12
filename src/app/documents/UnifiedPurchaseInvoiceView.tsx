/**
 * Unified document engine: Purchase Invoice / Purchase Order.
 * Reads layout/fields from company printing_settings. Same flow as Sales.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { purchaseService } from '@/app/services/purchaseService';
import { convertFromSupabasePurchase } from '@/app/context/PurchaseContext';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { purchaseToInvoiceDocument } from './adapters/purchaseToInvoiceDocument';
import { PurchaseInvoiceTemplate } from './templates/PurchaseInvoiceTemplate';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { useSettings } from '@/app/context/SettingsContext';
import type { InvoiceTemplate } from '@/app/types/invoiceDocument';
import type { ResolvedInvoiceTemplate } from './types';
import type { Purchase } from '@/app/context/PurchaseContext';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';

function toInvoiceTemplate(
  resolved: ResolvedInvoiceTemplate,
  companyId: string,
  templateType: 'A4' | 'Thermal'
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

export interface UnifiedPurchaseInvoiceViewProps {
  purchaseId: string | null;
  companyId: string | null;
  templateType?: 'A4' | 'Thermal';
  onClose?: () => void;
  showPrintAction?: boolean;
  thermalPaperSize?: '58mm' | '80mm';
}

export const UnifiedPurchaseInvoiceView: React.FC<UnifiedPurchaseInvoiceViewProps> = ({
  purchaseId,
  companyId,
  templateType = 'A4',
  onClose,
  showPrintAction = true,
  thermalPaperSize = '80mm',
}) => {
  const { formatCurrency } = useFormatCurrency();
  const { company } = useSettings();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPurchase = useCallback(async () => {
    if (!purchaseId) {
      setPurchase(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await purchaseService.getPurchase(purchaseId);
      setPurchase(convertFromSupabasePurchase(data) as Purchase);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load purchase');
      setPurchase(null);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useEffect(() => {
    loadPurchase();
  }, [loadPurchase]);

  const { resolvedInvoice, loading: settingsLoading, error: settingsError } = useUnifiedDocumentSettings(companyId, 'purchase_invoice');

  const loadingCombined = loading || settingsLoading;
  const errorCombined = error || settingsError;
  const template = companyId && resolvedInvoice ? toInvoiceTemplate(resolvedInvoice, companyId, templateType) : null;
  const companyInfo = { id: companyId || '', name: company.businessName || 'Company', address: company.businessAddress || null };
  const document = purchase && companyId ? purchaseToInvoiceDocument(purchase, companyInfo) : null;

  const handlePrint = () => window.print();

  if (loadingCombined) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (errorCombined) {
    return (
      <div className="p-4">
        <ErrorMessage message={errorCombined} />
      </div>
    );
  }

  if (!document || !template) {
    return (
      <div className="p-4 text-sm text-gray-600">
        No purchase data or printing settings available.
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
    <PurchaseInvoiceTemplate
      document={document}
      template={template}
      formatCurrency={formatCurrency}
      onPrint={handlePrint}
      onClose={onClose}
      actionChildren={actionChildren}
      printerMode={templateType === 'Thermal' ? 'thermal' : 'a4'}
      paperSize={thermalPaperSize}
    />
  );
};
