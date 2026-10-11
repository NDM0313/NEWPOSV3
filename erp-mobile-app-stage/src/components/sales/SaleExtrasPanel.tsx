import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Plus, Truck, X } from 'lucide-react';
import { NumericInput } from '../common/NumericInput';
import * as expensesApi from '../../api/expenses';
import {
  getTailorOptionsForExtraType,
  tailorNameByCategoryId,
} from '../../lib/expenseCategoryTailors';
import {
  EXTRA_EXPENSE_TYPE_OPTIONS,
  type ExtraExpense,
  type ExtraExpenseType,
} from '../../types/saleExtras';

interface SaleExtrasPanelProps {
  locked: boolean;
  companyId: string | null;
  chargeExtrasToCustomer: boolean;
  onChargeExtrasToCustomerChange: (value: boolean) => void;
  extraExpenses: ExtraExpense[];
  onExtraExpensesChange: (next: ExtraExpense[]) => void;
  shippingCharge: number;
  onShippingChargeChange: (amount: number) => void;
}

export function SaleExtrasPanel({
  locked,
  companyId,
  chargeExtrasToCustomer,
  onChargeExtrasToCustomerChange,
  extraExpenses,
  onExtraExpensesChange,
  shippingCharge,
  onShippingChargeChange,
}: SaleExtrasPanelProps) {
  const [newType, setNewType] = useState<ExtraExpenseType>('stitching');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTailorCategoryId, setNewTailorCategoryId] = useState('');
  const [categoryTree, setCategoryTree] = useState<expensesApi.ExpenseCategoryTreeItem[]>([]);
  const [shippingInput, setShippingInput] = useState(
    shippingCharge > 0 ? String(shippingCharge) : '',
  );

  useEffect(() => {
    setShippingInput(shippingCharge > 0 ? String(shippingCharge) : '');
  }, [shippingCharge]);

  useEffect(() => {
    if (!companyId || locked) return;
    let cancelled = false;
    expensesApi.getExpenseCategoryTree(companyId).then(({ data }) => {
      if (!cancelled) setCategoryTree(data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, locked]);

  const tailorOptions = useMemo(
    () => getTailorOptionsForExtraType(categoryTree, newType),
    [categoryTree, newType],
  );

  useEffect(() => {
    if (newTailorCategoryId && !tailorOptions.some((t) => t.id === newTailorCategoryId)) {
      setNewTailorCategoryId('');
    }
  }, [newType, tailorOptions, newTailorCategoryId]);

  const expensesTotal = extraExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleAddExpense = () => {
    const amt = parseFloat(newAmount || '0');
    if (!Number.isFinite(amt) || amt <= 0) return;
    onExtraExpensesChange([
      ...extraExpenses,
      {
        id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: newType,
        amount: amt,
        notes: newNotes.trim() || undefined,
        tailorExpenseCategoryId: newTailorCategoryId || undefined,
      },
    ]);
    setNewAmount('');
    setNewNotes('');
    setNewTailorCategoryId('');
  };

  const applyShipping = (raw: string) => {
    setShippingInput(raw);
    if (raw === '') {
      onShippingChargeChange(0);
      return;
    }
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) onShippingChargeChange(parsed);
  };

  const showTailorPicker =
    newType === 'stitching' || newType === 'lining' || newType === 'dying';

  return (
    <div className={locked ? 'opacity-60 pointer-events-none space-y-4' : 'space-y-4'}>
      {locked && (
        <p className="text-xs text-[#6B7280]">
          Set document type to <span className="text-[#9CA3AF] font-medium">Order</span> or{' '}
          <span className="text-[#9CA3AF] font-medium">Final</span> to add extra expenses and shipping
          (studio orders always allow these).
        </p>
      )}

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[#9CA3AF] flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#A855F7]" />
            Extra Expenses
          </h3>
          {expensesTotal > 0 && (
            <span className="text-xs font-semibold text-[#A855F7] bg-[#A855F7]/15 px-2 py-0.5 rounded">
              Rs. {expensesTotal.toLocaleString()}
            </span>
          )}
        </div>

        <label className="flex items-start gap-3 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={chargeExtrasToCustomer}
            onChange={(e) => onChargeExtrasToCustomerChange(e.target.checked)}
            disabled={locked}
            className="mt-1 w-4 h-4 rounded border-[#374151] bg-[#111827] text-[#3B82F6] focus:ring-[#3B82F6]"
          />
          <span className="text-sm text-[#D1D5DB]">
            Add extra expenses to customer bill
            <span className="block text-xs text-[#6B7280] mt-0.5">
              Off = inclusive in package (4120 split on GL, not on invoice total). Max 25% of invoice
              when off.
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-2 mb-3">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as ExtraExpenseType)}
            disabled={locked}
            className="h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
          >
            {EXTRA_EXPENSE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {showTailorPicker && (
            <select
              value={newTailorCategoryId}
              onChange={(e) => setNewTailorCategoryId(e.target.value)}
              disabled={locked}
              className="h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="">
                {tailorOptions.length > 0
                  ? 'Tailor / dyer (optional)'
                  : 'Add tailors under Expenses → Categories'}
              </option>
              {tailorOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <NumericInput
              value={newAmount}
              onChange={setNewAmount}
              allowDecimal
              placeholder="Amount"
              disabled={locked}
              className="flex-1 min-w-0"
              inputClassName="!h-10 !text-sm"
            />
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Notes (optional)"
              disabled={locked}
              className="flex-[2] h-10 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6]"
            />
            <button
              type="button"
              onClick={handleAddExpense}
              disabled={locked}
              className="w-10 h-10 shrink-0 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-[#374151] rounded-lg flex items-center justify-center"
              aria-label="Add expense"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {extraExpenses.length > 0 && (
          <div className="space-y-2">
            {extraExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex justify-between items-center p-2 bg-[#111827] rounded-lg border border-[#374151]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white capitalize">{expense.type}</p>
                  {(expense.tailorExpenseCategoryId || expense.tailorContactId || expense.notes) && (
                    <p className="text-xs text-[#6B7280] truncate">
                      {[
                        expense.tailorExpenseCategoryId
                          ? tailorNameByCategoryId(categoryTree, expense.tailorExpenseCategoryId) ??
                            'Tailor'
                          : null,
                        expense.notes,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-semibold text-[#A855F7]">
                    Rs. {expense.amount.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onExtraExpensesChange(extraExpenses.filter((e) => e.id !== expense.id))
                    }
                    disabled={locked}
                    className="p-1 text-[#6B7280] hover:text-[#EF4444]"
                    aria-label="Remove"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
        <h3 className="text-sm font-medium text-[#9CA3AF] flex items-center gap-2 mb-3">
          <Truck className="w-4 h-4 text-[#3B82F6]" />
          Shipping Charge
        </h3>
        <NumericInput
          value={shippingInput}
          onChange={applyShipping}
          allowDecimal
          placeholder="Amount"
          disabled={locked}
          inputClassName="!h-10 !text-sm"
        />
      </div>
    </div>
  );
}
