/**
 * ClassicPrintBase - Single Source of Truth for ALL Print Layouts
 * 
 * RULE: All print components MUST use this base component.
 * No print component is allowed to define its own fonts or table styles.
 * 
 * Usage:
 * <ClassicPrintBase
 *   documentTitle="INVOICE"
 *   companyName="Din Collection"
 *   logoUrl={optional}
 *   headerMeta={[...]}
 *   onPrint={handlePrint}
 *   onClose={onClose}
 * >
 *   {/* Your print content here *\/}
 * </ClassicPrintBase>
 */

import React from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '../ui/button';

export interface ClassicPrintBaseProps {
  documentTitle: string;
  companyName?: string;
  logoUrl?: string;
  headerMeta?: Array<{ label: string; value: string }>;
  children: React.ReactNode;
  onPrint?: () => void;
  onClose?: () => void;
  showActions?: boolean;
}

export const ClassicPrintBase: React.FC<ClassicPrintBaseProps> = ({
  documentTitle,
  companyName = 'Din Collection',
  logoUrl,
  headerMeta = [],
  children,
  onPrint,
  onClose,
  showActions = true,
}) => {
  const handlePrint = () => {
    window.print();
    if (onPrint) onPrint();
  };

  return (
    <div className="classic-print-base">
      <style>{`
        /* ============================================
           CLASSIC PRINT BASE - GLOBAL STYLES
           Single source of truth for ALL prints
           ============================================ */
        
        @media print {
          body * {
            visibility: hidden;
          }
          .classic-print-base, .classic-print-base * {
            visibility: visible;
          }
          .classic-print-base {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            color: black;
          }
          .classic-print-actions {
            display: none;
          }
        }
        
        @media screen {
          .classic-print-base {
            background: white;
            color: black;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
        }
        
        /* ============================================
           FONTS - STANDARDIZED ACROSS ALL PRINTS
           ============================================ */
        .classic-print-base {
          font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #000000;
        }
        
        .classic-print-header {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .classic-print-company {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 8px;
        }
        
        .classic-print-title {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 12px 0 16px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .classic-print-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 11px;
          color: #6b7280;
          margin-top: 12px;
        }
        
        .classic-print-meta-item {
          display: flex;
          gap: 4px;
        }
        
        .classic-print-meta-label {
          font-weight: 600;
          color: #374151;
        }
        
        .classic-print-meta-value {
          color: #111827;
        }
        
        /* ============================================
           TABLES - STANDARDIZED ACROSS ALL PRINTS
           ============================================ */
        .classic-print-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 11px;
        }
        
        .classic-print-table thead {
          background-color: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .classic-print-table th {
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .classic-print-table th.text-right {
          text-align: right;
        }
        
        .classic-print-table th.text-center {
          text-align: center;
        }
        
        .classic-print-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #111827;
        }
        
        .classic-print-table td.text-right {
          text-align: right;
        }
        
        .classic-print-table td.text-center {
          text-align: center;
        }
        
        .classic-print-table tbody tr:hover {
          background-color: #f9fafb;
        }
        
        /* SKU styling - balanced, not oversized */
        .classic-print-sku {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: #6b7280;
          background-color: #f9fafb;
          padding: 2px 6px;
          border-radius: 3px;
          display: inline-block;
        }
        
        /* Currency formatting */
        .classic-print-currency {
          font-family: 'Courier New', monospace;
          font-weight: 600;
          color: #111827;
        }
        
        /* ============================================
           SECTIONS - STANDARDIZED SPACING
           ============================================ */
        .classic-print-section {
          margin: 24px 0;
        }
        
        .classic-print-section-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        /* ============================================
           TOTALS - STANDARDIZED FORMATTING
           ============================================ */
        .classic-print-totals {
          margin-top: 24px;
          display: flex;
          justify-content: flex-end;
        }
        
        .classic-print-totals-inner {
          width: 280px;
        }
        
        .classic-print-totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 11px;
        }
        
        .classic-print-totals-row.total {
          border-top: 2px solid #111827;
          border-bottom: 2px solid #111827;
          padding: 12px 0;
          font-size: 14px;
          font-weight: 700;
          margin-top: 4px;
        }
        
        .classic-print-totals-label {
          color: #374151;
        }
        
        .classic-print-totals-value {
          font-weight: 600;
          color: #111827;
        }
        
        /* ============================================
           FOOTER - STANDARDIZED
           ============================================ */
        .classic-print-footer {
          margin-top: 32px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 10px;
          color: #6b7280;
        }
        
        /* ============================================
           ACTIONS - HIDDEN IN PRINT
           ============================================ */
        .classic-print-actions {
          margin-bottom: 24px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        
        @media print {
          .classic-print-actions {
            display: none;
          }
        }
      `}</style>

      <div className="classic-print-base">
        {/* Actions - Hidden when printing */}
        {showActions && (
          <div className="classic-print-actions">
            {onPrint && (
              <Button
                onClick={handlePrint}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Printer size={16} className="mr-2" />
                Print
              </Button>
            )}
            {onClose && (
              <Button
                onClick={onClose}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                <X size={16} className="mr-2" />
                Close
              </Button>
            )}
          </div>
        )}

        {/* Header - Fixed for all prints */}
        <header className="classic-print-header">
          {logoUrl && (
            <div style={{ marginBottom: '12px' }}>
              <img src={logoUrl} alt={companyName} style={{ maxHeight: '60px' }} />
            </div>
          )}
          <div className="classic-print-company">{companyName}</div>
          <h1 className="classic-print-title">{documentTitle}</h1>
          {headerMeta.length > 0 && (
            <div className="classic-print-meta">
              {headerMeta.map((meta, index) => (
                <div key={index} className="classic-print-meta-item">
                  <span className="classic-print-meta-label">{meta.label}:</span>
                  <span className="classic-print-meta-value">{meta.value}</span>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* Content - Provided by child components */}
        <div className="classic-print-content">
          {children}
        </div>

        {/* Footer - Fixed for all prints */}
        <footer className="classic-print-footer">
          <p>Thank you for your business!</p>
          <p style={{ marginTop: '4px' }}>Generated on {new Date().toLocaleString()}</p>
        </footer>
      </div>
    </div>
  );
};
