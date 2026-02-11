import { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, FileText, Calendar, CreditCard } from 'lucide-react';
import { useSupabase } from '@/app/context/SupabaseContext';
import type { Transaction } from '@/app/services/customerLedgerTypes';
import { formatBoxesPieces } from '@/app/components/ui/utils';

interface TransactionGroupedViewProps {
  transactions: Transaction[];
  saleItemsMap?: Map<string, any[]>;
  onTransactionClick: (transaction: Transaction) => void;
}

// Sale / Studio Sale product breakdown from backend (sale_items / sales_items)
function getSaleProductDetails(transaction: Transaction, saleItemsMap: Map<string, any[]>): any[] {
  if ((transaction.documentType !== 'Sale' && transaction.documentType !== 'Studio Sale') || !transaction.id) return [];
  return saleItemsMap.get(transaction.id) || [];
}

// Payment: single summary row (no product breakdown from sale_items)
const getPaymentDetails = (transaction: Transaction) => {
  if (transaction.documentType === 'Payment') {
    return [{ id: '1', name: 'Payment', quantity: 1, unit: '-', unitPrice: transaction.credit, discount: 0, tax: 0, subtotal: transaction.credit }];
  }
  return [];
};

export function TransactionGroupedView({ transactions, saleItemsMap = new Map(), onTransactionClick }: TransactionGroupedViewProps) {
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

  const getPaymentStatus = (transaction: Transaction): { label: string; statusClass: string; dotClass: string } => {
    if (transaction.documentType === 'Payment') {
      return { label: 'Paid', statusClass: 'bg-green-500/10 text-green-400', dotClass: 'bg-green-400' };
    } else if (transaction.debit > 0) {
      return { label: 'Due', statusClass: 'bg-orange-500/10 text-orange-400', dotClass: 'bg-orange-400' };
    }
    return { label: 'Pending', statusClass: 'bg-gray-500/10 text-gray-400', dotClass: 'bg-gray-400' };
  };

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => {
        const isExpanded = expandedRows.has(transaction.id);
        const productDetails = (transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale')
          ? getSaleProductDetails(transaction, saleItemsMap)
          : getPaymentDetails(transaction);
        const status = getPaymentStatus(transaction);
        const hasDetails = productDetails.length > 0;
        const isSale = transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale';

        return (
          <div
            key={transaction.id}
            className="rounded-xl overflow-hidden bg-gray-900/50 border border-gray-800"
          >
            {/* Transaction Header Row (Master) */}
            <div
              className={`px-6 py-4 cursor-pointer transition-colors hover:bg-gray-800/30 ${isExpanded ? 'border-b border-gray-800' : ''}`}
              onClick={() => hasDetails && toggleRow(transaction.id)}
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center justify-center w-6">
                  {hasDetails && (
                    isExpanded
                      ? <ChevronDown className="w-5 h-5 text-gray-500" />
                      : <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </div>

                <div className="w-36">
                  <div className="text-xs mb-1 text-gray-500">Date</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-white">
                      {new Date(transaction.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="w-40">
                  <div className="text-xs mb-1 text-gray-500">Reference</div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="font-medium font-mono text-white">{transaction.referenceNo}</span>
                  </div>
                </div>

                <div className="w-32">
                  <div className="text-xs mb-1 text-gray-500">Type</div>
                  <div
                    className={`inline-flex px-3 py-1 rounded-lg text-xs font-medium ${
                      transaction.documentType === 'Opening Balance' ? 'bg-gray-600/30 text-gray-300 border border-gray-600' :
                      transaction.documentType === 'Sale' || transaction.documentType === 'Studio Sale' || transaction.documentType === 'Purchase' ? 'bg-blue-500/10 text-blue-400' :
                      transaction.documentType === 'Payment' ? 'bg-green-500/10 text-green-400' :
                      transaction.documentType === 'Expense' ? 'bg-amber-500/10 text-amber-400' :
                      transaction.documentType === 'Job' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-500/10 text-gray-400'
                    }`}
                  >
                    {transaction.documentType}
                  </div>
                </div>

                <div className="w-32">
                  <div className="text-xs mb-1 text-gray-500">Location</div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-white">{transaction.paymentAccount.split(' ')[0]}</span>
                  </div>
                </div>

                <div className="w-28">
                  <div className="text-xs mb-1 text-gray-500">Status</div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${status.statusClass}`}>
                    <div className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                    {status.label}
                  </div>
                </div>

                <div className="flex-1 text-right">
                  <div className="text-xs mb-1 text-gray-500">Debit Amount</div>
                  <div className={`text-lg font-bold tabular-nums ${transaction.debit > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                    {transaction.debit > 0 ? `Rs ${transaction.debit.toLocaleString('en-PK')}` : '-'}
                  </div>
                </div>

                <div className="w-44 text-right">
                  <div className="text-xs mb-1 text-gray-500">Balance</div>
                  <div className="text-xl font-bold tabular-nums text-blue-400">
                    Rs {transaction.runningBalance.toLocaleString('en-PK')}
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && hasDetails && (() => {
              return (
              <div className="px-6 py-4 bg-gray-950/80">
                <div className="mb-3 flex items-center gap-2">
                  <div className="text-xs font-semibold text-gray-500">PRODUCT BREAKDOWN</div>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-900/80 border-b border-gray-800">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Product Name</th>
                        {isSale && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Variation</th>}
                        {isSale && enablePacking && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Packing</th>}
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Qty</th>
                        {isSale && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Unit</th>}
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Unit Price</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Discount</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Tax</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productDetails.map((item: any, idx: number) => {
                        if (isSale) {
                          const attrs = item.variation?.attributes || item.product_variations?.attributes || {};
                          const variationText = (attrs.size || attrs.color) ? [attrs.size, attrs.color].filter(Boolean).join(' / ') : '—';
                          // Packing: structured – Boxes + Pieces (never merge with Qty/Unit)
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
                              className={`transition-colors hover:bg-gray-800/30 ${idx % 2 === 0 ? 'bg-gray-900/50' : 'bg-gray-950/50'} ${idx < productDetails.length - 1 ? 'border-b border-gray-800' : ''}`}
                            >
                              <td className="px-4 py-3 font-medium text-white">{item.product_name || 'N/A'}</td>
                              <td className="px-4 py-3 text-gray-400">{variationText}</td>
                              {enablePacking && <td className="px-4 py-3 text-gray-400">{packingText}</td>}
                              <td className="px-4 py-3 text-right tabular-nums text-white">{qty.toFixed(2)}</td>
                              <td className="px-4 py-3 text-gray-400">{unit}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-white">Rs {unitPrice.toLocaleString('en-PK')}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-orange-400">{discount > 0 ? `Rs ${discount.toLocaleString('en-PK')}` : '—'}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-green-400">Rs {tax.toLocaleString('en-PK')}</td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums text-white">Rs {lineTotal.toLocaleString('en-PK')}</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={item.id} className="bg-gray-900/50 border-b border-gray-800">
                            <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-white">{item.quantity}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-white">Rs {item.unitPrice.toLocaleString('en-PK')}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-orange-400">—</td>
                            <td className="px-4 py-3 text-right tabular-nums text-green-400">—</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-white">Rs {item.subtotal.toLocaleString('en-PK')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-900/80 border-t-2 border-gray-800">
                        <td colSpan={isSale ? (enablePacking ? 8 : 7) : 5} className="px-4 py-3 text-right">
                          <span className="font-bold text-sm text-gray-500">TOTAL:</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold tabular-nums text-lg text-blue-400">
                            Rs {(isSale ? productDetails.reduce((s: number, p: any) => s + (Number(p.total) || 0), 0) : productDetails.reduce((s: number, p: any) => s + (p.subtotal || 0), 0)).toLocaleString('en-PK')}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
