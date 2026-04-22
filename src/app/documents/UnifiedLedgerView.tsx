/**
 * Unified document engine: Ledger Statement.
 * Renders LedgerTemplate with document data and options from printing_settings.
 */
import React, { useRef } from 'react';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { resolveDocumentOptions } from './resolveOptions';
import { LedgerTemplate } from './templates/LedgerTemplate';
import type { LedgerDocument } from './templates/LedgerTemplate';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';

export interface UnifiedLedgerViewProps {
  document: LedgerDocument | null;
  companyId: string | null;
  onClose?: () => void;
  showPrintAction?: boolean;
}

export const UnifiedLedgerView: React.FC<UnifiedLedgerViewProps> = ({
  document: doc,
  companyId,
  onClose,
  showPrintAction = true,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const { settings, loading, error } = useUnifiedDocumentSettings(companyId, 'ledger_statement');
  const resolved = settings ? resolveDocumentOptions(settings, 'ledger_statement') : null;
  const options = resolved ? {
    showCompanyAddress: resolved.ledger.showCompanyAddress,
    showNotes: resolved.ledger.showNotes,
    showSignature: resolved.ledger.showSignature,
    logoUrl: resolved.ledger.logoUrl,
  } : null;

  const contentRef = useRef<HTMLDivElement>(null);
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
        No ledger data or printing settings available.
      </div>
    );
  }

  const actionChildren = showPrintAction ? (
    <div className="flex gap-2 no-print">
      <DocumentPreviewButton
        contentRef={contentRef}
        documentType="ledger"
        reference={doc.statementNo}
      />
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
    <div ref={contentRef}>
      <LedgerTemplate
        document={doc}
        options={options}
        formatCurrency={formatCurrency}
        onPrint={handlePrint}
        onClose={onClose}
        actionChildren={actionChildren}
      />
    </div>
  );
};
