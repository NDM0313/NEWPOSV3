import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Calendar, DollarSign, Search, Loader2, Upload, X, Users } from 'lucide-react';
import { TextInput, NumericInput, ActionBar, CustomSelect, CustomSearchableSheet, PullToRefresh, OfflineBanner, SwipeBackShell } from '../common';
import { useOfflineListMeta } from '../../hooks/useOfflineListMeta';
import { useMainScrollRef } from '../../contexts/MainScrollContext';
import type { User, Branch } from '../../types';
import { SwitchUserPinOverlay } from '../auth/SwitchUserPinOverlay';
import { isSharedCounterModeEnabled } from '../../lib/sharedCounterMode';
import { useEffectiveWorkerId, useEffectiveWorkerProfileId, useEffectiveWorkerRole } from '../../context/CounterWorkerContext';
import {
  rowBelongsToCounterWorker,
  resolveCounterListBranchScope,
  shouldIsolateCounterWorkerData,
} from '../../lib/counterDataIsolation';
import { rowInListBranchScope } from '../../lib/listBranchScope';
import * as expensesApi from '../../api/expenses';
import * as authApi from '../../api/auth';
import * as accountsApi from '../../api/accounts';
import { getUsersForSalary, type SalaryUserRow } from '../../api/users';
import { addPending } from '../../lib/offlineStore';
import { getCurrentLocalTimestamp, localNowDateString } from '../../utils/localDate';
import { sortByDocumentDateTimeDesc } from '../../utils/chronologicalSort';
import { usePermissions } from '../../context/PermissionContext';
import { formatAccountPickerSubtitle } from '../../utils/balancePrivacy';
import { prepareAttachmentFilesForUpload } from '../../utils/imageCompression';
import { MediaSourcePicker } from '../shared/MediaSourcePicker';
import { useDocumentBranchGate } from '../../hooks/useDocumentBranchGate';
import { useWriteBranchSelection } from '../../hooks/useWriteBranchSelection';
import { DocumentBranchGateModal } from '../shared/DocumentBranchGateModal';
import { WriteBranchPickerField } from '../shared/WriteBranchPickerField';

const MAX_EXPENSE_RECEIPT_BYTES = 5 * 1024 * 1024;

interface ExpenseModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
  onRequestCounterLock?: () => void;
}

type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

const CATEGORIES = [
  { value: 'all', label: 'All', icon: '📊' },
  { value: 'Rent', label: 'Rent', icon: '🏢' },
  { value: 'Utilities', label: 'Utilities', icon: '⚡' },
  { value: 'Salaries', label: 'Salaries', icon: '💼' },
  { value: 'Supplies', label: 'Supplies', icon: '📝' },
  { value: 'Transport', label: 'Transport', icon: '🚗' },
  { value: 'Other', label: 'Other', icon: '📊' },
];

const CATEGORY_OPTIONS = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Transport', 'Other'];
/** Map display name to DB enum slug (expense_category). */
const CATEGORY_TO_SLUG: Record<string, string> = {
  Rent: 'rent',
  Utilities: 'utilities',
  Salaries: 'salaries',
  Supplies: 'office_supplies',
  Transport: 'travel',
  Other: 'miscellaneous',
};

