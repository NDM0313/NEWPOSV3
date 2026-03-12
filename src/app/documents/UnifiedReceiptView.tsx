/**
 * Unified document engine: Payment Receipt.
 * Renders ReceiptTemplate with document data and options from printing_settings.
 */
import React from 'react';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { resolveDocumentOptions } from './resolveOptions';
import { ReceiptTemplate } from './templates/ReceiptTemplate';
import type { ReceiptDocument } from './templates/ReceiptTemplate';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';

export interface UnifiedReceiptViewProps {
  document: ReceiptDocument | null;
  companyId: string | null;
  onClose?: () => void;
  showPrintAction?: boolean;
}

export const UnifiedReceiptView: React.FC<UnifiedReceiptViewProps> = ({
  document: doc,
  companyId,
  onClose,
  showPrintAction = true,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const { settings, loading, error } = useUnifiedDocumentSettings(companyId, 'payment_receipt');
  const resolved = settings ? resolveDocumentOptions(settings, 'payment_receipt') : null;
  const options = resolved ? {
    showCompanyAddress: resolved.receipt.showCompanyAddress,
    showNotes: resolved.receipt.showNotes,
    showSignature: resolved.receipt.showSignature,
    logoUrl: resolved.receipt.logoUrl,
  } : null;

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

  if (!doc || !options) {
    return (
      <div className="p-4 text-sm text-gray-600">
        No receipt data or printing settings available.
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
    <ReceiptTemplate
      document={doc}
      options={options}
      formatCurrency={formatCurrency}
      onPrint={handlePrint}
      onClose={onClose}
      actionChildren={actionChildren}
    />
  );
};
