import React, { useState } from 'react';
import { useSettings } from '@/app/context/SettingsContext';
import { ClassicPrintBase } from './ClassicPrintBase';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { formatBoxesPieces } from '../ui/utils';

interface SaleReturnPrintLayoutProps {
  saleReturn: any;
  onClose?: () => void;
}

export const SaleReturnPrintLayout: React.FC<SaleReturnPrintLayoutProps> = ({ saleReturn, onClose }) => {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const [showDetailedReturnPacking, setShowDetailedReturnPacking] = useState(false);

  const headerMeta = [
    { label: 'Return No', value: saleReturn.return_no || saleReturn.id?.slice(0, 8) || 'N/A' },
    { label: 'Date', value: new Date(saleReturn.return_date || saleReturn.created_at).toLocaleDateString() },
    { label: 'Original Invoice', value: saleReturn.original_sale_id ? (saleReturn.original_invoice_no || 'N/A') : 'No invoice' },
    { label: 'Status', value: saleReturn.status === 'final' ? 'FINAL' : 'DRAFT' },
  ];

  // Helper function to render return packing details
  const renderReturnPackingDetails = (item: any) => {
    // Check for return_packing_details first (piece-level selection)
    const returnPacking = item.return_packing_details || {};
    const originalPacking = item.packing_details || {};
    
    // If return_packing_details exists, use it
    if (returnPacking.returned_pieces && returnPacking.returned_pieces.length > 0) {
      if (!showDetailedReturnPacking) {
        // Summary mode: Show totals only
        const returnedBoxes = returnPacking.returned_boxes ?? 0;
        const returnedPieces = returnPacking.returned_pieces_count ?? returnPacking.returned_pieces?.length ?? 0;
        const returnedMeters = returnPacking.returned_total_meters ?? 0;
        const packingParts: string[] = [];
        if (Number(returnedBoxes) > 0) packingParts.push(`${formatBoxesPieces(returnedBoxes)} Box${Math.round(Number(returnedBoxes)) !== 1 ? 'es' : ''}`);
        if (Number(returnedPieces) > 0) packingParts.push(`${formatBoxesPieces(returnedPieces)} Piece${Math.round(Number(returnedPieces)) !== 1 ? 's' : ''}`);
        if (Number(returnedMeters) > 0) packingParts.push(`${returnedMeters.toFixed(2)}M`);
        return packingParts.length ? packingParts.join(', ') : '—';
      }
      
      // Detailed mode: Show selected returned pieces
      const returnedPieces = returnPacking.returned_pieces || [];
      const details: string[] = [];
      
      // Group by box
      const piecesByBox: Record<number, any[]> = {};
      returnedPieces.forEach((p: any) => {
        const boxNo = p.box_no || 1;
        if (!piecesByBox[boxNo]) piecesByBox[boxNo] = [];
        piecesByBox[boxNo].push(p);
      });
      
      Object.entries(piecesByBox).forEach(([boxNo, pieces]) => {
        const pieceDetails = pieces
          .map((p: any) => `${p.meters?.toFixed(2) || '0.00'}M`)
          .join(', ');
        if (pieceDetails) {
          details.push(`Box ${boxNo}: ${pieceDetails}`);
        }
      });
      
      return details.length > 0 ? details.join(' | ') : '—';
    }
    
    // Fallback to original packing (proportional calculation)
    const pd = originalPacking;
    if (!showDetailedReturnPacking) {
      const totalBoxes = pd.total_boxes ?? 0;
      const totalPieces = pd.total_pieces ?? 0;
      const packingParts: string[] = [];
      if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
      if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
      return packingParts.length ? packingParts.join(', ') : '—';
    }
    
    return '—';
  };

  return (
    <ClassicPrintBase
      documentTitle="SALE RETURN"
      companyName="Din Collection"
      headerMeta={headerMeta}
      onPrint={() => window.print()}
      onClose={onClose}
      actionChildren={
        enablePacking ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-detailed-return-packing"
                checked={showDetailedReturnPacking}
                onCheckedChange={(checked) => setShowDetailedReturnPacking(checked === true)}
                className="border-gray-400"
              />
              <Label
                htmlFor="show-detailed-return-packing"
                className="text-sm text-gray-700 cursor-pointer"
              >
                Include Return Packing Details
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
      {/* Return Details */}
      <div className="classic-print-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Customer:</h3>
            <p style={{ fontSize: '11px', marginBottom: '4px' }}>{saleReturn.customer_name || 'N/A'}</p>
          </div>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Return Details:</h3>
            {saleReturn.reason && (
              <p style={{ fontSize: '11px', marginBottom: '4px' }}>
                <strong>Reason:</strong> {saleReturn.reason}
              </p>
            )}
            {saleReturn.notes && (
              <p style={{ fontSize: '11px', color: '#6b7280' }}>
                <strong>Notes:</strong> {saleReturn.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Return Items Table */}
      <table className="classic-print-table">
        <thead>
          <tr>
            <th>Product</th>
            {enablePacking && <th>Return Packing</th>}
            <th className="text-right">Return Qty</th>
            <th>Unit</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Return Total</th>
          </tr>
        </thead>
        <tbody>
          {saleReturn.items && saleReturn.items.length > 0 ? (
            saleReturn.items.map((item: any, index: number) => {
              const unit = item.unit || 'pcs';
              const returnQty = item.return_quantity || item.quantity || 0;
              const packingText = enablePacking ? renderReturnPackingDetails(item) : null;
              
              return (
                <tr key={item.id || index}>
                  <td>
                    <div>{item.product_name}</div>
                    {item.sku && (
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                        <span className="classic-print-sku">{item.sku}</span>
                      </div>
                    )}
                  </td>
                  {enablePacking && (
                    <td style={{ fontSize: showDetailedReturnPacking ? '9px' : '11px', maxWidth: showDetailedReturnPacking ? '200px' : 'auto', color: '#9333ea' }}>
                      {showDetailedReturnPacking ? (
                        <div style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{packingText}</div>
                      ) : (
                        packingText
                      )}
                    </td>
                  )}
                  <td className="text-right">{returnQty.toFixed(2)}</td>
                  <td>{unit}</td>
                  <td className="text-right classic-print-currency">Rs. {(item.unit_price || item.price || 0).toLocaleString()}</td>
                  <td className="text-right classic-print-currency" style={{ color: '#dc2626' }}>
                    - Rs. {((item.unit_price || item.price || 0) * returnQty).toLocaleString()}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={enablePacking ? 6 : 5} className="text-center text-gray-500" style={{ padding: '24px' }}>
                No items in this return
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="classic-print-totals">
        <div className="classic-print-totals-inner">
          <div className="classic-print-totals-row">
            <span className="classic-print-totals-label">Subtotal:</span>
            <span className="classic-print-totals-value classic-print-currency" style={{ color: '#dc2626' }}>
              - Rs. {(saleReturn.subtotal || 0).toLocaleString()}
            </span>
          </div>
          {saleReturn.discount_amount > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Discount:</span>
              <span className="classic-print-totals-value classic-print-currency" style={{ color: '#059669' }}>
                + Rs. {saleReturn.discount_amount.toLocaleString()}
              </span>
            </div>
          )}
          {saleReturn.restocking_fee > 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Restocking Fee:</span>
              <span className="classic-print-totals-value classic-print-currency" style={{ color: '#dc2626' }}>
                - Rs. {saleReturn.restocking_fee.toLocaleString()}
              </span>
            </div>
          )}
          {saleReturn.manual_adjustment !== 0 && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Manual Adjustment:</span>
              <span className="classic-print-totals-value classic-print-currency" style={{ color: saleReturn.manual_adjustment > 0 ? '#dc2626' : '#059669' }}>
                {saleReturn.manual_adjustment > 0 ? '-' : '+'} Rs. {Math.abs(saleReturn.manual_adjustment).toLocaleString()}
              </span>
            </div>
          )}
          <div className="classic-print-totals-row total">
            <span className="classic-print-totals-label">Total Return Amount:</span>
            <span className="classic-print-totals-value classic-print-currency" style={{ color: '#dc2626', fontWeight: 700 }}>
              - Rs. {(saleReturn.total || 0).toLocaleString()}
            </span>
          </div>
          {saleReturn.refund_method && (
            <div className="classic-print-totals-row">
              <span className="classic-print-totals-label">Refund Method:</span>
              <span className="classic-print-totals-value">
                {saleReturn.refund_method === 'cash' ? 'Cash Refund' : 
                 saleReturn.refund_method === 'bank' ? 'Bank Refund' : 
                 'Adjust in Customer Account'}
              </span>
            </div>
          )}
        </div>
      </div>
    </ClassicPrintBase>
  );
};
