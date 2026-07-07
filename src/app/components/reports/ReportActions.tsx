import React from 'react';
import { Button } from "../ui/button";
import { Printer, FileText, FileSpreadsheet, MessageCircle } from 'lucide-react';
import { cn } from "../ui/utils";
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';
import type { DocumentType } from '@/app/services/pdfExportService';

interface ReportActionsProps {
  title?: string;
  onPrint?: () => void;
  onPdf?: () => void;
  /** When set, PDF button opens WYSIWYG preview instead of onPdf. */
  onOpenPdfPreview?: () => void;
  /** When set, Preview button uses this instead of cloning previewContentRef directly. */
  onPreview?: () => void;
  onExcel?: () => void;
  onCsv?: () => void;
  onWhatsapp?: () => void;
  className?: string;
  /** When set with previewContentRef, shows WYSIWYG PDF preview before print. */
  previewContentRef?: React.RefObject<HTMLElement | null>;
  previewDocumentType?: DocumentType;
  previewReference?: string;
  /** Reports always A4; defaults to a4. */
  previewFormat?: 'a4' | 'thermal';
  pdfLoading?: boolean;
}

export const ReportActions = ({ 
  title, 
  onPrint = () => window.print(), 
  onPdf, 
  onOpenPdfPreview,
  onPreview,
  onExcel, 
  onCsv,
  onWhatsapp,
  className,
  previewContentRef,
  previewDocumentType = 'ledger',
  previewReference,
  previewFormat = 'a4',
  pdfLoading,
}: ReportActionsProps) => {
  const handlePdf = onOpenPdfPreview ?? onPdf;
  const handlePrint = onOpenPdfPreview ?? onPrint ?? (() => window.print());
  const handlePreview = onPreview ?? onOpenPdfPreview;
  const showLegacyPreview = Boolean(previewContentRef && previewDocumentType && !handlePreview);
  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between bg-card/95 backdrop-blur-sm border-b border-border p-4 mb-6 gap-4", className)}>
      {title && (
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="text-blue-500" size={20} />
          {title}
        </h3>
      )}
      
      <div className="flex flex-wrap items-center gap-2">
        {showLegacyPreview && previewContentRef && (
          <DocumentPreviewButton
            contentRef={previewContentRef}
            documentType={previewDocumentType}
            reference={previewReference}
            format={previewFormat}
            label="Preview"
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
          />
        )}
        {handlePreview && !showLegacyPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={pdfLoading}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
          >
            <FileText size={16} />
            <span className="hidden sm:inline">{pdfLoading ? 'Loading…' : 'Preview'}</span>
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handlePrint}
          disabled={pdfLoading}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
        >
          <Printer size={16} />
          <span className="hidden sm:inline">{pdfLoading ? 'Loading…' : 'Print'}</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handlePdf}
          disabled={!handlePdf || pdfLoading}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
        >
          <FileText size={16} className="text-red-400" />
          <span className="hidden sm:inline">{pdfLoading ? 'Loading…' : 'PDF'}</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onExcel}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
        >
          <FileSpreadsheet size={16} className="text-[var(--erp-money-positive)]" />
          <span className="hidden sm:inline">Excel</span>
        </Button>

        {onCsv && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCsv}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
          >
            <FileText size={16} className="text-cyan-400" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        )}
        
        {onWhatsapp ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onWhatsapp}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
          >
            <MessageCircle size={16} className="text-green-500" />
            <span className="hidden sm:inline">WhatsApp</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
};
