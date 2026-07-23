import React from 'react';

export interface ReportBrandFooterProps {
  currentPage?: number;
  totalPages?: number;
  compact?: boolean;
}

/**
 * Tabular report footer — page numbers only (no company contact repeat).
 * Excluded from PDF canvas capture; page numbers are stamped per sheet in pdfExportService.
 */
export const ReportBrandFooter: React.FC<ReportBrandFooterProps> = ({
  currentPage = 1,
  totalPages = 1,
  compact = false,
}) => (
  <div
    data-exclude-from-pdf-capture
    className="report-page-footer"
    style={{
      marginTop: compact ? 10 : 16,
      paddingTop: compact ? 6 : 10,
      borderTop: '1px solid #ccc',
      textAlign: 'center',
      fontSize: compact ? 8 : 9,
      color: '#555',
      lineHeight: 1.4,
    }}
  >
    Page {currentPage} of {totalPages}
  </div>
);
