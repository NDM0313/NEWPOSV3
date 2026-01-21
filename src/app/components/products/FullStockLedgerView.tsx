import React, { useEffect, useState } from 'react';
import { X, Download, FileText, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { productService } from '@/app/services/productService';
import { useSupabase } from '@/app/context/SupabaseContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface StockMovement {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  branch?: {
    id: string;
    name: string;
  };
}

interface FullStockLedgerViewProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  productSku?: string;
}

export const FullStockLedgerView: React.FC<FullStockLedgerViewProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  productSku,
}) => {
  const { companyId } = useSupabase();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningBalance, setRunningBalance] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (isOpen && productId && companyId) {
      loadStockMovements();
    }
  }, [isOpen, productId, companyId]);

  const loadStockMovements = async () => {
    if (!productId || !companyId) return;

    try {
      setLoading(true);
      const data = await productService.getStockMovements(productId, companyId);
      setMovements(data);

      // Calculate running balance
      const balanceMap = new Map<string, number>();
      let currentBalance = 0;

      // Sort by date ascending for balance calculation
      const sortedMovements = [...data].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      sortedMovements.forEach((movement) => {
        currentBalance += Number(movement.quantity || 0);
        balanceMap.set(movement.id, currentBalance);
      });

      setRunningBalance(balanceMap);
    } catch (error: any) {
      console.error('[Full Ledger] Error loading stock movements:', error);
      toast.error('Failed to load stock ledger: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = React.useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let currentBalance = 0;

    movements.forEach((movement) => {
      const qty = Number(movement.quantity || 0);
      if (qty > 0) {
        totalIn += qty;
      } else {
        totalOut += Math.abs(qty);
      }
      currentBalance += qty;
    });

    return { totalIn, totalOut, currentBalance };
  }, [movements]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase: 'Purchase',
      sale: 'Sale',
      return: 'Return',
      adjustment: 'Adjustment',
      transfer: 'Transfer',
      'sell_return': 'Sell Return',
      'purchase_return': 'Purchase Return',
    };
    return labels[type] || type;
  };

  const getMovementTypeColor = (type: string, quantity: number) => {
    const isIn = quantity > 0;
    if (type === 'purchase' || type === 'return' || type === 'sell_return') {
      return isIn ? 'text-green-400 bg-green-900/20 border-green-900/50' : 'text-red-400 bg-red-900/20 border-red-900/50';
    }
    if (type === 'sale' || type === 'purchase_return') {
      return 'text-red-400 bg-red-900/20 border-red-900/50';
    }
    return 'text-gray-400 bg-gray-900/20 border-gray-800';
  };

  // Prevent body scroll - MUST be before early return to follow Rules of Hooks
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] rounded-xl border border-gray-800 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 bg-[#111827] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText size={20} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Full Stock Ledger View</h2>
              <p className="text-xs text-gray-400">
                {productName} {productSku && `(${productSku})`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-800 bg-[#1F2937]/30">
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight size={16} className="text-green-400" />
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Quantity In</span>
            </div>
            <span className="text-2xl font-bold text-green-400">{totals.totalIn.toFixed(2)}</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight size={16} className="text-red-400" />
              <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Quantity Out</span>
            </div>
            <span className="text-2xl font-bold text-red-400">{totals.totalOut.toFixed(2)}</span>
          </div>
          <div className="bg-gray-900 border border-blue-800 p-4 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-blue-900/10 z-0"></div>
            <div className="flex items-center gap-2 mb-2 relative z-10">
              <FileText size={16} className="text-blue-400" />
              <span className="text-xs text-blue-300 uppercase font-bold tracking-wider">Current Balance</span>
            </div>
            <span className="text-2xl font-bold text-blue-400 relative z-10">{totals.currentBalance.toFixed(2)}</span>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1 bg-[#0B0F17]">
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>No stock movements found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date & Time</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Unit Cost</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Total Cost</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Running Balance</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Reference</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const qty = Number(movement.quantity || 0);
                      const isIn = qty > 0;
                      const balance = runningBalance.get(movement.id) || 0;
                      const referenceNo = movement.reference_type
                        ? `${movement.reference_type.toUpperCase()}-${movement.reference_id?.substring(0, 8) || 'N/A'}`
                        : 'N/A';

                      return (
                        <tr
                          key={movement.id}
                          className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-gray-300">{formatDate(movement.created_at)}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs uppercase',
                                getMovementTypeColor(movement.movement_type || '', qty)
                              )}
                            >
                              {getMovementTypeLabel(movement.movement_type || '')}
                            </Badge>
                          </td>
                          <td className={cn('py-3 px-4 text-right font-mono font-semibold', isIn ? 'text-green-400' : 'text-red-400')}>
                            {isIn ? '+' : ''}{qty.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300">
                            {movement.unit_cost ? `$${Number(movement.unit_cost).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300">
                            {movement.total_cost ? `$${Number(movement.total_cost).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-blue-400">
                            {balance.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{referenceNo}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs max-w-xs truncate">
                            {movement.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 bg-gray-950 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Total {movements.length} {movements.length === 1 ? 'movement' : 'movements'}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              onClick={() => {
                // TODO: Implement export functionality
                toast.info('Export functionality coming soon');
              }}
            >
              <Download size={14} className="mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
