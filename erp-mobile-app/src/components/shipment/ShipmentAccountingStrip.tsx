import { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { getShipmentJournalEntry } from '../../api/shipmentAccounting';

interface ShipmentAccountingStripProps {
  saleShipmentId: string | null;
}

export function ShipmentAccountingStrip({ saleShipmentId }: ShipmentAccountingStripProps) {
  const [entryNo, setEntryNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!saleShipmentId) {
      setEntryNo(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getShipmentJournalEntry(saleShipmentId).then((res) => {
      if (cancelled) return;
      setEntryNo(res.entryNo);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [saleShipmentId]);

  if (!saleShipmentId) return null;

  return (
    <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg p-3 flex items-start gap-2">
      <BookOpen className="w-4 h-4 text-[#C4B5FD] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#C4B5FD] uppercase tracking-wide">Chart of accounts</p>
        {loading ? (
          <Loader2 className="w-4 h-4 text-[#9CA3AF] animate-spin mt-1" />
        ) : entryNo ? (
          <p className="text-sm text-white mt-0.5">
            Posted to ledger · <span className="font-mono text-[#E9D5FF]">{entryNo}</span>
          </p>
        ) : (
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Not posted yet (book with cost/charge to post shipping accounts).
          </p>
        )}
      </div>
    </div>
  );
}
