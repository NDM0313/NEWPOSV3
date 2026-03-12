/**
 * Quotation — unified document engine (Step 6).
 * Same layout as invoice: company, customer, items, totals. Uses printing_settings.
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';

export interface QuotationDocumentItem {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
}

export interface QuotationDocument {
  companyName: string;
  companyAddress?: string | null;
  customerName: string;
  contactNumber?: string | null;
  address?: string | null;
  quotation_no: string;
  date: string;
  valid_until?: string | null;
  items: QuotationDocumentItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export interface QuotationTemplateOptions {
  showSku: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showSignature: boolean;
  logoUrl?: string | null;
  footerNote?: string | null;
}

export interface QuotationTemplateProps {
  document: QuotationDocument;
  options: QuotationTemplateOptions;
  formatCurrency: (n: number) => string;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const QuotationTemplate: React.FC<QuotationTemplateProps> = ({
  document: doc,
  options,
  formatCurrency,
  onPrint,
  onClose,
  actionChildren,
}) => {
  const headerMeta = [
    { label: 'Quotation No', value: doc.quotation_no },
    { label: 'Date', value: doc.date },
    ...(doc.valid_until ? [{ label: 'Valid Until', value: doc.valid_until }] : []),
  ];

  return (
    <ClassicPrintBase
      documentTitle="QUOTATION"
      companyName={doc.companyName}
      logoUrl={options.logoUrl ?? undefined}
      headerMeta={headerMeta}
      onPrint={onPrint}
      onClose={onClose}
      printerMode="a4"
      showActions={true}
      actionChildren={actionChildren}
    >
      {doc.companyAddress && (
        <div className="classic-print-section" style={{ marginBottom: '12px', fontSize: '11px', color: '#6b7280' }}>
          {doc.companyAddress}
        </div>
      )}

      <div className="classic-print-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Bill To:</h3>
            <p style={{ fontSize: '11px', marginBottom: '4px' }}>{doc.customerName}</p>
            {doc.contactNumber && <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{doc.contactNumber}</p>}
            {doc.address && <p style={{ fontSize: '11px', color: '#6b7280' }}>{doc.address}</p>}
          </div>
        </div>
      </div>

      <table className="classic-print-table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="text-right">Qty</th>
            <th>Unit</th>
            <th className="text-right">Price</th>
            {options.showDiscount && <th className="text-right">Disc.</th>}
            {options.showTax && <th className="text-right">Tax</th>}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={item.id || index}>
              <td style={{ minWidth: '180px' }}>
                <span>{item.product_name}</span>
                {options.showSku && item.sku && (
                  <span className="classic-print-sku" style={{ marginLeft: '6px' }}>{item.sku}</span>
                )}
              </td>
              <td className="text-right">{Number(item.quantity).toFixed(2)}</td>
              <td>{item.unit}</td>
              <td className="text-right classic-print-currency">{formatCurrency(item.unit_price)}</td>
              {options.showDiscount && <td className="text-right classic-print-currency">{formatCurrency(item.discount_amount)}</td>}
              {options.showTax && <td className="text-right classic-print-currency">{formatCurrency(item.tax_amount)}</td>}
              <td className="text-right classic-print-currency">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="classic-print-totals">
        <div className="classic-print-totals-inner">
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Subtotal:</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.subtotal)}</span>
          </div>
          {doc.discount > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Discount:</span>
              <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.discount)}</span>
            </div>
          )}
          {doc.tax > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Tax:</span>
              <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.tax)}</span>
            </div>
          )}
          <div className="classic-print-totals-row" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '8px', fontWeight: 600 }}>
            <span className="classic-print-totals-label">Total:</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.total)}</span>
          </div>
        </div>
      </div>

      {options.footerNote && (
        <div className="classic-print-section" style={{ marginTop: '16px', fontSize: '11px', color: '#6b7280' }}>
          {options.footerNote}
        </div>
      )}
      {options.showSignature && (
        <div className="classic-print-section" style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '8px' }}>Authorized Signature</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
