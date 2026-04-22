import React from 'react';
import { Button } from "../ui/button";
import { Printer, FileText, FileSpreadsheet, MessageCircle, Share2 } from 'lucide-react';
import { cn } from "../ui/utils";
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';
import type { DocumentType } from '@/app/services/pdfExportService';

interface ReportActionsProps {
  title?: string;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  onCsv?: () => void;
  onWhatsapp?: () => void;
  className?: string;
  /** When set with previewContentRef, shows WYSIWYG PDF preview before print. */
  previewContentRef?: React.RefObject<HTMLElement | null>;
  previewDocumentType?: DocumentType;
  previewReference?: string;
}

export const ReportActions = ({ 
  title, 
  onPrint = () => window.print(), 
  onPdf, 
  onExcel, 
  onCsv,
  onWhatsapp,
  className,
  previewContentRef,
  previewDocumentType = 'ledger',
  previewReference,
}: ReportActionsProps) => {
  const showPreview = Boolean(previewContentRef && previewDocumentType);
  return (
    <div className={cn("sticky top-0 z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 p-4 mb-6 gap-4", className)}>
      {title && (
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="text-blue-500" size={20} />
          {title}
        </h3>
      )}
      
      <div className="flex flex-wrap items-center gap-2">
        {showPreview && previewContentRef && (
          <DocumentPreviewButton
            contentRef={previewContentRef}
            documentType={previewDocumentType}
            reference={previewReference}
            label="Preview"
            className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2"
          />
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPrint}
          className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2"
        >
          <Printer size={16} />
          <span className="hidden sm:inline">Print</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPdf}
          className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2"
        >
          <FileText size={16} className="text-red-400" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onExcel}
          className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2"
        >
          <FileSpreadsheet size={16} className="text-green-400" />
          <span className="hidden sm:inline">Excel</span>
        </Button>

        {onCsv && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCsv}
            className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2"
          >
            <FileText size={16} className="text-cyan-400" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onWhatsapp}
          className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 gap-2"
        >
          <MessageCircle size={16} className="text-green-500" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
      </div>
    </div>
  );
};
