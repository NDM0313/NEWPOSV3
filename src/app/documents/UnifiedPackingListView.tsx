/**
 * Unified document engine: Packing List (Wholesale workflow).
 * Renders PackingListTemplate with document data and options from printing_settings.
 */
import React, { useRef } from 'react';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { resolveDocumentOptions } from './resolveOptions';
import { PackingListTemplate } from './templates/PackingListTemplate';
import type { PackingListDocument } from './templates/PackingListTemplate';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';

export interface UnifiedPackingListViewProps {
  document: PackingListDocument | null;
  companyId: string | null;
  onClose?: () => void;
  showPrintAction?: boolean;
}

export const UnifiedPackingListView: React.FC<UnifiedPackingListViewProps> = ({
  document: doc,
  companyId,
  onClose,
  showPrintAction = true,
}) => {
  const { settings, loading, error } = useUnifiedDocumentSettings(companyId, 'packing_list');
  const resolved = settings ? resolveDocumentOptions(settings, 'packing_list') : null;
  const options = resolved ? {
    showSku: resolved.packingList.showSku,
    showCompanyAddress: resolved.packingList.showCompanyAddress,
    showNotes: resolved.packingList.showNotes,
    showSignature: resolved.packingList.showSignature,
    logoUrl: resolved.packingList.logoUrl,
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
        No packing list data or printing settings available.
      </div>
    );
  }

  const actionChildren = showPrintAction ? (
    <div className="flex gap-2 no-print">
      <DocumentPreviewButton contentRef={contentRef} documentType="packing_list" reference={doc.orderNo} />
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
      <PackingListTemplate
        document={doc}
        options={options}
        onPrint={handlePrint}
        onClose={onClose}
        actionChildren={actionChildren}
      />
    </div>
  );
};
