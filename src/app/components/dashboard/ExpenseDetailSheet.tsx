import React, { useRef } from 'react';
import { Pencil, Trash, Paperclip } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Sheet, SheetContent } from '../ui/sheet';
import { cn } from '../ui/utils';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { AttachmentPreviewRow } from '@/app/components/shared/AttachmentPreviewRow';
import type { Expense } from '@/app/context/ExpenseContext';

interface ExpenseDetailSheetProps {
  open: boolean;
  expense: Expense | null;
  categoryPath?: string;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  getStatusBadgeStyle: (status: string) => string;
}

function receiptFileName(url: string): string {
  const base = url.split('/').pop() || 'receipt';
  try {
    return decodeURIComponent(base.replace(/^\d+_/, ''));
  } catch {
    return base;
  }
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export function ExpenseDetailSheet({
  open,
  expense,
  categoryPath,
  onClose,
  onEdit,
  onDelete,
  getStatusBadgeStyle,
}: ExpenseDetailSheetProps) {
  const { formatCurrency } = useFormatCurrency();
  const receiptSectionRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-full sm:max-w-md bg-background border-l border-border text-foreground overflow-y-auto p-0">
        {expense ? (
          <div className="flex flex-col min-h-full">
            <div className="bg-input-background/80 border-b border-border px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Expense</p>
                    <h2 className="text-xl font-bold text-foreground mt-1 truncate">
                      {expense.expenseNo || expense.id.slice(0, 8)}
                    </h2>
                  </div>
                  {expense.receiptUrl ? (
                    <button
                      type="button"
                      onClick={() => receiptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                      className="mt-5 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors shrink-0"
                      title="View attachment"
                    >
                      <Paperclip size={18} className="text-amber-400" />
                    </button>
                  ) : null}
                </div>
                <Badge className={cn('shrink-0 capitalize', getStatusBadgeStyle(expense.status))}>
                  {expense.status}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-red-400 mt-3">-{formatCurrency(expense.amount)}</p>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/60 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Date</p>
                  <p className="text-sm text-foreground mt-1">{new Date(expense.date).toLocaleDateString()}</p>
                </div>
                <div className="bg-muted/60 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Category</p>
                  <p className="text-sm text-foreground mt-1 truncate" title={categoryPath || expense.category}>
                    {categoryPath || expense.category}
                  </p>
                </div>
                <div className="bg-muted/60 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Paid from</p>
                  <p className="text-sm text-foreground mt-1 truncate" title={expense.paymentAccountDisplay || expense.paymentMethod}>
                    {expense.paymentAccountDisplay || expense.paymentMethod || '—'}
                  </p>
                </div>
                <div className="bg-muted/60 border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Payee</p>
                  <p className="text-sm text-foreground mt-1 truncate" title={expense.payeeName || '—'}>
                    {expense.payeeName || '—'}
                  </p>
                </div>
              </div>

              {expense.submittedBy ? (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium">Created by</p>
                  <p className="text-foreground mt-1">{expense.submittedBy}</p>
                </div>
              ) : null}

              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Description</p>
                <p className="text-foreground mt-1 whitespace-pre-wrap break-words">{expense.description || '—'}</p>
              </div>

              {expense.receiptUrl ? (
                <div ref={receiptSectionRef}>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-2">Receipt / attachment</p>
                  {isPdfUrl(expense.receiptUrl) ? (
                    <div className="rounded-lg bg-muted/50 border border-border p-4">
                      <p className="text-sm text-muted-foreground mb-3">{receiptFileName(expense.receiptUrl)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-muted-foreground hover:bg-muted"
                        onClick={() => window.open(expense.receiptUrl!, '_blank')}
                      >
                        Open PDF
                      </Button>
                    </div>
                  ) : (
                    <AttachmentPreviewRow
                      att={{ url: expense.receiptUrl, name: receiptFileName(expense.receiptUrl) }}
                    />
                  )}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 border-t border-border bg-background px-6 py-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-border text-muted-foreground"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500"
                onClick={() => onEdit(expense)}
              >
                <Pencil size={16} className="mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="border-red-800/60 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                onClick={() => onDelete(expense)}
              >
                <Trash size={16} />
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
