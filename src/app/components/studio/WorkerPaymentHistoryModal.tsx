import React from 'react';
import { CheckCircle, Clock, Receipt, User, History, DollarSign } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { format } from 'date-fns';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';

export interface WorkerLedgerEntry {
  id: string;
  amount: number;
  status: string;
  reference_type: string;
  reference_id: string;
  notes: string | null;
  created_at: string;
  paid_at?: string | null;
}

interface WorkerPaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobCardId: string;
  customerName: string;
  stageId: string;
  entries: WorkerLedgerEntry[];
}

export const WorkerPaymentHistoryModal: React.FC<WorkerPaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  jobCardId,
  customerName,
  stageId,
  entries,
}) => {
  const { formatCurrency } = useFormatCurrency();
  const filtered = entries.filter(
    (e) => e.reference_type === 'studio_production_stage' && e.reference_id === stageId
  );
  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const paidAmount = filtered.filter((e) => (e.status || '').toLowerCase() === 'paid').reduce((s, e) => s + (e.amount || 0), 0);
  const unpaidAmount = totalAmount - paidAmount;
  const progressPercent = totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0;

  const statusLabel = unpaidAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Payable';
  const statusConfig =
    unpaidAmount <= 0
      ? { bg: 'bg-green-500/20', text: 'text-[var(--erp-money-positive)]', border: 'border-green-500/30', icon: CheckCircle }
      : paidAmount > 0
        ? { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock }
        : { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: Clock };

  const StatusIcon = statusConfig.icon;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-card border-border text-foreground sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col"
        onInteractOutside={() => {}}
      >
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Receipt size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Payment Details</h2>
                <p className="text-xs text-muted-foreground">Job {jobCardId}</p>
              </div>
            </div>
            <Badge
              className={cn(
                'text-xs font-medium gap-1 h-7 px-3',
                statusConfig.bg,
                statusConfig.text,
                statusConfig.border
              )}
            >
              <StatusIcon size={14} />
              {statusLabel}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Summary Card - same layout as ViewPaymentsModal */}
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <User size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium text-foreground">{customerName || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                  <Receipt size={16} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Job</p>
                  <p className="text-sm font-medium text-foreground font-mono">{jobCardId}</p>
                </div>
              </div>
            </div>

            {/* Payment Progress - same as ViewPaymentsModal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="text-foreground font-semibold">{progressPercent.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    progressPercent >= 100 ? 'bg-green-500' : progressPercent > 0 ? 'bg-yellow-500' : 'bg-gray-600'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="text-center p-2 bg-muted/40 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(totalAmount)}</p>
                </div>
                <div className="text-center p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-xs text-[var(--erp-money-positive)]">Paid</p>
                  <p className="text-sm font-bold text-[var(--erp-money-positive)]">{formatCurrency(paidAmount)}</p>
                </div>
                <div className="text-center p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-xs text-red-400">Due</p>
                  <p className="text-sm font-bold text-red-400">{formatCurrency(unpaidAmount)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History Section - same structure as ViewPaymentsModal */}
          <div className="bg-accent/30 rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2">
                <History size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground">Payment History</h3>
                <Badge className="bg-muted text-muted-foreground text-xs">{filtered.length}</Badge>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <DollarSign size={24} className="text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm mb-1">No ledger entries for this stage yet</p>
                <p className="text-muted-foreground text-xs">Pay via Accounting → Worker Payments to record payments.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-3">Amount</div>
                  <div className="col-span-4">Notes</div>
                  <div className="col-span-3 text-center">Status</div>
                </div>
                {filtered.map((entry) => {
                  const isPaid = (entry.status || '').toLowerCase() === 'paid';
                  return (
                    <div
                      key={entry.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-accent/30 transition-colors"
                    >
                      <div className="col-span-2">
                        <p className="text-sm text-foreground">
                          {entry.created_at ? format(new Date(entry.created_at), 'dd MMM yyyy HH:mm') : '—'}
                        </p>
                        {isPaid && entry.paid_at && (
                          <p className="text-xs text-muted-foreground">Paid {format(new Date(entry.paid_at), 'dd MMM yyyy')}</p>
                        )}
                      </div>
                      <div className="col-span-3">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(entry.amount)}</p>
                      </div>
                      <div className="col-span-4">
                        <p className="text-xs text-muted-foreground truncate">{entry.notes || '—'}</p>
                      </div>
                      <div className="col-span-3 flex justify-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            isPaid ? 'bg-green-500/20 text-[var(--erp-money-positive)] border-green-700' : 'bg-orange-500/20 text-orange-400 border-orange-700',
                            'shrink-0 text-xs'
                          )}
                        >
                          {isPaid ? 'Paid' : 'Payable'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hint - Worker payments are via Accounting */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
            <p className="text-xs text-blue-300/90">
              Pay via <strong className="text-blue-400">Accounting → Worker Payments</strong> to record payments.
            </p>
          </div>
        </div>

        {/* Footer - same as ViewPaymentsModal */}
        <div className="border-t border-border pt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}</span>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-muted hover:bg-muted text-foreground border-border"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