function getDateGroup(dateStr: string): DateGroup {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'today';
  if (d.getTime() === yesterday.getTime()) return 'yesterday';
  if (d >= weekAgo) return 'thisWeek';
  return 'older';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryIcon(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.icon ?? '📊';
}

export function ExpenseModule({ onBack, user, companyId, branch, onRequestCounterLock }: ExpenseModuleProps) {
  const effectiveUserId = useEffectiveWorkerId(user.id);
  const effectiveProfileId = useEffectiveWorkerProfileId() ?? user.profileId ?? null;
  const effectiveRole = useEffectiveWorkerRole(user.role);
  const isolateWorkerData = shouldIsolateCounterWorkerData(effectiveRole);
  const { canViewBalances, branchIds, isAdminOrOwner } = usePermissions();

  const listBranchScope = useMemo(
    () => resolveCounterListBranchScope(branch?.id, branchIds, isAdminOrOwner, isolateWorkerData),
    [branch?.id, branchIds, isAdminOrOwner, isolateWorkerData],
  );

  const [list, setList] = useState<
    {
      id: string;
      expense_no: string;
      date: string;
      created_at?: string;
      category: string;
      description: string;
      amount: number;
      branch_id?: string | null;
      created_by?: string | null;
      paid_to_user_id?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(!!companyId);
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState(CATEGORY_OPTIONS[0]);
  const [addDesc, setAddDesc] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Add form: account (Cash/Bank), category tree, attachment
  const [paymentAccounts, setPaymentAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [categoryTree, setCategoryTree] = useState<expensesApi.ExpenseCategoryTreeItem[]>([]);
  const [addAccountId, setAddAccountId] = useState('');
  const [mainCategoryId, setMainCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [addReceiptFile, setAddReceiptFile] = useState<File | null>(null);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null);
  const [documentBranchId, setDocumentBranchId] = useState<string | null>(null);
  const [paidToUserId, setPaidToUserId] = useState('');
  const [salaryUsers, setSalaryUsers] = useState<SalaryUserRow[]>([]);
  const [salaryUsersLoading, setSalaryUsersLoading] = useState(false);
  const [showSwitchUser, setShowSwitchUser] = useState(false);
  /** Calendar date in device local TZ (`YYYY-MM-DD`); matches `expenses.expense_date`. */
  const [addExpenseDate, setAddExpenseDate] = useState(localNowDateString);
  const { online, pendingCount } = useOfflineListMeta();
  const mainScrollRef = useMainScrollRef();

  const { runWithBranch, modalProps: branchGateModalProps, loading: branchGateLoading, loadError: branchGateError } =
    useDocumentBranchGate({
      companyId,
      globalBranchId: branch?.id ?? null,
      userRole: effectiveRole,
      authUserId: effectiveUserId,
      profileId: effectiveProfileId,
      invalidateDomains: ['contacts', 'sales'],
    });

  const {
    effectiveBranchId: writeBranchId,
    needsPicker: needsWriteBranchPicker,
    pickerBranches,
    pickedBranchId,
    setPickedBranchId,
  } = useWriteBranchSelection({
    companyId,
    globalBranchId: branch?.id ?? null,
    documentBranchId,
    userRole: effectiveRole,
    authUserId: effectiveUserId,
    profileId: effectiveProfileId,
  });

  const resetAddForm = useCallback(() => {
    setShowAdd(false);
    setDocumentBranchId(null);
    setAddDesc('');
    setAddAmount('');
    setAddAccountId('');
    setMainCategoryId('');
    setSubCategoryId('');
    setPaidToUserId('');
    setAddReceiptFile(null);
    setAddExpenseDate(localNowDateString());
  }, []);

  const handleOpenAdd = () => {
    if (!companyId || branchGateLoading) return;
    if (branch?.id === 'all') {
      runWithBranch(
        (pickedId) => {
          setDocumentBranchId(pickedId);
          setShowAdd(true);
        },
        { title: 'Select branch for expense' },
      );
      return;
    }
    setDocumentBranchId(null);
    setShowAdd(true);
  };

  useEffect(() => {
    if (showAdd) setAddExpenseDate(localNowDateString());
  }, [showAdd]);

  const loadExpenses = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      const scope = listBranchScope;
      const apiBranchId = scope.mode === 'single' ? scope.branchId : null;
      const accessibleBranchIds = scope.mode === 'accessible' ? scope.branchIds : undefined;
      const { data, error } = await expensesApi.getExpenses(companyId, apiBranchId, {
        accessibleBranchIds,
      });
      setLoading(false);
      if (!error && data) {
        setList(
          data.map(
            (r: {
              id: string;
              expense_no?: string;
              expense_date: string;
              created_at?: string;
              category: string;
              description?: string;
              amount: number;
              branch_id?: string | null;
              created_by?: string | null;
              paid_to_user_id?: string | null;
            }) => ({
              id: r.id,
              expense_no: r.expense_no || '—',
              date: r.expense_date,
              created_at: r.created_at,
              category: r.category,
              description: r.description || '',
              amount: r.amount,
              branch_id: r.branch_id ?? null,
              created_by: r.created_by ?? null,
              paid_to_user_id: r.paid_to_user_id ?? null,
            }),
          ),
        );
      }
    },
    [companyId, listBranchScope, user.id]
  );

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const onSync = () => void loadExpenses({ silent: true });
    window.addEventListener('erp-mobile:autosync-complete', onSync);
    return () => window.removeEventListener('erp-mobile:autosync-complete', onSync);
  }, [loadExpenses]);

  useEffect(() => {
    if (!showAdd || !companyId) return;
    accountsApi.getPaymentAccounts(companyId).then(({ data }) => setPaymentAccounts(data || []));
    expensesApi.getExpenseCategoryTree(companyId).then(({ data }) => setCategoryTree(data || []));
  }, [showAdd, companyId]);

  const selectedMain = categoryTree.find((m) => m.id === mainCategoryId);
  const subOptions = selectedMain?.children ?? [];
  const selectedSub = subOptions.find((s) => s.id === subCategoryId);
  const effectiveCategorySlug =
    categoryTree.length > 0 && (mainCategoryId || subCategoryId)
      ? (selectedSub?.slug ?? selectedMain?.slug ?? '')
      : (CATEGORY_TO_SLUG[addCategory] ?? addCategory.toLowerCase().replace(/\s+/g, '_'));

  const slugLower = (effectiveCategorySlug || '').toLowerCase();
  const isSalaryCategory =
    slugLower === 'salaries' ||
    slugLower === 'salary' ||
    slugLower === 'wages' ||
    selectedMain?.type === 'salary' ||
    selectedSub?.type === 'salary';

  useEffect(() => {
    if (!isSalaryCategory) {
      setPaidToUserId('');
      setSalaryUsers([]);
      setSalaryUsersLoading(false);
      return;
    }
    if (!showAdd || !companyId) return;
    let cancelled = false;
    setSalaryUsersLoading(true);
    getUsersForSalary(companyId)
      .then(({ data, error }) => {
        if (cancelled) return;
        setSalaryUsersLoading(false);
        if (error) setSalaryUsers([]);
        else setSalaryUsers(data || []);
      })
      .catch(() => {
        if (!cancelled) {
          setSalaryUsersLoading(false);
          setSalaryUsers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showAdd, companyId, isSalaryCategory]);

  const selectedAccount = paymentAccounts.find((a) => a.id === addAccountId);
  const paymentMethodFromAccount = selectedAccount
    ? selectedAccount.type === 'bank'
      ? 'bank'
      : selectedAccount.type === 'mobile_wallet' || selectedAccount.type === 'wallet'
        ? 'wallet'
        : 'cash'
    : 'cash';
  const handleAdd = async () => {
    const amt = parseFloat(addAmount);
    if (!companyId || !writeBranchId || isNaN(amt) || amt <= 0) {
      setAddError(
        needsWriteBranchPicker && !writeBranchId
          ? 'Select a branch for this expense.'
          : 'Enter a valid amount greater than zero.'
      );
      return;
    }
    if (!effectiveCategorySlug) {
      setAddError('Please select a category.');
      return;
    }
    const selectedSalaryUser = isSalaryCategory ? salaryUsers.find((u) => u.id === paidToUserId) : undefined;
    if (isSalaryCategory && !paidToUserId) {
      setAddError('Please select the user to pay (Salary is for Staff / Salesman / Operator only).');
      return;
    }
    const descriptionFinal =
      addDesc.trim() ||
      (isSalaryCategory && selectedSalaryUser ? `${selectedSalaryUser.full_name} – Salary` : '');
    if (!descriptionFinal) {
      setAddError('Enter a description or select a salary payee.');
      return;
    }
    if (paymentAccounts.length > 0 && !addAccountId) {
      setAddError('Please select an account (Cash/Bank).');
      return;
    }
    const session = await authApi.getSession();
    if (!session?.userId) {
      setAddError('Session expired.');
      return;
    }
    const expenseUserId = effectiveUserId;
    setSaving(true);
    setAddError(null);
    let receiptUrl: string | null = null;
    if (addReceiptFile && navigator.onLine) {
      const up = await expensesApi.uploadExpenseReceipt(companyId, addReceiptFile);
      if (up.error) {
        if (up.kind === 'bucket') {
          receiptUrl = null;
          setAddError(up.error);
        } else {
          setSaving(false);
          setAddError(up.error);
          return;
        }
      } else if (!up.url) {
        setSaving(false);
        setAddError('Receipt could not be uploaded. Remove the file or try again.');
        return;
      } else {
        receiptUrl = up.url;
      }
    }
    const paymentMethod = paymentAccounts.length > 0 ? paymentMethodFromAccount : 'cash';

    if (!navigator.onLine) {
      try {
        await addPending('expense', {
          companyId,
          branchId: writeBranchId,
          category: effectiveCategorySlug,
          description: descriptionFinal,
          amount: amt,
          paymentMethod,
          userId: expenseUserId,
          expenseDate: addExpenseDate,
          paymentAccountId: addAccountId || undefined,
          receiptUrl: receiptUrl || undefined,
          paidToUserId: isSalaryCategory && paidToUserId ? paidToUserId : undefined,
          payeeName: isSalaryCategory && selectedSalaryUser ? selectedSalaryUser.full_name : undefined,
        }, companyId, writeBranchId);
        const displayCategory = selectedSub?.name ?? selectedMain?.name ?? addCategory;
        const tempId = `offline-${Date.now()}`;
        setList((prev) => [
          {
            id: tempId,
            expense_no: 'Pending sync',
            date: addExpenseDate,
            created_at: getCurrentLocalTimestamp(),
            category: displayCategory,
            description: descriptionFinal,
            amount: amt,
            branch_id: writeBranchId,
            created_by: expenseUserId,
          },
          ...prev,
        ]);
        setAddError(null);
        resetAddForm();
      } catch (e) {
        setAddError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      setSaving(false);
      return;
    }

    const { data, error } = await expensesApi.createExpense({
      companyId,
      branchId: writeBranchId,
      category: effectiveCategorySlug,
      description: descriptionFinal,
      amount: amt,
      paymentMethod,
      userId: expenseUserId,
      expenseDate: addExpenseDate,
      paymentAccountId: addAccountId || undefined,
      receiptUrl: receiptUrl || undefined,
      paidToUserId: isSalaryCategory && paidToUserId ? paidToUserId : undefined,
      payeeName: isSalaryCategory && selectedSalaryUser ? selectedSalaryUser.full_name : undefined,
    });
    setSaving(false);
    if (error) {
      setAddError(error);
      return;
    }
    const displayCategory = selectedSub?.name ?? selectedMain?.name ?? addCategory;
    setList((prev) => [
      {
        id: data!.id,
        expense_no: data!.expense_no || '—',
        date: addExpenseDate,
        created_at: getCurrentLocalTimestamp(),
        category: displayCategory,
        description: descriptionFinal,
        amount: amt,
        branch_id: writeBranchId,
        created_by: expenseUserId,
      },
      ...prev,
    ]);
    setAddError(null);
    resetAddForm();
  };

  const scopedList = useMemo(() => {
    let rows = list.filter((e) =>
      rowInListBranchScope({ branch_id: e.branch_id }, listBranchScope),
    );
    if (isolateWorkerData) {
      rows = rows.filter((e) =>
        rowBelongsToCounterWorker(
          { created_by: e.created_by, paid_to_user_id: e.paid_to_user_id },
          effectiveUserId,
          effectiveProfileId,
        ),
      );
    }
    return rows;
  }, [list, listBranchScope, isolateWorkerData, effectiveUserId, effectiveProfileId]);

  const filtered = useMemo(() => {
    const rows = scopedList.filter((e) => {
      const matchCat = filterCategory === 'all' || e.category === filterCategory;
      const matchSearch =
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.expense_no.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
    return sortByDocumentDateTimeDesc(rows, (e) => ({
      documentDate: e.date,
      eventTimestamp: e.created_at ?? null,
    }));
  }, [scopedList, filterCategory, searchQuery]);

  const grouped = useMemo(() => {
    const acc = {} as Record<DateGroup, typeof list>;
    for (const e of filtered) {
      const g = getDateGroup(e.date);
      if (!acc[g]) acc[g] = [];
      acc[g].push(e);
    }
    return acc;
  }, [filtered]);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const todayAmount = (grouped.today || []).reduce((s, e) => s + e.amount, 0);
  const groupLabels: Record<DateGroup, string> = { today: 'Today', yesterday: 'Yesterday', thisWeek: 'This Week', older: 'Older' };

  if (showAdd) {
    return (
      <SwipeBackShell onBack={resetAddForm}>
      <div className="min-h-screen bg-[#111827] pb-32">
        <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={resetAddForm} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-white">Add Expense</h1>
              <p className="text-xs text-white/80">Record new business expense</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          {addError && (
            <div className="mb-4 p-3 bg-[#EF4444]/10 border border-[#EF4444]/50 rounded-xl text-[#EF4444] text-sm">{addError}</div>
          )}
          <div className="space-y-4">
            {needsWriteBranchPicker && pickerBranches.length > 1 && (
              <WriteBranchPickerField
                branches={pickerBranches}
                value={pickedBranchId}
                onChange={setPickedBranchId}
                helperText="Expense will be recorded under the selected branch."
                zIndexClass="z-[90]"
              />
            )}

            {/* Account (Cash/Bank) */}
            {paymentAccounts.length > 0 && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <CustomSelect
                  label="Paid from (Account) *"
                  value={addAccountId}
                  onChange={setAddAccountId}
                  options={[
                    { value: '', label: 'Select account (Cash / Bank)' },
                    ...paymentAccounts.map((acc) => ({
                      value: acc.id,
                      label: `${acc.name} (${acc.type})`,
                      subtitle: formatAccountPickerSubtitle(acc.balance, canViewBalances),
                    })),
                  ]}
                  placeholder="Select account"
                  zIndexClass="z-[90]"
                />
              </div>
            )}

            {/* Category: tree (main + sub) or fallback */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <span className="block text-sm font-medium text-[#D1D5DB] mb-2">Category *</span>
              {categoryTree.length > 0 ? (
                <div className="space-y-3">
                  <CustomSelect
                    value={mainCategoryId}
                    onChange={(v) => {
                      setMainCategoryId(v);
                      setSubCategoryId('');
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
                      onChange={setSubCategoryId}
                      options={[
                        { value: '', label: `— ${selectedMain?.name ?? 'Category'} (main)` },
                        ...subOptions.map((s) => ({ value: s.id, label: s.name })),
                      ]}
                      placeholder="Subcategory"
                      zIndexClass="z-[90]"
                    />
                  )}
                </div>
              ) : (
                <CustomSelect
                  value={addCategory}
                  onChange={setAddCategory}
                  options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                  zIndexClass="z-[90]"
                />
              )}
            </div>

            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label htmlFor="expense-date-input" className="block text-sm font-medium text-[#D1D5DB] mb-2">
                Expense date *
              </label>
              <input
                id="expense-date-input"
                type="date"
                value={addExpenseDate}
                max={localNowDateString()}
                onChange={(e) => setAddExpenseDate(e.target.value)}
                className="w-full h-11 bg-[#111827] border border-[#374151] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-[#EF4444]"
              />
              <p className="text-xs text-[#9CA3AF] mt-2">Uses your device calendar date (not UTC midnight).</p>
            </div>

            {isSalaryCategory && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                {salaryUsersLoading ? (
                  <p className="text-sm text-[#9CA3AF] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Loading staff…
                  </p>
                ) : (
                  <CustomSearchableSheet
                    label="Pay to (staff user) *"
                    sheetTitle="Select payee"
                    value={paidToUserId}
                    onChange={setPaidToUserId}
                    options={salaryUsers.map((u) => ({
                      value: u.id,
                      label: u.full_name,
                      description: [u.role, u.email].filter(Boolean).join(' · ') || undefined,
                    }))}
                    placeholder="Search by name, role, or email…"
                    searchPlaceholder="Search staff…"
                    required
                    hint="Salary is for users only (Admin, Staff, Salesman, Operator). Workers are paid via Production → Worker Ledger."
                    zIndexClass="z-[90]"
                  />
                )}
              </div>
            )}

            <TextInput
              label={isSalaryCategory ? 'Description (optional for salary)' : 'Description *'}
              value={addDesc}
              onChange={setAddDesc}
              placeholder={isSalaryCategory ? 'Optional — defaults to payee name + Salary' : 'What was this expense for?'}
              required={!isSalaryCategory}
            />
            <NumericInput
              label="Amount (Rs.) *"
              value={addAmount}
              onChange={setAddAmount}
              placeholder="0"
              allowDecimal
              min={1}
              prefix="Rs."
            />

            {/* Attachment (receipt/bill) */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Attachment (receipt/bill)</label>
              <MediaSourcePicker
                accept="image/*,.pdf"
                disabled={isProcessingReceipt}
                sheetTitle="Add receipt"
                onFiles={(picked) => {
                  void (async () => {
                    const raw = picked[0];
                    if (!raw) return;
                    setIsProcessingReceipt(true);
                    setReceiptNotice(null);
                    try {
                      const { files, compressionMessages, skippedMessages } =
                        await prepareAttachmentFilesForUpload([raw], MAX_EXPENSE_RECEIPT_BYTES);
                      if (skippedMessages.length) {
                        setReceiptNotice(skippedMessages[0] ?? null);
                        setAddReceiptFile(null);
                      } else {
                        setAddReceiptFile(files[0] ?? null);
                        if (compressionMessages.length) setReceiptNotice(compressionMessages[0] ?? null);
                      }
                    } finally {
                      setIsProcessingReceipt(false);
                    }
                  })();
                }}
              >
                {(open) => (
              <button
                type="button"
                disabled={isProcessingReceipt}
                onClick={open}
                className="w-full border-2 border-dashed border-[#374151] rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-[#374151]/30 transition-colors text-[#9CA3AF] disabled:opacity-60"
              >
                {isProcessingReceipt ? (
                  <>
                    <Loader2 className="w-8 h-8 mb-2 animate-spin" />
                    <span className="text-sm">Compressing…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2" />
                    <span className="text-sm">{addReceiptFile ? addReceiptFile.name : 'Camera or upload receipt (PNG, JPG, PDF up to 5MB)'}</span>
                  </>
                )}
              </button>
                )}
              </MediaSourcePicker>
              {receiptNotice && (
                <p className="mt-2 text-xs text-[#9CA3AF]">{receiptNotice}</p>
              )}
              {addReceiptFile && (
                <button
                  type="button"
                  onClick={() => setAddReceiptFile(null)}
                  className="mt-2 flex items-center gap-2 text-sm text-[#EF4444]"
                >
                  <X className="w-4 h-4" /> Remove file
                </button>
              )}
            </div>
          </div>
        </div>
        <ActionBar>
          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full h-12 bg-gradient-to-br from-[#EF4444] to-[#DC2626] hover:opacity-90 disabled:opacity-50 rounded-xl font-medium text-white flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </ActionBar>
      </div>
      </SwipeBackShell>
    );
  }

  return (
    <>
    <SwipeBackShell onBack={onBack}>
    <div className="min-h-screen bg-[#111827] pb-24">
      <OfflineBanner online={online} pendingCount={pendingCount} />
      {branchGateError ? (
        <div className="mx-4 mt-2 p-3 bg-[#EF4444]/20 border border-[#EF4444] rounded-lg text-[#FCA5A5] text-sm">
          {branchGateError}
        </div>
      ) : null}
      { !isSharedCounterModeEnabled() ? (
        <SwitchUserPinOverlay
          open={showSwitchUser}
          companyId={companyId}
          onClose={() => setShowSwitchUser(false)}
        />
      ) : null}
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-white">Expenses</h1>
              <p className="text-xs text-white/80">Track all business expenses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRequestCounterLock ? (
              <button
                type="button"
                onClick={() => {
                  if (isSharedCounterModeEnabled()) {
                    onRequestCounterLock();
                  } else {
                    setShowSwitchUser(true);
                  }
                }}
                className="p-2.5 bg-white/15 hover:bg-white/25 rounded-lg text-white"
                title="Switch user"
              >
                <Users className="w-5 h-5" />
              </button>
            ) : null}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-2.5 bg-white text-[#DC2626] hover:bg-white/90 rounded-lg font-medium text-sm shadow-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </div>
        </div>

        {!loading && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <p className="text-xs text-white/70 mb-1">Total This Period</p>
                <p className="text-lg font-bold text-white">Rs. {totalAmount.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <p className="text-xs text-white/70 mb-1">Today</p>
                <p className="text-lg font-bold text-white">Rs. {todayAmount.toLocaleString()}</p>
              </div>
            </div>
            <div className="mb-3 [&_input]:bg-white/10 [&_input]:border-white/20 [&_input]:text-white [&_input]:placeholder-white/50 [&_input]:focus:border-white/40">
              <TextInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search expenses..."
                prefix={<Search className="w-5 h-5 text-white/50" />}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    filterCategory === cat.value ? 'bg-white text-[#EF4444]' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="text-xs font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <PullToRefresh
        onRefresh={() => loadExpenses({ silent: true })}
        disabled={!companyId}
        scrollElementRef={mainScrollRef}
        spinnerAccentClass="border-t-[#EF4444]"
      >
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#EF4444] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#1F2937] rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p className="text-[#9CA3AF] text-sm">No expenses found</p>
            <p className="text-[#6B7280] text-xs mt-1">Try adjusting your filters or tap + to add</p>
          </div>
        ) : (
          (['today', 'yesterday', 'thisWeek', 'older'] as DateGroup[]).map((group) => {
            const items = grouped[group];
            if (!items || items.length === 0) return null;
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  <h2 className="text-sm font-semibold text-white">{groupLabels[group]}</h2>
                  <div className="flex-1 h-px bg-[#374151]" />
                  <span className="text-xs text-[#6B7280]">
                    {items.length} {items.length === 1 ? 'expense' : 'expenses'}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((e) => (
                    <div key={e.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#EF4444]/50 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="text-2xl">{getCategoryIcon(e.category)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white mb-1">{e.category}</p>
                            <p className="text-xs text-[#9CA3AF] line-clamp-2">{e.description || e.expense_no}</p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-base font-bold text-[#EF4444]">- Rs. {e.amount.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-[#374151]">
                        <span className="text-xs text-[#6B7280]">Cash</span>
                        <span className="text-xs text-[#6B7280]">{formatDate(e.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      </PullToRefresh>

      <button
        onClick={handleOpenAdd}
        disabled={!companyId || branchGateLoading}
        className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-[#EF4444] to-[#DC2626] rounded-full shadow-lg flex items-center justify-center z-20 hover:scale-110 transition-transform disabled:opacity-50"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={3} />
      </button>
    </div>
    </SwipeBackShell>
    <DocumentBranchGateModal
      {...branchGateModalProps}
      accentClass="text-[#EF4444] hover:border-[#EF4444]"
    />
  </>
  );
}
