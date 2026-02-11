import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import type { Transaction } from '@/app/services/customerLedgerTypes';
import { formatBoxesPieces } from '@/app/components/ui/utils';

interface TransactionClassicViewProps {
  transactions: Transaction[];
  saleItemsMap?: Map<string, any[]>;
  onTransactionClick: (transaction: Transaction) => void;
}

// Sale product breakdown from backend only (sale_items / sales_items) – no mock
function getSaleProductsFromBackend(transaction: Transaction, saleItemsMap: Map<string, any[]>): any[] {
  if ((transaction.documentType !== 'Sale' && transaction.documentType !== 'Studio Sale') || !transaction.id) return [];
  return saleItemsMap.get(transaction.id) || [];
}

// Separate component for transaction row group
function TransactionRowGroup({ 
  transaction, 
  index, 
  isExpanded, 
  onToggle,
  saleItemsMap,
  enablePacking 
}: { 
  transaction: Transaction; 
  index: number; 
  isExpanded: boolean; 
  onToggle: () => void;
  saleItemsMap: Map<string, any[]>;
  enablePacking: boolean;
}) {
  const isSale = transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale';
  const products = isSale ? getSaleProductsFromBackend(transaction, saleItemsMap) : [];
  const hasProducts = products.length > 0;

  const getDescription = (transaction: Transaction) => {
    if (transaction.documentType === 'Opening Balance') {
      return 'Opening Balance';
    }
    if (transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale') {
      return `${transaction.documentType} - ${transaction.referenceNo}`;
    }
    if (transaction.documentType === 'Payment') {
      return `Payment Received - ${transaction.referenceNo}`;
    }
    return transaction.description || transaction.documentType;
  };

  return (
    <>
      {/* Main Transaction Row */}
      <tr
        className={`cursor-pointer transition-colors border-b border-gray-800 ${index % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-900/30'} hover:bg-gray-800/50`}
        onClick={() => hasProducts && onToggle()}
      >
        <td className="px-4 py-3 w-10">
          {hasProducts && (
            <div className="text-gray-500">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-white">
          {new Date(transaction.date).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          })}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-blue-400">
          {transaction.referenceNo}
        </td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium text-white">
            {getDescription(transaction)}
          </div>
          {transaction.description && (
            <div className="text-xs text-gray-500 mt-0.5">
              {transaction.description}
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-400">
          {transaction.paymentAccount}
        </td>
        <td className={`px-4 py-3 text-right tabular-nums text-sm font-semibold ${transaction.debit > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
          {transaction.debit > 0 ? transaction.debit.toLocaleString('en-PK') : '-'}
        </td>
        <td className={`px-4 py-3 text-right tabular-nums text-sm font-semibold ${transaction.credit > 0 ? 'text-green-500' : 'text-gray-500'}`}>
          {transaction.credit > 0 ? transaction.credit.toLocaleString('en-PK') : '-'}
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-sm font-bold text-blue-500">
          {transaction.runningBalance.toLocaleString('en-PK')}
        </td>
      </tr>

      {/* Expandable Product Breakdown – 1:1 with sale_items: Product Name, Variation, Packing, Qty, Unit, Unit Price, Discount, Tax, Line Total */}
      {isExpanded && hasProducts && (() => {
        // Step 2 – Ledger items before render: verify data reached UI (packing_type, packing_quantity, packing_unit, quantity, unit, variation_id)
        console.log('[CUSTOMER LEDGER] Step 2 – Ledger items before render:', {
          referenceNo: transaction.referenceNo,
          saleId: transaction.id,
          itemCount: products.length,
          items: products.map((p: any) => ({
            product_name: p.product_name,
            packing_type: p.packing_type,
            packing_quantity: p.packing_quantity,
            packing_unit: p.packing_unit,
            quantity: p.quantity,
            unit: p.unit,
            variation_id: p.variation_id,
          })),
        });
        return (
        <tr className="bg-gray-950/80 border-b border-gray-800">
          <td colSpan={8} className="px-0 py-0">
            <div className="pt-3 pb-3 pl-14 pr-4 border-t border-gray-800">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-900/80">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">PRODUCT NAME</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-[90px]">VARIATION</th>
                    {enablePacking && <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-[100px]">PACKING</th>}
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-[70px]">QTY</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-[60px]">UNIT</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-[90px]">UNIT PRICE</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-[80px]">DISCOUNT</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-[70px]">TAX</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-[100px]">LINE TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item: any, idx: number) => {
                    const attrs = item.variation?.attributes || item.product_variations?.attributes || {};
                    const variationText = (attrs.size || attrs.color) ? [attrs.size, attrs.color].filter(Boolean).join(' / ') : '—';
                    // Packing: structured display – Boxes + Pieces (never merge with Qty/Unit)
                    const pd = item.packing_details || {};
                    const totalBoxes = pd.total_boxes ?? 0;
                    const totalPieces = pd.total_pieces ?? 0;
                    const packingParts: string[] = [];
                    if (Number(totalBoxes) > 0) packingParts.push(`${formatBoxesPieces(totalBoxes)} Box${Math.round(Number(totalBoxes)) !== 1 ? 'es' : ''}`);
                    if (Number(totalPieces) > 0) packingParts.push(`${formatBoxesPieces(totalPieces)} Piece${Math.round(Number(totalPieces)) !== 1 ? 's' : ''}`);
                    const packingText = packingParts.length
                      ? packingParts.join(', ')
                      : (item.packing_type || item.packing_quantity != null || item.packing_unit)
                        ? [item.packing_type, item.packing_quantity != null && item.packing_quantity !== '' ? String(item.packing_quantity) : null, item.packing_unit].filter(Boolean).join(' ')
                        : '—';
                    const qty = Number(item.quantity) || 0;
                    const unit = item.unit ?? 'piece';
                    const unitPrice = Number(item.unit_price) || 0;
                    const discount = Number(item.discount_amount) || 0;
                    const tax = Number(item.tax_amount) || 0;
                    const lineTotal = Number(item.total) || 0;
                    return (
                      <tr
                        key={item.id}
                        className={`${idx % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-800/30'} ${idx < products.length - 1 ? 'border-b border-gray-800' : ''}`}
                      >
                        <td className="px-3 py-2 text-xs text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-300">{item.product_name || 'N/A'}</td>
                        <td className="px-3 py-2 text-sm text-gray-400">{variationText}</td>
                        <td className="px-3 py-2 text-sm text-gray-400">{packingText}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm font-semibold text-gray-300">{qty.toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm text-gray-400">{unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm text-gray-300">{unitPrice.toLocaleString('en-PK')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm text-orange-400">{discount > 0 ? discount.toLocaleString('en-PK') : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm text-green-400">{tax.toLocaleString('en-PK')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-sm font-bold text-blue-400">{lineTotal.toLocaleString('en-PK')}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-900/80 border-t-2 border-gray-700">
                    <td colSpan={enablePacking ? 9 : 8} className="px-3 py-2 text-right text-xs font-semibold text-gray-500">SALE TOTAL:</td>
                    <td className="px-3 py-2 text-right tabular-nums text-sm font-bold text-blue-400">
                      {products.reduce((sum: number, p: any) => sum + (Number(p.total) || 0), 0).toLocaleString('en-PK')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
        );
      })()}
    </>
  );
}

export function TransactionClassicView({ transactions, saleItemsMap = new Map(), onTransactionClick }: TransactionClassicViewProps) {
  const { enablePacking } = useSupabase();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Calculate totals for summary
  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);
  const closingBalance = transactions.length > 0 
    ? transactions[transactions.length - 1].runningBalance 
    : 0;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950/95">
      <table className="w-full border-collapse font-sans">
        <thead>
          <tr className="bg-gray-950/95 border-b-2 border-gray-800">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-10">{/* Expand */}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[110px]">DATE</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[130px]">REFERENCE NO</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">DESCRIPTION</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-[150px]">PAYMENT METHOD</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 w-[130px]">DEBIT</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 w-[130px]">CREDIT</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 w-[150px]">BALANCE</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {transactions.map((transaction, index) => (
            <TransactionRowGroup
              enablePacking={enablePacking}
              key={transaction.id}
              transaction={transaction}
              index={index}
              isExpanded={expandedRows.has(transaction.id)}
              onToggle={() => toggleRow(transaction.id)}
              saleItemsMap={saleItemsMap}
            />
          ))}
        </tbody>
      </table>

      {/* TOTAL SUMMARY SECTION – Products-style dark theme */}
      <div className="border-t-2 border-gray-800 bg-gray-900/50 p-6">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-6 items-center">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-white">Period Summary</div>
            <div className="text-xs mt-0.5 text-gray-500">All Transactions Total</div>
          </div>
          <div className="text-right min-w-[130px]">
            <div className="text-xs font-semibold uppercase mb-1 text-gray-500">Total Debit</div>
            <div className="text-base font-bold font-mono text-yellow-400">{totalDebit.toLocaleString('en-PK')}</div>
          </div>
          <div className="text-right min-w-[130px]">
            <div className="text-xs font-semibold uppercase mb-1 text-gray-500">Total Credit</div>
            <div className="text-base font-bold font-mono text-green-400">{totalCredit.toLocaleString('en-PK')}</div>
          </div>
          <div className="text-right min-w-[150px] box-border p-4 rounded-md border border-gray-700 bg-gray-900/80">
            <div className="text-xs font-semibold uppercase mb-1 text-blue-400">Closing Balance</div>
            <div className="text-xl font-extrabold font-mono text-blue-400">{closingBalance.toLocaleString('en-PK')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}