/**
 * Phase A: A4 invoice layout. Single source for invoice content; uses document + template.
 * Uses ClassicPrintBase; no duplicate layout.
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';
import { useSettings } from '@/app/context/SettingsContext';
import type { InvoiceDocument, InvoiceTemplate } from '@/app/types/invoiceDocument';
import { formatPackingFromItem } from './formatPackingFromDocument';

export interface A4InvoiceTemplateProps {
  document: InvoiceDocument;
  template: InvoiceTemplate;
  formatCurrency: (n: number) => string;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const A4InvoiceTemplate: React.FC<A4InvoiceTemplateProps> = ({
  document: doc,
  template,
  formatCurrency,
  onPrint,
  onClose,
  actionChildren,
}) => {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking ?? false;

  const headerMeta = [
    { label: 'Invoice No', value: doc.meta.invoice_no },
    { label: 'Date', value: new Date(doc.meta.invoice_date).toLocaleDateString() },
    { label: 'Type', value: doc.meta.type === 'quotation' ? 'Quotation' : 'Invoice' },
    ...(doc.meta.fiscal_period ? [{ label: 'Fiscal Period', value: doc.meta.fiscal_period }] : []),
  ];

  return (
    <ClassicPrintBase
      documentTitle="INVOICE"
      companyName={doc.company.name}
      logoUrl={template.logo_url ?? undefined}
      headerMeta={headerMeta}
      onPrint={onPrint}
      onClose={onClose}
      printerMode="a4"
      showActions={true}
      actionChildren={actionChildren}
    >
      <div className="classic-print-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Bill To:</h3>
            <p style={{ fontSize: '11px', marginBottom: '4px' }}>{doc.customer.name}</p>
            {doc.customer.contact_number && <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{doc.customer.contact_number}</p>}
            {doc.customer.address && <p style={{ fontSize: '11px', color: '#6b7280' }}>{doc.customer.address}</p>}
          </div>
        </div>
      </div>

      <table className="classic-print-table">
        <thead>
          <tr>
            <th>Product</th>
            {template.show_sku && <th>SKU</th>}
            {enablePacking && <th>Packing</th>}
            <th className="text-right">Qty</th>
            <th>Unit</th>
            <th className="text-right">Price</th>
            {template.show_discount && <th className="text-right">Disc.</th>}
            {template.show_tax && <th className="text-right">Tax</th>}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={item.id || index}>
              <td>
                <div>{item.product_name}</div>
              </td>
              {template.show_sku && (
                <td>
                  <span className="classic-print-sku">{item.sku}</span>
                </td>
              )}
              {enablePacking && <td style={{ fontSize: '11px' }}>{formatPackingFromItem(item)}</td>}
              <td className="text-right">{Number(item.quantity).toFixed(2)}</td>
              <td>{item.unit}</td>
              <td className="text-right classic-print-currency">{formatCurrency(item.unit_price)}</td>
              {template.show_discount && <td className="text-right classic-print-currency">{formatCurrency(item.discount_amount)}</td>}
              {template.show_tax && <td className="text-right classic-print-currency">{formatCurrency(item.tax_amount)}</td>}
              <td className="text-right classic-print-currency">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="classic-print-totals">
        <div className="classic-print-totals-inner">
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Subtotal:</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.subtotal)}</span>
          </div>
          {template.show_discount && doc.totals.discount > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Discount:</span>
              <span className="classic-print-totals-value classic-print-currency">- {formatCurrency(doc.totals.discount)}</span>
            </div>
          )}
          {template.show_tax && doc.totals.tax > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Tax:</span>
              <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.tax)}</span>
            </div>
          )}
          {doc.totals.expenses > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Shipping/Other:</span>
              <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.expenses)}</span>
            </div>
          )}
          <div className="classic-print-totals-row total">
            <span className="classic-print-totals-label">Total:</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.total)}</span>
          </div>
          {template.show_studio && doc.totals.studio_charges > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Studio Cost:</span>
              <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.studio_charges)}</span>
            </div>
          )}
          {template.show_studio && doc.totals.studio_charges > 0 && (
            <div className="classic-print-totals-row total">
              <span className="classic-print-totals-label">Grand Total:</span>
              <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.grand_total)}</span>
            </div>
          )}
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Paid:</span>
            <span className="classic-print-totals-value" style={{ color: '#059669' }}>{formatCurrency(doc.totals.paid)}</span>
          </div>
          {doc.totals.due > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Due:</span>
              <span className="classic-print-totals-value" style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(doc.totals.due)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="classic-print-section">
        <p style={{ fontSize: '11px', marginBottom: '4px' }}>
          <strong>Payment Status:</strong> {doc.meta.payment_status === 'paid' ? 'Paid' : doc.meta.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
        </p>
      </div>

      {doc.meta.notes && (
        <div className="classic-print-section" style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Notes:</p>
          <p style={{ fontSize: '11px', color: '#374151' }}>{doc.meta.notes}</p>
        </div>
      )}

      {template.show_signature && (
        <div className="classic-print-section" style={{ marginTop: '32px' }}>
          <p style={{ fontSize: '11px', color: '#6b7280' }}>Authorized Signature</p>
        </div>
      )}

      {template.footer_note && (
        <div className="classic-print-section" style={{ marginTop: '16px', padding: '12px', borderTop: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: '10px', color: '#6b7280' }}>{template.footer_note}</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
