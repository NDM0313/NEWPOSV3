import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  FileText,
  CheckCircle2,
  DollarSign,
  Edit,
  Trash2,
  Clock,
  RotateCcw,
} from 'lucide-react';
import * as activityApi from '../../api/activityLog';

interface SaleActivitySheetProps {
  open: boolean;
  onClose: () => void;
  companyId: string | null;
  saleId: string;
  saleLabel: string;
}

function actionIcon(action: string) {
  switch (action) {
    case 'create':
      return <FileText className="w-4 h-4 text-[#9CA3AF]" />;
    case 'status_change':
      return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
    case 'payment_added':
      return <DollarSign className="w-4 h-4 text-[#3B82F6]" />;
    case 'payment_deleted':
      return <DollarSign className="w-4 h-4 text-[#EF4444]" />;
    case 'payment_edited':
      return <DollarSign className="w-4 h-4 text-[#F59E0B]" />;
    case 'update':
    case 'sale_component_edited':
      return <Edit className="w-4 h-4 text-[#F59E0B]" />;
    case 'delete':
      return <Trash2 className="w-4 h-4 text-[#EF4444]" />;
    default:
      return <Clock className="w-4 h-4 text-[#9CA3AF]" />;
  }
}

function actionBg(action: string): string {
  switch (action) {
    case 'payment_added':
      return 'bg-[#3B82F6]/20';
    case 'payment_deleted':
      return 'bg-[#EF4444]/20';
    case 'status_change':
      return 'bg-[#10B981]/20';
    case 'update':
    case 'sale_component_edited':
      return 'bg-[#F59E0B]/20';
    default:
      return 'bg-[#374151]/50';
  }
}

export function SaleActivitySheet({ open, onClose, companyId, saleId, saleLabel }: SaleActivitySheetProps) {
  const [logs, setLogs] = useState<activityApi.ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !companyId || !saleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    activityApi.getEntityActivityLogs(companyId, 'sale', saleId).then(({ data, error: err }) => {
      if (cancelled) return;
      setLoading(false);
      if (err) setError(err);
      setLogs(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, saleId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1F2937] rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-[#374151]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sale activity"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151] shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Activity</h2>
            <p className="text-xs text-[#9CA3AF]">{saleLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#374151] text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-[#FCA5A5] text-center py-8">{error}</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No activity recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${actionBg(log.action)}`}
                    >
                      {actionIcon(log.action)}
                    </div>
                    {index < logs.length - 1 && <div className="w-0.5 flex-1 bg-[#374151] mt-2 min-h-[24px]" />}
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <p className="text-sm text-white font-medium leading-snug">
                      {log.description || activityApi.formatActivityLog(log)}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-1">
                      {new Date(log.created_at).toLocaleString('en-PK', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {log.performed_by_name && (
                      <p className="text-xs text-[#6B7280] mt-0.5">By: {log.performed_by_name}</p>
                    )}
                    {log.field && log.old_value !== undefined && log.new_value !== undefined && (
                      <p className="text-xs text-[#6B7280] mt-0.5 break-words">
                        {log.field}: {String(log.old_value)} → {String(log.new_value)}
                      </p>
                    )}
                    {log.amount != null && Number(log.amount) > 0 && (
                      <p className="text-xs text-[#10B981] mt-0.5">
                        Rs. {Number(log.amount).toLocaleString()}
                        {log.payment_method ? ` · ${log.payment_method}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
