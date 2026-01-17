import React from 'react';
import { Button } from "../ui/button";
import { Printer, FileText, FileSpreadsheet, MessageCircle, Share2 } from 'lucide-react';
import { cn } from "../ui/utils";

interface ReportActionsProps {
  title?: string;
  onPrint?: () => void;
  onPdf?: () => void;
  onExcel?: () => void;
  onWhatsapp?: () => void;
  className?: string;
}

export const ReportActions = ({ 
  title, 
  onPrint = () => window.print(), 
  onPdf, 
  onExcel, 
  onWhatsapp,
  className 
}: ReportActionsProps) => {
  return (
    <div 
      className={cn("sticky top-0 z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between backdrop-blur-sm border-b p-4 mb-6 gap-4", className)}
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderBottomColor: 'var(--color-border-primary)'
      }}
    >
      {title && (
        <h3 
          className="text-lg font-bold flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <FileText size={20} style={{ color: 'var(--color-primary)' }} />
          {title}
        </h3>
      )}
      
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPrint}
          className="gap-2"
          style={{
            borderColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Printer size={16} />
          <span className="hidden sm:inline">Print</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPdf}
          className="gap-2"
          style={{
            borderColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <FileText size={16} style={{ color: 'var(--color-error)' }} />
          <span className="hidden sm:inline">PDF</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onExcel}
          className="gap-2"
          style={{
            borderColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <FileSpreadsheet size={16} style={{ color: 'var(--color-success)' }} />
          <span className="hidden sm:inline">Excel</span>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onWhatsapp}
          className="gap-2"
          style={{
            borderColor: 'var(--color-border-secondary)',
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <MessageCircle size={16} style={{ color: 'var(--color-success)' }} />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
      </div>
    </div>
  );
};
