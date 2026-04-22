'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { PdfPreviewModal } from './PdfPreviewModal';
import type { DocumentType } from '@/app/services/pdfExportService';

export interface DocumentPreviewButtonProps {
  contentRef: React.RefObject<HTMLElement | null>;
  documentType: DocumentType;
  reference?: string;
  sharePhone?: string | null;
  format?: 'a4' | 'thermal';
  label?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
}

/**
 * Tiny helper button that opens the shared PdfPreviewModal for any already-rendered
 * document (Quotation, Ledger, Receipt, Packing List, Courier Slip, …). The modal
 * deep-clones the referenced element so the preview is always WYSIWYG.
 */
export const DocumentPreviewButton: React.FC<DocumentPreviewButtonProps> = ({
  contentRef,
  documentType,
  reference,
  sharePhone,
  format = 'a4',
  label = 'Preview',
  size,
  variant = 'outline',
  className,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className ?? 'flex items-center gap-2'}
        onClick={() => setOpen(true)}
      >
        <Eye size={16} />
        {label}
      </Button>
      <PdfPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        title={reference ? `${documentType} ${reference}` : documentType}
        documentType={documentType}
        reference={reference}
        format={format}
        sharePhone={sharePhone}
        cloneFromRef={contentRef}
      />
    </>
  );
};

export default DocumentPreviewButton;
