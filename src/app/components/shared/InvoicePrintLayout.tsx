import React from 'react';
import { Sale } from '@/app/context/SalesContext';
import { useSettings } from '@/app/context/SettingsContext';
import { ClassicPrintBase } from './ClassicPrintBase';

interface InvoicePrintLayoutProps {
  sale: Sale;
  onClose?: () => void;
}

export const InvoicePrintLayout: React.FC<InvoicePrintLayoutProps> = ({ sale, onClose }) => {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;

  const headerMeta = [
    { label: 'Invoice No', value: sale.invoiceNo },
    { label: 'Date', value: new Date(sale.date).toLocaleDateString() },
    { label: 'Type', value: sale.type === 'invoice' ? 'Invoice' : 'Quotation' },
  ];

  return (
    <ClassicPrintBase
      documentTitle="INVOICE"
      companyName="Din Collection"
      headerMeta={headerMeta}
      onPrint={() => window.print()}
      onClose={onClose}
    >
      {/* Invoice Details */}
      <div className="classic-print-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Bill To:</h3>
            <p style={{ fontSize: '11px', marginBottom: '4px' }}>{sale.customerName}</p>
            {sale.contactNumber && <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{sale.contactNumber}</p>}
            {sale.location && <p style={{ fontSize: '11px', color: '#6b7280' }}>{sale.location}</p>}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="classic-print-table">
        <thead>
          <tr>
            <th>Product</th>
            {enablePacking && <th>Packing</th>}
            <th className="text-right">Qty</th>
            <th>Unit</th>
            <th className="text-right">Price</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => {
            // Packing details - structured Boxes + Pieces
            const pd = (item as any).packingDetails || {};
            const totalBoxes = pd.total_boxes ?? 0;
            const totalPieces = pd.total_pieces ?? 0;
            const packingParts: string[] = [];
            if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
            if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
            const packingText = packingParts.length ? packingParts.join(', ') : '—';
            const unit = (item as any).unit || 'pcs';
            const qty = item.quantity || 0;
            
            return (
              <tr key={item.id || index}>
                <td>
                  <div>{item.productName}</div>
                  {item.sku && (
                    <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                      <span className="classic-print-sku">{item.sku}</span>
                    </div>
                  )}
                </td>
                {enablePacking && <td>{packingText}</td>}
                <td className="text-right">{qty.toFixed(2)}</td>
                <td>{unit}</td>
                <td className="text-right classic-print-currency">Rs. {item.price.toLocaleString()}</td>
                <td className="text-right classic-print-currency">Rs. {(item.price * qty).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="classic-print-totals">
        <div className="classic-print-totals-inner">
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Subtotal:</span>
            <span className="classic-print-totals-value classic-print-currency">Rs. {sale.subtotal.toLocaleString()}</span>
          </div>
          {sale.discount > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Discount:</span>
              <span className="classic-print-totals-value classic-print-currency">- Rs. {sale.discount.toLocaleString()}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Tax:</span>
              <span className="classic-print-totals-value classic-print-currency">Rs. {sale.tax.toLocaleString()}</span>
            </div>
          )}
          {sale.expenses > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Shipping/Other:</span>
              <span className="classic-print-totals-value classic-print-currency">Rs. {sale.expenses.toLocaleString()}</span>
            </div>
          )}
          <div className="classic-print-totals-row total">
            <span className="classic-print-totals-label">Total:</span>
            <span className="classic-print-totals-value classic-print-currency">Rs. {sale.total.toLocaleString()}</span>
          </div>
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Paid:</span>
            <span className="classic-print-totals-value" style={{ color: '#059669' }}>Rs. {sale.paid.toLocaleString()}</span>
          </div>
          {sale.due > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Due:</span>
              <span className="classic-print-totals-value" style={{ color: '#dc2626', fontWeight: 600 }}>Rs. {sale.due.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Status */}
      <div className="classic-print-section">
        <p style={{ fontSize: '11px', marginBottom: '4px' }}>
          <strong>Payment Status:</strong> {sale.paymentStatus === 'paid' ? 'Paid' : sale.paymentStatus === 'partial' ? 'Partial' : 'Unpaid'}
        </p>
        <p style={{ fontSize: '11px' }}>
          <strong>Payment Method:</strong> {sale.paymentMethod || 'Cash'}
        </p>
      </div>

      {/* Notes */}
      {sale.notes && (
        <div className="classic-print-section" style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Notes:</p>
          <p style={{ fontSize: '11px', color: '#374151' }}>{sale.notes}</p>
        </div>
      )}
    </ClassicPrintBase>
  );
};
