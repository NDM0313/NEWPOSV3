import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types';
import {
  createExpense,
  ensureDefaultExpenseCategories,
  getExpenseCategoryTree,
  uploadExpenseReceipt,
  type ExpenseCategoryTreeItem,
} from '../../api/expenses';
import { isRealBranchUuid } from '../../utils/branchId';
import { useWriteBranchSelection } from '../../hooks/useWriteBranchSelection';
import { WriteBranchPickerField } from '../shared/WriteBranchPickerField';
import { CustomSelect } from '../common';
import { resolveExpenseCategoryIdFromLevels } from '../../lib/expenseCategoryTreeUtils';
import {
  MobilePaymentSheet,
  type MobilePaymentSheetSubmitPayload,
  type MobilePaymentSheetSubmitResult,
} from '../shared/MobilePaymentSheet';
import type { ReceiptOcrRouteSeed } from '../../lib/ocr/receiptOcrRouteSeed';

interface ExpenseEntryFlowProps {
  onBack: () => void;
  onComplete: () => void;
  user: User;
  companyId?: string | null;
  branchId?: string | null;
  ocrSeed?: ReceiptOcrRouteSeed | null;
}

export function ExpenseEntryFlow({ onBack, onComplete, user, companyId, branchId, ocrSeed }: ExpenseEntryFlowProps) {
  const [categoryTree, setCategoryTree] = useState<ExpenseCategoryTreeItem[]>([]);
  const [mainCategoryId, setMainCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [leafCategoryId, setLeafCategoryId] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [description, setDescription] = useState(() => String(ocrSeed?.notes ?? '').trim());
  const [showSheet, setShowSheet] = useState(false);

  const {
    effectiveBranchId: writeBranchId,
    needsPicker,
    pickerBranches,
    pickedBranchId,
    setPickedBranchId,
  } = useWriteBranchSelection({
    companyId,
    globalBranchId: branchId,
    userRole: user.role,
    authUserId: user.id,
    profileId: user.profileId ?? null,
  });

  const reloadCategoryTree = useCallback(async () => {
    if (!companyId) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      let { data, error } = await getExpenseCategoryTree(companyId);
      if (error) {
        setCategoriesError(error);
        setCategoryTree([]);
        return;
      }
      if ((data?.length ?? 0) === 0) {
        await ensureDefaultExpenseCategories(companyId);
        const reload = await getExpenseCategoryTree(companyId);
        data = reload.data;
        if (reload.error) setCategoriesError(reload.error);
      }
      setCategoryTree(data || []);
    } finally {
      setCategoriesLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void reloadCategoryTree();
  }, [reloadCategoryTree]);

  const selectedMain = categoryTree.find((m) => m.id === mainCategoryId);
  const subOptions = selectedMain?.children ?? [];
  const selectedSub = subOptions.find((s) => s.id === subCategoryId);
  const leafOptions = selectedSub?.children ?? [];
  const selectedLeaf = leafOptions.find((n) => n.id === leafCategoryId);
  const deepestCategory = selectedLeaf ?? selectedSub ?? selectedMain;
  const resolvedCategoryId = resolveExpenseCategoryIdFromLevels(
    mainCategoryId,
    subCategoryId,
    leafCategoryId,
  );
  const categoryLabel = useMemo(() => {
    const parts = [selectedMain?.name, selectedSub?.name, selectedLeaf?.name].filter(Boolean);
    return parts.join(' › ') || deepestCategory?.name || '';
  }, [selectedMain, selectedSub, selectedLeaf, deepestCategory]);

  const handleSubmit = async (payload: MobilePaymentSheetSubmitPayload): Promise<MobilePaymentSheetSubmitResult> => {
    if (!companyId || !writeBranchId || !isRealBranchUuid(writeBranchId)) {
      return { success: false, error: 'Select a branch to record this expense.' };
    }
    if (!resolvedCategoryId || !deepestCategory) {
      return { success: false, error: 'Select an expense category.' };
    }
    const methodForApi = payload.method === 'wallet' ? 'other' : payload.method;
    let receiptUrl: string | null = null;
    let attachmentWarning: string | null = null;
    if (payload.attachments.length > 0) {
      const upload = await uploadExpenseReceipt(companyId, payload.attachments[0]);
      if (upload.error) {
        attachmentWarning = `Expense saved without receipt: ${upload.error}`;
      } else {
        receiptUrl = upload.url;
      }
    }
    const { data, error } = await createExpense({
      companyId,
      branchId: writeBranchId,
      category: deepestCategory.slug || deepestCategory.name,
      expenseCategoryId: resolvedCategoryId,
      description: description.trim() || deepestCategory.name,
      amount: payload.amount,
      paymentMethod: methodForApi,
      userId: user.id,
      expenseDate: payload.paymentDate,
      paymentAccountId: payload.accountId,
      receiptUrl,
    });
    return {
      success: !!data,
      error: error ?? null,
      paymentId: data?.id ?? null,
      referenceNumber: data?.expense_no ?? null,
      partyAccountName: categoryLabel || deepestCategory.name,
      attachmentWarning,
    };
  };

  const canContinue =
    Boolean(resolvedCategoryId) &&
    description.trim().length > 0 &&
    Boolean(writeBranchId && isRealBranchUuid(writeBranchId));

  if (showSheet && companyId && writeBranchId && isRealBranchUuid(writeBranchId)) {
    return (
      <MobilePaymentSheet
        mode="expense"
        companyId={companyId}
        branchId={writeBranchId}
        userId={user.id}
        partyName={categoryLabel || deepestCategory?.name || 'Expense'}
        referenceNo={description.slice(0, 40)}
        hideSummary
        hidePayFull
        allowOverpayment
        initialAmount={ocrSeed?.amount && ocrSeed.amount > 0 ? ocrSeed.amount : undefined}
        defaultPaymentNotes={ocrSeed?.notes ?? null}
        initialReference={ocrSeed?.reference ?? null}
        initialPaymentDate={ocrSeed?.date ?? null}
        initialPaymentTime={ocrSeed?.time ?? null}
        initialAttachmentFiles={ocrSeed?.attachmentFiles?.length ? ocrSeed.attachmentFiles : null}
        onClose={() => setShowSheet(false)}
        onSuccess={onComplete}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10 flow-screen-header">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-white">Expense Entry</h1>
            <p className="text-xs text-white/80">Select a category and describe the expense</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {needsPicker && pickerBranches.length > 1 && (
          <WriteBranchPickerField
            branches={pickerBranches}
            value={pickedBranchId}
            onChange={setPickedBranchId}
            helperText="Expense will be recorded under the selected branch."
            zIndexClass="z-[90]"
          />
        )}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <span className="block text-sm font-medium text-[#D1D5DB] mb-2">Category *</span>
          {categoriesLoading ? (
            <p className="text-sm text-[#9CA3AF]">Loading categories…</p>
          ) : categoriesError ? (
            <div className="space-y-2">
              <p className="text-sm text-[#FCA5A5]">{categoriesError}</p>
              <button
                type="button"
                onClick={() => void reloadCategoryTree()}
                className="text-xs text-[#93C5FD] underline"
              >
                Retry
              </button>
            </div>
          ) : categoryTree.length > 0 ? (
            <div className="space-y-3">
              <CustomSelect
                value={mainCategoryId}
                onChange={(v) => {
                  setMainCategoryId(v);
                  setSubCategoryId('');
                  setLeafCategoryId('');
                }}
                options={[
                  { value: '', label: 'Select main category' },
                  ...categoryTree.map((m) => ({ value: m.id, label: m.name })),
                ]}
                placeholder="Main category"
                zIndexClass="z-[90]"
              />
              {subOptions.length > 0 && (
                <CustomSelect
                  value={subCategoryId}
                  onChange={(v) => {
                    setSubCategoryId(v);
                    setLeafCategoryId('');
                  }}
                  options={[
                    { value: '', label: `— ${selectedMain?.name ?? 'Category'} (main)` },
                    ...subOptions.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  placeholder="Subcategory (optional)"
                  zIndexClass="z-[90]"
                />
              )}
              {leafOptions.length > 0 && (
                <CustomSelect
                  value={leafCategoryId}
                  onChange={setLeafCategoryId}
                  options={[
                    { value: '', label: `— ${selectedSub?.name ?? selectedMain?.name ?? 'Parent'} (sub)` },
                    ...leafOptions.map((n) => ({ value: n.id, label: n.name })),
                  ]}
                  placeholder="Detail category (optional)"
                  zIndexClass="z-[90]"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-[#9CA3AF]">
              No expense categories yet. Create them under Expenses → Categories.
            </p>
          )}
        </div>
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the expense..."
            rows={4}
            className="w-full px-4 py-3 bg-[#374151] border border-[#4B5563] rounded-lg text-white placeholder-[#6B7280] focus:outline-none focus:border-[#EF4444] resize-none"
          />
        </div>
      </div>

      <div className="fixed left-0 right-0 bg-[#1F2937] border-t border-[#374151] p-4 z-[60] fixed-bottom-above-nav">
        <button
          onClick={() => setShowSheet(true)}
          disabled={!canContinue}
          className="w-full py-3.5 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-[#EF4444] to-[#DC2626]"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
}
