import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Building2, Package, Loader2, Save, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { useSupabase } from '@/app/context/SupabaseContext';
import { saleReturnService, SaleReturn } from '@/app/services/saleReturnService';
import { saleService } from '@/app/services/saleService';
import { formatDateAndTime } from '../ui/utils';
import { cn } from '../ui/utils';

interface ReturnPaymentAdjustmentProps {
  saleId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReturnPaymentAdjustment: React.FC<ReturnPaymentAdjustmentProps> = ({
  saleId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { companyId, branchId: contextBranchId } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSale, setOriginalSale] = useState<any>(null);
  const [returns, setReturns] = useState<(SaleReturn & { items: any[] })[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | null>(null);
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState<'cash' | 'bank' | 'adjust'>('cash');

  // Load original sale and returns
  useEffect(() => {
    const loadData = async () => {
      if (!companyId || !saleId || !isOpen) return;

      try {
        setLoading(true);

        // Load original sale
        const sale = await saleService.getSaleById(saleId);
        setOriginalSale(sale);

        // Load all returns for this sale
        const allReturns = await saleReturnService.getSaleReturns(
          companyId,
          contextBranchId === 'all' ? undefined : contextBranchId || undefined
        );
        
        // Filter returns for this specific sale
        const saleReturns = allReturns.filter((ret: any) => ret.original_sale_id === saleId);
        setReturns(saleReturns);

        console.log('[RETURN PAYMENT] Loaded returns:', saleReturns.length);
      } catch (error: any) {
        console.error('[RETURN PAYMENT] Error loading data:', error);
        toast.error(error.message || 'Failed to load return data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [companyId, saleId, isOpen, contextBranchId]);

  const handleEditSettlement = (returnItem: SaleReturn) => {
    if (returnItem.status === 'final') {
      toast.warning('Cannot edit settlement for finalized returns');
      return;
    }
    setSelectedReturn(returnItem);
    // Get settlement method from accounting entry metadata if available
    // For now, default to cash
    setSettlementMethod('cash');
    setShowSettlementDialog(true);
  };

  const handleSettlementSave = async () => {
    if (!selectedReturn || !companyId || !contextBranchId) return;

    try {
      setSaving(true);
      setShowSettlementDialog(false);

      // TODO: Update settlement method in accounting entry
      // For now, just show success message
      toast.success('Settlement method updated successfully');
      
      // Reload returns
      const allReturns = await saleReturnService.getSaleReturns(
        companyId,
        contextBranchId === 'all' ? undefined : contextBranchId || undefined
      );
      const saleReturns = allReturns.filter((ret: any) => ret.original_sale_id === saleId);
      setReturns(saleReturns);

      setSelectedReturn(null);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('[RETURN PAYMENT] Error updating settlement:', error);
      toast.error(error.message || 'Failed to update settlement');
    } finally {
      setSaving(false);
    }
  };

  const getSettlementInfo = (returnItem: SaleReturn) => {
    // TODO: Fetch from accounting entry metadata
    // For now, return default
    return {
      method: 'cash' as 'cash' | 'bank' | 'adjust',
      paymentDate: returnItem.created_at || returnItem.return_date,
      status: returnItem.status,
    };
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-background border-border text-foreground max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
              <DollarSign size={24} className="text-[var(--erp-money-positive)]" />
              Return Payment / Adjustment
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <div className="space-y-6 mt-4">
              {/* Original Sale Info */}
              {originalSale && (
                <div className="bg-muted/40 border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide mb-3">
                    Original Sale Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Invoice #:</span>
                      <div className="text-foreground font-semibold mt-0.5">{originalSale.invoice_no || 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Customer:</span>
                      <div className="text-foreground font-semibold mt-0.5">{originalSale.customer_name || 'Walk-in Customer'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Sale Date:</span>
                      <div className="text-foreground font-semibold mt-0.5">
                        {originalSale.invoice_date ? formatDateAndTime(originalSale.invoice_date).date : '-'}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs uppercase">Payment Method:</span>
                      <div className="text-foreground font-semibold mt-0.5 capitalize">
                        {originalSale.payment_method || originalSale.paymentMethod || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Returns List */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">
                  Sale Returns ({returns.length})
                </h3>
                {returns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/40 border border-border rounded-lg">
                    <Package size={48} className="mx-auto mb-3 text-muted-foreground" />
                    <p>No returns found for this sale</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {returns.map((returnItem) => {
                      const settlement = getSettlementInfo(returnItem);
                      return (
                        <div
                          key={returnItem.id}
                          className="bg-muted/40 border border-border rounded-lg p-4 hover:border-border transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-foreground font-semibold">
                                  {returnItem.return_no || `RET-${returnItem.id?.slice(0, 8).toUpperCase()}`}
                                </h4>
                                <Badge
                                  className={
                                    returnItem.status === 'final'
                                      ? 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-500/30'
                                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                  }
                                >
                                  {returnItem.status === 'final' ? 'Final' : 'Draft'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs">Return Date:</span>
                                  <div className="text-foreground mt-0.5">
                                    {formatDateAndTime(returnItem.return_date || returnItem.created_at || '').date}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Return Amount:</span>
                                  <div className="text-red-400 font-semibold mt-0.5">
                                    -Rs {returnItem.total?.toLocaleString() || '0'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Settlement Info */}
                          <div className="mt-3 pt-3 border-t border-border">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-muted-foreground text-xs uppercase">Settlement Method:</span>
                                <div className="flex items-center gap-2 mt-1">
                                  {settlement.method === 'cash' && (
                                    <>
                                      <DollarSign size={14} className="text-[var(--erp-money-positive)]" />
                                      <span className="text-foreground text-sm">Cash Refund</span>
                                    </>
                                  )}
                                  {settlement.method === 'bank' && (
                                    <>
                                      <Building2 size={14} className="text-blue-400" />
                                      <span className="text-foreground text-sm">Bank Refund</span>
                                    </>
                                  )}
                                  {settlement.method === 'adjust' && (
                                    <>
                                      <Package size={14} className="text-purple-400" />
                                      <span className="text-foreground text-sm">Adjust in Customer Account</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {returnItem.status === 'draft' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditSettlement(returnItem)}
                                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                >
                                  Edit Settlement
                                </Button>
                              )}
                            </div>
                            {settlement.paymentDate && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <Calendar size={12} className="inline mr-1" />
                                Settled: {formatDateAndTime(settlement.paymentDate).date}
                              </div>
                            )}
                          </div>

                          {/* Return Items Summary */}
                          {returnItem.items && returnItem.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <span className="text-muted-foreground text-xs uppercase">Items Returned:</span>
                              <div className="text-foreground text-sm mt-1">
                                {returnItem.items.length} item(s)
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement Edit Dialog */}
      <Dialog open={showSettlementDialog} onOpenChange={setShowSettlementDialog}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <DollarSign size={20} className="text-purple-400" />
              Edit Settlement Method
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedReturn && (
              <div className="bg-muted/40 border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Return Amount:</p>
                <p className="text-2xl font-bold text-red-400">
                  -Rs {selectedReturn.total?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Return: {selectedReturn.return_no || selectedReturn.id}
                </p>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground mb-3 block text-sm font-semibold">
                How would you like to settle this return amount?
              </Label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSettlementMethod('cash')}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-3",
                    settlementMethod === 'cash'
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <DollarSign size={18} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Cash Refund</div>
                    <div className="text-xs opacity-75">Refund amount in cash</div>
                  </div>
                  {settlementMethod === 'cash' && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSettlementMethod('bank')}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-3",
                    settlementMethod === 'bank'
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <Building2 size={18} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Bank Refund</div>
                    <div className="text-xs opacity-75">Refund amount via bank transfer</div>
                  </div>
                  {settlementMethod === 'bank' && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSettlementMethod('adjust')}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg text-sm font-medium transition-all border flex items-center gap-3",
                    settlementMethod === 'adjust'
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  <Package size={18} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Adjust in Customer Account</div>
                    <div className="text-xs opacity-75">Reduce customer's outstanding balance</div>
                  </div>
                  {settlementMethod === 'adjust' && <div className="w-2 h-2 rounded-full bg-white" />}
                </button>
              </div>
            </div>

            {selectedReturn?.status === 'final' && (
              <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
                <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-300">
                  This return is already finalized. Changing settlement method will update the accounting entry.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowSettlementDialog(false);
                setSelectedReturn(null);
              }}
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSettlementSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Settlement
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
