import React, { useEffect, useRef, useState } from 'react';
import { Button } from "../ui/button";
import { Printer, FileText, FileSpreadsheet, MessageCircle, Columns3 } from 'lucide-react';
import { cn } from "../ui/utils";
import { DocumentPreviewButton } from '@/app/components/shared/DocumentPreviewButton';
import type { DocumentType } from '@/app/services/pdfExportService';
import type { ColumnsManagerConfig } from '@/app/components/ui/list-toolbar';

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
  /** Optional ListToolbar-style column visibility picker (left of Preview). */
  columnsManager?: ColumnsManagerConfig;
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
  columnsManager,
}: ReportActionsProps) => {
  const handlePdf = onOpenPdfPreview ?? onPdf;
  const handlePrint = onOpenPdfPreview ?? onPrint ?? (() => window.print());
  const handlePreview = onPreview ?? onOpenPdfPreview;
  const showLegacyPreview = Boolean(previewContentRef && previewDocumentType && !handlePreview);
  const [columnVisibilityOpen, setColumnVisibilityOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnVisibilityOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnVisibilityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [columnVisibilityOpen]);

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between bg-card/95 backdrop-blur-sm border-b border-border p-4 mb-6 gap-4", className)}>
      {title && (
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="text-blue-500" size={20} />
          {title}
        </h3>
      )}
      
      <div className="flex flex-wrap items-center gap-2">
        {columnsManager ? (
          <div ref={columnsRef} className="relative">
            <Button
              variant="outline"
              onClick={() => setColumnVisibilityOpen(!columnVisibilityOpen)}
              className="h-10 gap-2 bg-popover border-border"
            >
              <Columns3 size={16} />
              Columns
            </Button>

            {columnVisibilityOpen ? (
              <div className="absolute right-0 top-12 w-64 bg-card border border-border rounded-lg shadow-2xl p-4 z-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Show Columns</h3>
                  <button
                    type="button"
                    onClick={columnsManager.onShowAll}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Show All
                  </button>
                </div>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {columnsManager.columns.map((column) => (
                    <label
                      key={column.key}
                      className="flex items-center gap-2 hover:bg-accent/50 p-2 rounded transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={columnsManager.visibleColumns[column.key] !== false}
                        onChange={() => columnsManager.onToggle(column.key)}
                        className="w-4 h-4 rounded bg-muted border-border text-primary focus:ring-ring focus:ring-offset-background cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
