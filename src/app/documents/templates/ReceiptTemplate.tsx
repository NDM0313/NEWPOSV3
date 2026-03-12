/**
 * Payment Receipt — unified document engine.
 * Layout: Receipt No, Date, Customer, Amount, Method, Reference, Notes, Signature.
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';

export interface ReceiptDocument {
  companyName: string;
  companyAddress?: string | null;
  receiptNo: string;
  date: string;
  customer: string;
  amount: number;
  method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface ReceiptTemplateOptions {
  showCompanyAddress: boolean;
  showNotes: boolean;
  showSignature: boolean;
  logoUrl?: string | null;
}

export interface ReceiptTemplateProps {
  document: ReceiptDocument;
  options: ReceiptTemplateOptions;
  formatCurrency: (n: number) => string;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({
  document: doc,
  options,
  formatCurrency,
  onPrint,
  onClose,
  actionChildren,
}) => {
  const headerMeta = [
    { label: 'Receipt No', value: doc.receiptNo },
    { label: 'Date', value: doc.date },
  ];

  return (
    <ClassicPrintBase
      documentTitle="PAYMENT RECEIPT"
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
        <p style={{ fontSize: '11px', marginBottom: '4px' }}><strong>Customer:</strong> {doc.customer}</p>
        <p style={{ fontSize: '14px', fontWeight: 700, marginTop: '12px', marginBottom: '4px' }}>Amount: {formatCurrency(doc.amount)}</p>
        <p style={{ fontSize: '11px', marginBottom: '4px' }}><strong>Method:</strong> {doc.method}</p>
        {doc.reference && <p style={{ fontSize: '11px', color: '#6b7280' }}><strong>Reference:</strong> {doc.reference}</p>}
      </div>

      {options.showNotes && doc.notes && (
        <div className="classic-print-section" style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: '#374151' }}>{doc.notes}</p>
        </div>
      )}

      {options.showSignature && (
        <div className="classic-print-section" style={{ marginTop: '32px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>Authorized Signature</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
