/**
 * Phase A: Thermal (58mm/80mm) invoice layout. Same document engine as A4; compact layout.
 */
import React from 'react';
import { ClassicPrintBase } from '@/app/components/shared/ClassicPrintBase';
import { useSettings } from '@/app/context/SettingsContext';
import type { InvoiceDocument, InvoiceTemplate } from '@/app/types/invoiceDocument';
import type { PaperSize } from '@/app/components/shared/ClassicPrintBase';
import { formatPackingFromItem } from './formatPackingFromDocument';

export interface ThermalInvoiceTemplateProps {
  document: InvoiceDocument;
  template: InvoiceTemplate;
  formatCurrency: (n: number) => string;
  paperSize?: PaperSize;
  onPrint?: () => void;
  onClose?: () => void;
  actionChildren?: React.ReactNode;
}

export const ThermalInvoiceTemplate: React.FC<ThermalInvoiceTemplateProps> = ({
  document: doc,
  template,
  formatCurrency,
  paperSize = '80mm',
  onPrint,
  onClose,
  actionChildren,
}) => {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking ?? false;

  const headerMeta = [
    { label: 'Invoice No', value: doc.meta.invoice_no },
    { label: 'Date', value: new Date(doc.meta.invoice_date).toLocaleDateString() },
  ];

  return (
    <ClassicPrintBase
      documentTitle="INVOICE"
      companyName={doc.company.name}
      logoUrl={template.logo_url ?? undefined}
      headerMeta={headerMeta}
      onPrint={onPrint}
      onClose={onClose}
      printerMode="thermal"
      paperSize={paperSize}
      showActions={true}
      actionChildren={actionChildren}
    >
      <div className="classic-print-section" style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>Bill To:</p>
        <p style={{ fontSize: '10px', marginBottom: '2px' }}>{doc.customer.name}</p>
        {doc.customer.contact_number && <p style={{ fontSize: '9px', color: '#6b7280' }}>{doc.customer.contact_number}</p>}
      </div>

      <table className="classic-print-table" style={{ fontSize: '10px' }}>
        <thead>
          <tr>
            <th>Product</th>
            {template.show_sku && <th>SKU</th>}
            <th className="text-right">Qty</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => (
            <tr key={item.id || index}>
              <td>
                <div>{item.product_name}</div>
                {enablePacking && <div style={{ fontSize: '9px', color: '#6b7280' }}>{formatPackingFromItem(item)}</div>}
              </td>
              {template.show_sku && <td><span className="classic-print-sku">{item.sku}</span></td>}
              <td className="text-right">{Number(item.quantity).toFixed(2)}</td>
              <td className="text-right classic-print-currency">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="classic-print-totals" style={{ marginTop: '12px' }}>
        <div className="classic-print-totals-inner" style={{ width: '100%' }}>
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Subtotal:</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.subtotal)}</span>
          </div>
          {template.show_discount && doc.totals.discount > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Discount:</span>
              <span className="classic-print-totals-value">- {formatCurrency(doc.totals.discount)}</span>
            </div>
          )}
          <div className="classic-print-totals-row total">
            <span className="classic-print-totals-label">Total:</span>
            <span className="classic-print-totals-value classic-print-currency">{formatCurrency(doc.totals.total)}</span>
          </div>
          {template.show_studio && doc.totals.studio_charges > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Studio:</span>
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

      <div className="classic-print-section" style={{ marginTop: '8px', fontSize: '10px' }}>
        <p><strong>Status:</strong> {doc.meta.payment_status === 'paid' ? 'Paid' : doc.meta.payment_status === 'partial' ? 'Partial' : 'Unpaid'}</p>
      </div>

      {template.footer_note && (
        <div className="classic-print-section" style={{ marginTop: '8px', fontSize: '9px', color: '#6b7280' }}>
          <p>{template.footer_note}</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
