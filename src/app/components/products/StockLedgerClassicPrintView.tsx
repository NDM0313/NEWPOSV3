/**
 * Stock Ledger – Classic Print View (Dedicated Preview)
 *
 * UX: User opens this view FIRST (no print dialog). User verifies data,
 * selects orientation (Portrait/Landscape), then clicks Print or Save as PDF.
 */

import React, { useState, useMemo } from 'react';
import { Download, Printer, X } from 'lucide-react';
import { Button } from '../ui/button';
import { formatStockReference } from '@/app/utils/formatters';
import { toast } from 'sonner';
import { useSettings } from '@/app/context/SettingsContext';
import { ClassicPrintBase } from '../shared/ClassicPrintBase';

export interface StockMovementForPrint {
  id: string;
  movement_type?: string;
  type?: string;
  quantity: number;
  box_change?: number;
  piece_change?: number;
  unit?: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface TotalsForPrint {
  totalPurchased: number;
  totalSold: number;
  totalAdjustments: number;
  currentBalance: number;
}

export interface StockLedgerClassicPrintViewProps {
  companyName?: string;
  productName: string;
  productSku?: string;
  branchLabel: string;
  movements: StockMovementForPrint[];
  runningBalance: Map<string, number>;
  totals: TotalsForPrint;
  getMovementTypeLabel: (type: string) => string;
  getSaleById?: (id: string) => { invoiceNo?: string } | null;
  getPurchaseById?: (id: string) => { purchaseNo?: string; po_no?: string } | null;
  onClose: () => void;
  /** Initial orientation when opening print view */
  initialOrientation?: 'portrait' | 'landscape';
}

export const StockLedgerClassicPrintView: React.FC<StockLedgerClassicPrintViewProps> = ({
  companyName,
  productName,
  productSku,
  branchLabel,
  movements,
  runningBalance,
  totals,
  getMovementTypeLabel,
  getSaleById,
  getPurchaseById,
  onClose,
  initialOrientation = 'landscape',
}) => {
  const { inventorySettings } = useSettings();
  const enablePacking = inventorySettings.enablePacking;
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(initialOrientation);

  const sortedMovements = useMemo(
    () => [...movements].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
    [movements]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = () => {
    toast.info('In the Print dialog, choose "Save as PDF" or "Microsoft Print to PDF" as destination.');
    window.print();
  };

  const actionChildren = (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={orientation}
        onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
        className="h-8 px-2 rounded bg-gray-100 border border-gray-300 text-gray-800 text-sm"
        aria-label="Page orientation"
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
      <Button
        onClick={handlePrint}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        <Printer size={16} className="mr-2" />
        Print
      </Button>
      <Button
        onClick={handleSavePDF}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
      >
        <Download size={16} className="mr-2" />
        Save as PDF
      </Button>
      <Button
        onClick={onClose}
        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
      >
        <X size={16} className="mr-2" />
        Close
      </Button>
    </div>
  );

  const headerMeta = [
    { label: 'Product', value: `${productName}${productSku ? ` (${productSku})` : ''}` },
    { label: 'Branch', value: branchLabel },
  ];

  return (
    <div className={`stock-ledger-print stock-ledger-print-${orientation}`}>
      <style>{`
        @media print {
          @page { size: ${orientation}; }
          /* Portrait: tighter layout so columns/rows fit on narrow page */
          .stock-ledger-print-portrait .classic-print-base {
            max-width: 100%;
            padding: 12px;
          }
          .stock-ledger-print-portrait .classic-print-table {
            font-size: 9px;
            table-layout: auto;
            width: 100%;
          }
          .stock-ledger-print-portrait .classic-print-table th,
          .stock-ledger-print-portrait .classic-print-table td {
            padding: 4px 6px;
          }
          .stock-ledger-print-portrait .classic-print-summary-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          /* Landscape: full width, auto-adjust columns/rows */
          .stock-ledger-print-landscape .classic-print-base {
            max-width: 100%;
            padding: 16px;
          }
          .stock-ledger-print-landscape .classic-print-table {
            width: 100%;
            table-layout: auto;
          }
          .stock-ledger-print-landscape .classic-print-table th,
          .stock-ledger-print-landscape .classic-print-table td {
            padding: 6px 8px;
          }
        }
        @media screen {
          .stock-ledger-print-portrait .classic-print-base {
            max-width: 600px;
          }
          .stock-ledger-print-landscape .classic-print-base {
            max-width: 900px;
          }
        }
      `}</style>
      <ClassicPrintBase
        documentTitle="STOCK LEDGER"
        companyName={companyName || 'Din Collection'}
        headerMeta={headerMeta}
        onPrint={handlePrint}
        onClose={onClose}
        showActions={true}
        actionChildren={actionChildren}
      >
      {/* Summary Section */}
      <div className="classic-print-section">
        <h2 className="classic-print-section-title">Summary</h2>
        <div className="classic-print-summary-grid" style={{ display: 'grid', gridTemplateColumns: orientation === 'portrait' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px', marginTop: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Total Purchased</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{totals.totalPurchased.toFixed(2)}</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Total Sold</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{totals.totalSold.toFixed(2)}</div>
          </div>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Adjustments</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
              {totals.totalAdjustments >= 0 ? '+' : ''}{totals.totalAdjustments.toFixed(2)}
            </div>
          </div>
          <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Current Stock</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{totals.currentBalance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Movements Table Section */}
      <div className="classic-print-section">
        <h2 className="classic-print-section-title">Stock Movements</h2>
        <table className="classic-print-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th className="text-right">Qty Change</th>
              {enablePacking && <th className="text-right">Box Change</th>}
              {enablePacking && <th className="text-right">Piece Change</th>}
              {enablePacking && <th className="text-left">Unit</th>}
              <th className="text-right">Balance</th>
              <th>Reference</th>
              <th className="notes-col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedMovements.map((movement) => {
              const qty = Number(movement.quantity ?? 0);
              const boxChange = movement.box_change ?? 0;
              const pieceChange = movement.piece_change ?? 0;
              const unit = movement.unit || 'pcs';
              const balance = runningBalance.get(movement.id) ?? 0;
              const sale =
                movement.reference_type &&
                movement.reference_id &&
                String(movement.reference_type).toLowerCase().includes('sale')
                  ? getSaleById?.(movement.reference_id)
                  : null;
              const purchase =
                movement.reference_type &&
                movement.reference_id &&
                String(movement.reference_type).toLowerCase().includes('purchase')
                  ? getPurchaseById?.(movement.reference_id)
                  : null;
              const refNo = formatStockReference({
                referenceType: movement.reference_type,
                referenceId: movement.reference_id,
                movementId: movement.id,
                saleInvoiceNo: sale?.invoiceNo,
                purchaseInvoiceNo: purchase?.purchaseNo ?? purchase?.po_no,
                notes: movement.notes,
              });
              return (
                <tr key={movement.id}>
                  <td>{new Date(movement.created_at).toLocaleString()}</td>
                  <td>{getMovementTypeLabel(movement.movement_type || movement.type || '')}</td>
                  <td className="text-right">{qty >= 0 ? '+' : ''}{qty.toFixed(2)}</td>
                  {enablePacking && <td className="text-right">{boxChange >= 0 ? '+' : ''}{Math.round(Number(boxChange))}</td>}
                  {enablePacking && <td className="text-right">{pieceChange >= 0 ? '+' : ''}{Math.round(Number(pieceChange))}</td>}
                  {enablePacking && <td className="text-left">{unit}</td>}
                  <td className="text-right">{balance.toFixed(2)}</td>
                  <td>{refNo}</td>
                  <td style={{ maxWidth: '200px', wordBreak: 'break-word' }}>{movement.notes || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ClassicPrintBase>
    </div>
  );
};
