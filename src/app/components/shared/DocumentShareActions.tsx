/**
 * Document Share: Preview → Print / Download PDF / WhatsApp / Email.
 * Use with unified document views; pass contentRef pointing to the printable root (e.g. ClassicPrintBase).
 * Clicking "Preview" or "Download PDF" opens `PdfPreviewModal` so the user always sees the
 * rendered document before anything is shared or printed.
 */

import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Printer, Download, MessageCircle, Mail, X, ChevronDown, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { documentShareService } from '@/app/services/documentShareService';
import type { DocumentType } from '@/app/services/pdfExportService';
import { PdfPreviewModal } from './PdfPreviewModal';

export interface DocumentShareActionsProps {
  /** Ref to the printable DOM element (e.g. ClassicPrintBase root). */
  contentRef: React.RefObject<HTMLDivElement | null>;
  documentType: DocumentType;
  reference?: string;
  /** Customer/contact phone for WhatsApp (optional). */
  sharePhone?: string | null;
  /** A4 or thermal - affects PDF layout. */
  format?: 'a4' | 'thermal';
  onPrint?: () => void;
  onClose?: () => void;
  showPrint?: boolean;
  showClose?: boolean;
}

export const DocumentShareActions: React.FC<DocumentShareActionsProps> = ({
  contentRef,
  documentType,
  reference,
  sharePhone,
  format = 'a4',
  onPrint,
  onClose,
  showPrint = true,
  showClose = true,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownloadPdf = async () => {
    if (!contentRef?.current) return;
    setDownloading(true);
    try {
      await documentShareService.downloadAsPdf(contentRef.current, {
        documentType,
        reference,
        title: reference ? `${documentType} ${reference}` : documentType,
        format,
      });
    } finally {
      setDownloading(false);
    }
  };

  const shareMessage = documentShareService.buildShareMessage({
    documentType,
    reference,
    title: reference ? `${documentType} ${reference}` : undefined,
  });

  const handleWhatsApp = () => {
    documentShareService.shareViaWhatsApp(shareMessage, sharePhone);
  };

  const handleEmail = () => {
    const subject = reference ? `${documentType} ${reference}` : documentType;
    documentShareService.shareViaEmail(subject, shareMessage);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => setPreviewOpen(true)}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Eye size={16} />
        Preview
      </Button>
      {showPrint && (
        <Button
          onClick={onPrint}
          className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
        >
          <Printer size={16} />
          Print
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            disabled={downloading}
          >
            <Download size={16} />
            {downloading ? 'Preparing…' : 'Share'}
            <ChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleDownloadPdf} disabled={downloading}>
            <Download size={14} className="mr-2" />
            Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleWhatsApp}>
            <MessageCircle size={14} className="mr-2" />
            Share via WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEmail}>
            <Mail size={14} className="mr-2" />
            Share via Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {showClose && onClose && (
        <Button onClick={onClose} variant="secondary" className="flex items-center gap-2">
          <X size={16} />
          Close
        </Button>
      )}

      <PdfPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={reference ? `${documentType} ${reference}` : documentType}
        documentType={documentType}
        reference={reference}
        format={format}
        sharePhone={sharePhone}
        cloneFromRef={contentRef}
      />
    </div>
  );
};
