import React, { useState } from 'react';
import { Sale } from '@/app/context/SalesContext';
import { useSettings } from '@/app/context/SettingsContext';
import { ClassicPrintBase } from './ClassicPrintBase';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface InvoicePrintLayoutProps {
  sale: Sale;
  onClose?: () => void;
}

export const InvoicePrintLayout: React.FC<InvoicePrintLayoutProps> = ({ sale, onClose }) => {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const [showDetailedPacking, setShowDetailedPacking] = useState(false);

  const headerMeta = [
    { label: 'Invoice No', value: sale.invoiceNo },
    { label: 'Date', value: new Date(sale.date).toLocaleDateString() },
    { label: 'Type', value: sale.type === 'invoice' ? 'Invoice' : 'Quotation' },
  ];

  // Helper function to render packing details
  const renderPackingDetails = (item: any) => {
    const pd = item.packingDetails || item.packing_details || {};
    
    if (!showDetailedPacking) {
      // Summary mode: Show totals only
      const totalBoxes = pd.total_boxes ?? 0;
      const totalPieces = pd.total_pieces ?? 0;
      const packingParts: string[] = [];
      if (Number(totalBoxes) > 0) packingParts.push(`${totalBoxes} Box${Number(totalBoxes) !== 1 ? 'es' : ''}`);
      if (Number(totalPieces) > 0) packingParts.push(`${totalPieces} Piece${Number(totalPieces) !== 1 ? 's' : ''}`);
      return packingParts.length ? packingParts.join(', ') : '—';
    }
    
    // Detailed mode: Show box-wise and piece-wise breakdown
    const boxes = pd.boxes || [];
    if (!boxes || boxes.length === 0) {
      return '—';
    }
    
    const details: string[] = [];
    boxes.forEach((box: any, boxIdx: number) => {
      const boxNo = box.box_no || boxIdx + 1;
      const pieces = box.pieces || [];
      if (pieces.length > 0) {
        const pieceDetails = pieces
          .filter((p: number) => p > 0)
          .map((p: number, pIdx: number) => `${p.toFixed(2)}M`)
          .join(', ');
        if (pieceDetails) {
          details.push(`Box ${boxNo}: ${pieceDetails}`);
        }
      }
    });
    
    // Add loose pieces if any
    const loosePieces = pd.loose_pieces || [];
    if (loosePieces.length > 0) {
      const looseDetails = loosePieces
        .filter((p: number) => p > 0)
        .map((p: number) => `${p.toFixed(2)}M`)
        .join(', ');
      if (looseDetails) {
        details.push(`Loose: ${looseDetails}`);
      }
    }
    
    return details.length > 0 ? details.join(' | ') : '—';
  };

  return (
    <ClassicPrintBase
      documentTitle="INVOICE"
      companyName="Din Collection"
      headerMeta={headerMeta}
      onPrint={() => window.print()}
      onClose={onClose}
      actionChildren={
        enablePacking ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-detailed-packing"
                checked={showDetailedPacking}
                onCheckedChange={(checked) => setShowDetailedPacking(checked === true)}
                className="border-gray-400"
              />
              <Label
                htmlFor="show-detailed-packing"
                className="text-sm text-gray-700 cursor-pointer"
              >
                Include Packing Details
              </Label>
            </div>
            <button
              onClick={() => window.print()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <span>Print</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <span>Close</span>
              </button>
            )}
          </div>
        ) : undefined
      }
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
            const unit = (item as any).unit || 'pcs';
            const qty = item.quantity || 0;
            const packingText = enablePacking ? renderPackingDetails(item) : null;
            
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
                {enablePacking && (
                  <td style={{ fontSize: showDetailedPacking ? '9px' : '11px', maxWidth: showDetailedPacking ? '200px' : 'auto' }}>
                    {showDetailedPacking ? (
                      <div style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{packingText}</div>
                    ) : (
                      packingText
                    )}
                  </td>
                )}
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
