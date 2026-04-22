/**
 * Unified document engine: Courier Slip (Wholesale shipment).
 * Renders CourierSlipTemplate with document data and options from printing_settings.
 */
import React, { useRef } from 'react';
import { useUnifiedDocumentSettings } from './useUnifiedDocumentSettings';
import { resolveDocumentOptions } from './resolveOptions';
import { CourierSlipTemplate } from './templates/CourierSlipTemplate';
import type { CourierSlipDocument } from './templates/CourierSlipTemplate';
import { Button } from '@/app/components/ui/button';
import { Printer, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/app/components/shared/ErrorMessage';
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';

export interface UnifiedCourierSlipViewProps {
  document: CourierSlipDocument | null;
  companyId: string | null;
  onClose?: () => void;
  showPrintAction?: boolean;
}

export const UnifiedCourierSlipView: React.FC<UnifiedCourierSlipViewProps> = ({
  document: doc,
  companyId,
  onClose,
  showPrintAction = true,
}) => {
  const { settings, loading, error } = useUnifiedDocumentSettings(companyId, 'courier_slip');
  const resolved = settings ? resolveDocumentOptions(settings, 'courier_slip') : null;
  const options = resolved ? {
    showCompanyAddress: resolved.courierSlip.showCompanyAddress,
    showNotes: resolved.courierSlip.showNotes,
    logoUrl: resolved.courierSlip.logoUrl,
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
        No courier slip data or printing settings available.
      </div>
    );
  }

  const actionChildren = showPrintAction ? (
    <div className="flex gap-2 no-print">
      <DocumentPreviewButton contentRef={contentRef} documentType="courier_slip" reference={doc.trackingNumber || doc.orderNo} />
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
      <CourierSlipTemplate
        document={doc}
        options={options}
        onPrint={handlePrint}
        onClose={onClose}
        actionChildren={actionChildren}
      />
    </div>
  );
};
