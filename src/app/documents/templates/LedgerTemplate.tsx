/**
 * Ledger Statement — unified document engine.
 * Columns: Date, Doc No, Description, Debit, Credit, Balance. Uses printing_settings for header/footer.
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';

export interface LedgerLine {
  date: string;
  docNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerDocument {
  companyName: string;
  companyAddress?: string | null;
  partyName: string;
  statementNo?: string;
  period?: string;
  lines: LedgerLine[];
  closingBalance: number;
}

export interface LedgerTemplateOptions {
  showCompanyAddress: boolean;
  showNotes: boolean;
  showSignature: boolean;
  logoUrl?: string | null;
}

export interface LedgerTemplateProps {
  document: LedgerDocument;
  options: LedgerTemplateOptions;
  formatCurrency: (n: number) => string;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const LedgerTemplate: React.FC<LedgerTemplateProps> = ({
  document: doc,
  options,
  formatCurrency,
  onPrint,
  onClose,
  actionChildren,
}) => {
  const headerMeta = [
    { label: 'Statement', value: doc.statementNo || '—' },
    { label: 'Period', value: doc.period || '—' },
  ];

  return (
    <ClassicPrintBase
      documentTitle="LEDGER STATEMENT"
      companyName={doc.companyName}
      logoUrl={options.logoUrl ?? undefined}
      headerMeta={headerMeta}
      onPrint={onPrint}
      onClose={onClose}
      printerMode="a4"
      showActions={true}
      actionChildren={actionChildren}
    >
      {options.showCompanyAddress && doc.companyAddress && (
        <div className="classic-print-section" style={{ marginBottom: '12px', fontSize: '11px', color: '#6b7280' }}>
          {doc.companyAddress}
        </div>
      )}
      <div className="classic-print-section" style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Party: {doc.partyName}</p>
      </div>

      <table className="classic-print-table">
        <thead>
          <tr>
            <th className="text-left">Date</th>
            <th className="text-left">Doc No</th>
            <th className="text-left">Description</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
            <th className="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((row, i) => (
            <tr key={i}>
              <td style={{ fontSize: '11px' }}>{row.date}</td>
              <td style={{ fontSize: '11px' }}>{row.docNo}</td>
              <td style={{ fontSize: '11px' }}>{row.description}</td>
              <td className="text-right classic-print-currency" style={{ fontSize: '11px' }}>{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
              <td className="text-right classic-print-currency" style={{ fontSize: '11px' }}>{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
              <td className="text-right classic-print-currency font-medium" style={{ fontSize: '11px' }}>{formatCurrency(row.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="classic-print-totals">
        <div className="classic-print-totals-inner">
          <div className="classic-print-totals-row total">
            <span className="classic-print-totals-label">Closing Balance</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.closingBalance)}</span>
          </div>
        </div>
      </div>

      {options.showNotes && (
        <div className="classic-print-section" style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', fontSize: '11px' }}>
          <p className="text-gray-600">This is a computer-generated statement. Please contact us for any queries.</p>
        </div>
      )}

      {options.showSignature && (
        <div className="classic-print-section" style={{ marginTop: '24px', textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '8px', display: 'inline-block' }}>Authorized Signature</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
