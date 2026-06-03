import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, Loader2 } from 'lucide-react';
import * as expensesApi from '../../api/expenses';
import { displayLabelForCategoryId } from '../../lib/expenseCategoryTreeUtils';
import type { ExpenseCategoryTreeItem } from '../../api/expenses';
import { AttachmentPreviewModal } from '../sales/AttachmentPreviewModal';

interface ExpenseDetailSheetProps {
  expenseId: string | null;
  companyId: string;
  categoryTree: ExpenseCategoryTreeItem[];
  onClose: () => void;
  onEdit: (expense: expensesApi.ExpenseRow) => void;
  onDelete: (expense: expensesApi.ExpenseRow) => void;
}

function formatStatus(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
}

function receiptName(url: string): string {
  const base = url.split('/').pop() || 'receipt';
  try {
    return decodeURIComponent(base.replace(/^\d+_/, ''));
  } catch {
    return base;
  }
}

export function ExpenseDetailSheet({
  expenseId,
  companyId,
  categoryTree,
  onClose,
  onEdit,
  onDelete,
}: ExpenseDetailSheetProps) {
  const [expense, setExpense] = useState<expensesApi.ExpenseRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (!expenseId || !companyId) {
      setExpense(null);
      return;
    }
    setLoading(true);
    setError(null);
    expensesApi.getExpenseById(companyId, expenseId).then(({ data, error: err }) => {
      setLoading(false);
      if (err) setError(err);
      setExpense(data);
    });
  }, [expenseId, companyId]);

  if (!expenseId) return null;

  const categoryLabel = expense?.expense_category_id
    ? displayLabelForCategoryId(categoryTree, expense.expense_category_id, expense.category)
    : expense?.category || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full md:w-[32rem] bg-[#111827] rounded-t-2xl md:rounded-2xl border border-[#374151] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold text-white">Expense details</h2>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-[#1F2937] rounded-lg text-[#9CA3AF]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="py-16 flex items-center justify-center text-[#9CA3AF]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="m-4 p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-sm text-[#EF4444]">{error}</div>
        )}

        {expense && !loading && (
          <div className="p-4 space-y-4">
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-[#6B7280] uppercase">Reference</p>
                  <p className="text-sm font-mono text-white mt-0.5">{expense.expense_no || expense.id.slice(0, 8)}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-[#374151] text-[#D1D5DB] capitalize">
                  {formatStatus(expense.status)}
                </span>
              </div>
              <p className="text-2xl font-bold text-[#EF4444] mt-3">- Rs. {expense.amount.toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
                <p className="text-[10px] text-[#6B7280] uppercase">Date</p>
                <p className="text-sm text-white mt-1">
                  {new Date(expense.expense_date).toLocaleDateString('en-PK')}
                </p>
              </div>
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3">
                <p className="text-[10px] text-[#6B7280] uppercase">Category</p>
                <p className="text-sm text-white mt-1 truncate">{categoryLabel}</p>
              </div>
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-3 col-span-2">
                <p className="text-[10px] text-[#6B7280] uppercase">Paid from</p>
                <p className="text-sm text-white mt-1">{expense.payment_account_display || expense.payment_method}</p>
              </div>
            </div>

            {expense.created_by_name ? (
              <div>
                <p className="text-xs text-[#6B7280] uppercase mb-1">Created by</p>
                <p className="text-sm text-white">{expense.created_by_name}</p>
              </div>
            ) : null}

            <div>
              <p className="text-xs text-[#6B7280] uppercase mb-1">Description</p>
              <p className="text-sm text-white whitespace-pre-wrap break-words">{expense.description || '—'}</p>
            </div>

            {expense.vendor_name ? (
              <div>
                <p className="text-xs text-[#6B7280] uppercase mb-1">Payee</p>
                <p className="text-sm text-white">{expense.vendor_name}</p>
              </div>
            ) : null}

            {expense.receipt_url ? (
              <div>
                <p className="text-xs text-[#6B7280] uppercase mb-2">Receipt</p>
                <button
                  type="button"
                  onClick={() => setShowReceipt(true)}
                  className="w-full text-left px-3 py-2.5 bg-[#1F2937] border border-[#374151] rounded-lg text-sm text-[#93C5FD]"
                >
                  View attachment
                </button>
              </div>
            ) : null}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => onEdit(expense)}
                className="flex-1 h-11 flex items-center justify-center gap-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-xl text-white text-sm font-medium"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(expense)}
                className="h-11 px-4 flex items-center justify-center gap-2 border border-[#EF4444]/50 text-[#EF4444] rounded-xl text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {showReceipt && expense?.receipt_url ? (
        <AttachmentPreviewModal
          isOpen={showReceipt}
          attachments={[{ url: expense.receipt_url, name: receiptName(expense.receipt_url) }]}
          initialIndex={0}
          onClose={() => setShowReceipt(false)}
        />
      ) : null}
    </div>
  );
}
