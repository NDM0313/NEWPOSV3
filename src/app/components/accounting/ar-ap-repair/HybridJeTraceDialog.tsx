import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import {
  fetchJournalDetailForLab,
  type JournalDetailForLab,
} from '@/app/services/arApRepairWorkflowService';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalEntryId: string | null;
  entryNo?: string | null;
};

export function HybridJeTraceDialog({ open, onOpenChange, journalEntryId, entryNo }: Props) {
  const { formatCurrency } = useFormatCurrency();
  const [detail, setDetail] = useState<JournalDetailForLab | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !journalEntryId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchJournalDetailForLab(journalEntryId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, journalEntryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Source journal trace</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Read-only — mis-posted rental JE (original row is not edited by GL correction).
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          </div>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground py-4">Journal not found{entryNo ? ` (${entryNo})` : ''}.</p>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                <span className="text-muted-foreground">Entry</span>
                <p className="font-mono text-blue-300">{detail.entry_no || entryNo || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date</span>
                <p>{detail.entry_date || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Description</span>
                <p>{detail.description || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Reference</span>
                <p>
                  {detail.reference_type || '—'}
                  {detail.reference_id ? ` · ${detail.reference_id.slice(0, 8)}…` : ''}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Void</span>
                <p>{detail.is_void ? 'Yes' : 'No'}</p>
              </div>
            </div>
            <table className="w-full border border-border rounded overflow-hidden">
              <thead>
                <tr className="bg-card text-muted-foreground">
                  <th className="text-left p-2">Account</th>
                  <th className="text-right p-2">Dr</th>
                  <th className="text-right p-2">Cr</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.id} className="border-t border-border/80">
                    <td className="p-2 text-gray-200">
                      <span className="font-mono text-violet-300">{line.account_code || '—'}</span>
                      {line.account_name ? <span className="text-muted-foreground ml-1">{line.account_name}</span> : null}
                    </td>
                    <td className="p-2 text-right tabular-nums">{line.debit ? formatCurrency(line.debit) : '—'}</td>
                    <td className="p-2 text-right tabular-nums">{line.credit ? formatCurrency(line.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
