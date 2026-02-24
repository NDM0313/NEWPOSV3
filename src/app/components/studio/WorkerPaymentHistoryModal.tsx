import React from 'react';
import { X, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';

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
  const filtered = entries.filter(
    (e) => e.reference_type === 'studio_production_stage' && e.reference_id === stageId
  );
  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const paidAmount = filtered.filter((e) => (e.status || '').toLowerCase() === 'paid').reduce((s, e) => s + (e.amount || 0), 0);
  const unpaidAmount = totalAmount - paidAmount;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center justify-between">
            <span>Payment History</span>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded"
            >
              <X size={20} />
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto">
          <div className="text-sm text-gray-400">
            <p><span className="text-gray-500">Job:</span> <span className="text-white font-mono">{jobCardId}</span></p>
            <p><span className="text-gray-500">Customer:</span> <span className="text-white">{customerName}</span></p>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="bg-gray-800/50 rounded-lg px-4 py-2">
              <p className="text-gray-400 text-xs">Total</p>
              <p className="font-bold text-white">Rs {totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg px-4 py-2">
              <p className="text-green-400/80 text-xs">Paid</p>
              <p className="font-bold text-green-400">Rs {paidAmount.toLocaleString()}</p>
            </div>
            <div className="bg-orange-500/10 rounded-lg px-4 py-2">
              <p className="text-orange-400/80 text-xs">Pending</p>
              <p className="font-bold text-orange-400">Rs {unpaidAmount.toLocaleString()}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Entries</p>
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No payment entries for this job</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((entry) => {
                  const isPaid = (entry.status || '').toLowerCase() === 'paid';
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-4 py-3 px-4 border border-gray-800 rounded-lg bg-gray-800/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isPaid ? (
                          <CheckCircle size={18} className="text-green-500 shrink-0" />
                        ) : (
                          <Clock size={18} className="text-orange-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-white">Rs {entry.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">
                            {entry.created_at ? format(new Date(entry.created_at), 'dd MMM yyyy HH:mm') : '—'}
                            {isPaid && entry.paid_at && ` · Paid ${format(new Date(entry.paid_at), 'dd MMM yyyy')}`}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(isPaid ? 'bg-green-500/20 text-green-400 border-green-700' : 'bg-orange-500/20 text-orange-400 border-orange-700', 'shrink-0')}
                      >
                        {isPaid ? 'Paid' : 'Payable'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Pay via Accounting → Worker Payments to record payments.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
