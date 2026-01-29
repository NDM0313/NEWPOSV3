/**
 * Stock Ledger – Classic Print View (Dedicated Preview)
 *
 * UX: User opens this view FIRST (no print dialog). User verifies data,
 * then clicks Print or Save as PDF. Only then does window.print() run.
 * No portal, no display hacks, no afterprint listeners.
 */

import React from 'react';
import { X, Printer, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { formatStockReference } from '@/app/utils/formatters';
import { toast } from 'sonner';
import './stock-ledger-classic-print.css';

export interface StockMovementForPrint {
  id: string;
  movement_type?: string;
  type?: string;
  quantity: number;
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
}) => {
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = () => {
    toast.info('In the Print dialog, choose "Save as PDF" or "Microsoft Print to PDF" as destination.');
    window.print();
  };

  return (
    <div className="stock-ledger-classic-print-view">
      {/* Chrome: Close, Print, Save as PDF – hidden when printing */}
      <div className="stock-ledger-classic-print-chrome no-print">
        <div className="chrome-title">Stock Ledger – Print Preview</div>
        <div className="chrome-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="chrome-btn"
          >
            <Printer size={16} className="mr-2" />
            Print
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSavePDF}
            className="chrome-btn"
          >
            <Download size={16} className="mr-2" />
            Save as PDF
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="chrome-btn-close"
          >
            <X size={18} />
            Close
          </Button>
        </div>
      </div>

      {/* Printable content – always visible on screen, prints as-is */}
      <div className="stock-ledger-classic-print-content">
        <header className="classic-print-header">
          {companyName && (
            <div className="company-name">{companyName}</div>
          )}
          <h1 className="classic-print-title">STOCK LEDGER</h1>
          <div className="classic-print-meta">
            <div><strong>Product:</strong> {productName}{productSku ? ` (${productSku})` : ''}</div>
            <div><strong>Branch:</strong> {branchLabel}</div>
            <div><strong>Generated:</strong> {new Date().toLocaleString()}</div>
          </div>
        </header>

        <section className="classic-print-summary">
          <h2 className="classic-print-summary-title">Summary</h2>
          <div className="classic-print-summary-grid">
            <div className="classic-print-summary-item">
              <span className="label">Total Purchased</span>
              <span className="value">{totals.totalPurchased.toFixed(2)}</span>
            </div>
            <div className="classic-print-summary-item">
              <span className="label">Total Sold</span>
              <span className="value">{totals.totalSold.toFixed(2)}</span>
            </div>
            <div className="classic-print-summary-item">
              <span className="label">Adjustments</span>
              <span className="value">
                {totals.totalAdjustments >= 0 ? '+' : ''}{totals.totalAdjustments.toFixed(2)}
              </span>
            </div>
            <div className="classic-print-summary-item">
              <span className="label">Current Stock</span>
              <span className="value">{totals.currentBalance.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <table className="classic-print-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th className="text-right">Qty Change</th>
              <th className="text-right">Balance</th>
              <th>Reference</th>
              <th className="notes-col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {sortedMovements.map((movement) => {
              const qty = Number(movement.quantity ?? 0);
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
                  <td className="text-right">{balance.toFixed(2)}</td>
                  <td>{refNo}</td>
                  <td className="notes-col">{movement.notes || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
