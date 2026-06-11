import { Paperclip } from 'lucide-react';

export interface PaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  method: string;
  referenceNo: string;
  notes?: string;
  attachments?: { url: string; name: string }[];
}

interface PaymentHistoryListProps {
  items: PaymentHistoryItem[];
  title?: string;
  onOpenAttachments?: (attachments: { url: string; name: string }[], startIndex?: number) => void;
}

export function PaymentHistoryList({
  items,
  title = 'Payment History',
  onOpenAttachments,
}: PaymentHistoryListProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
      <h3 className="text-sm font-medium text-[#9CA3AF] mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="flex justify-between items-center text-sm py-2 border-b border-[#374151] last:border-0 gap-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium">Rs. {p.amount.toLocaleString()}</p>
              <p className="text-xs text-[#9CA3AF]">
                {p.method} • {p.date}
              </p>
              {p.referenceNo !== '—' && (
                <p className="text-xs text-[#6B7280]">Ref: {p.referenceNo}</p>
              )}
              {p.notes ? (
                <p className="text-xs text-[#9CA3AF] mt-1 break-words">{p.notes}</p>
              ) : null}
            </div>
            {p.attachments && p.attachments.length > 0 && onOpenAttachments ? (
              <button
                type="button"
                onClick={() => onOpenAttachments(p.attachments!, 0)}
                className="p-2 rounded-lg text-[#3B82F6] hover:bg-[#374151] shrink-0"
                aria-label="View attachments"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
