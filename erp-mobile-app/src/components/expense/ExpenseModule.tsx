import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Calendar, DollarSign, Search, Loader2, Upload, X, Users } from 'lucide-react';
import { TextInput, NumericInput, ActionBar, CustomSelect, CustomSearchableSheet, PullToRefresh, OfflineBanner, SwipeBackShell } from '../common';
import { LongPressCard } from '../common/LongPressCard';
import { useOfflineListMeta } from '../../hooks/useOfflineListMeta';
import { useMainScrollRef } from '../../contexts/MainScrollContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { FormDraftRestoredBanner } from '../shared/FormDraftRestoredBanner';
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
import { useSubmitLock } from '../../contexts/LoadingContext';
import { formatSaleChargeDisplayLabel } from '../../lib/saleChargeDisplay';
import { ExpenseCategorySheet } from './ExpenseCategorySheet';
import { ExpenseDetailSheet } from './ExpenseDetailSheet';
import { AttachmentIndicatorButton } from '../shared/AttachmentIndicatorButton';
import { AttachmentPreviewModal } from '../sales/AttachmentPreviewModal';
import {
  categoryRequires4120Clearing,
  collectCategoryIdsForClearingFilter,
  collectClearingSlugsUnder,
  displayLabelForCategoryId,
  buildExpenseFilterChips,
  expenseMatchesCategoryFilter,
  findPathToCategory,
  isExpenseSalaryCategory,
  levelIdsFromCategoryId,
  resolveExpenseCategoryIdFromLevels,
} from '../../lib/expenseCategoryTreeUtils';
import {
  planHybridServiceExpense,
  type ClearingAllocation,
} from '../../lib/clearingAllocation';

const MAX_EXPENSE_RECEIPT_BYTES = 5 * 1024 * 1024;

function expenseReceiptName(url: string): string {
  const base = url.split('/').pop() || 'receipt';
  try {
    return decodeURIComponent(base.replace(/^\d+_/, ''));
  } catch {
    return base;
  }
}

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
  { value: 'Stitching', label: 'Stitching', icon: '🧵' },
  { value: 'Dying', label: 'Dying', icon: '🎨' },
  { value: 'Rent', label: 'Rent', icon: '🏢' },
  { value: 'Utilities', label: 'Utilities', icon: '⚡' },
  { value: 'Salaries', label: 'Salaries', icon: '💼' },
  { value: 'Supplies', label: 'Supplies', icon: '📝' },
  { value: 'Transport', label: 'Transport', icon: '🚗' },
  { value: 'Other', label: 'Other', icon: '📊' },
];

const CATEGORY_OPTIONS = [
  'Stitching',
  'Dying',
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Transport',
  'Other',
];
/** Map display name to DB category slug (text on expenses.category). */
const CATEGORY_TO_SLUG: Record<string, string> = {
  Stitching: 'stitching',
  Dying: 'dying',
  Rent: 'rent',
  Utilities: 'utilities',
  Salaries: 'salaries',
  Supplies: 'office_supplies',
  Transport: 'travel',
  Other: 'miscellaneous',
};

const CLEARING_CATEGORY_SLUGS = new Set(['stitching', 'dying', 'dyeing', 'lining']);

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
  const { canViewBalances, branchIds, isAdminOrOwner, isPermissionLoaded } = usePermissions();

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
      expense_category_id?: string | null;
      payment_account_display?: string;
      payment_account_id?: string | null;
      payment_method?: string;
      receipt_url?: string | null;
      status?: string;
      created_by_name?: string | null;
      vendor_name?: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(!!companyId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<expensesApi.ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addCategory, setAddCategory] = useState(CATEGORY_OPTIONS[0]);
  const [addDesc, setAddDesc] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const { run: runSave, busy: saving } = useSubmitLock();
  const [addError, setAddError] = useState<string | null>(null);
  const [submitErrorModal, setSubmitErrorModal] = useState<string | null>(null);
  const [clearingFilterWarning, setClearingFilterWarning] = useState<string | null>(null);
  const [clearingLoadError, setClearingLoadError] = useState<string | null>(null);

  const showExpenseError = useCallback((message: string) => {
    setAddError(message);
    setSubmitErrorModal(message);
  }, []);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Add form: account (Cash/Bank), category tree, attachment
  const [paymentAccounts, setPaymentAccounts] = useState<accountsApi.AccountRow[]>([]);
  const [categoryTree, setCategoryTree] = useState<expensesApi.ExpenseCategoryTreeItem[]>([]);
  const [addAccountId, setAddAccountId] = useState('');
  const [mainCategoryId, setMainCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [leafCategoryId, setLeafCategoryId] = useState('');
  const [addReceiptFile, setAddReceiptFile] = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingExpenseNo, setEditingExpenseNo] = useState<string | null>(null);
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null);
  const [documentBranchId, setDocumentBranchId] = useState<string | null>(null);
  const [paidToUserId, setPaidToUserId] = useState('');
  const [salaryUsers, setSalaryUsers] = useState<SalaryUserRow[]>([]);
  const [salaryUsersLoading, setSalaryUsersLoading] = useState(false);
  const [showSwitchUser, setShowSwitchUser] = useState(false);
  /** Calendar date in device local TZ (`YYYY-MM-DD`); matches `expenses.expense_date`. */
  const [addExpenseDate, setAddExpenseDate] = useState(localNowDateString);
  const [clearingLines, setClearingLines] = useState<expensesApi.ExtraServiceClearingLine[]>([]);
  const [clearingLinesLoading, setClearingLinesLoading] = useState(false);
  const [selectedClearingChargeId, setSelectedClearingChargeId] = useState('');
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
    setLeafCategoryId('');
    setPaidToUserId('');
    setAddReceiptFile(null);
    setExistingReceiptUrl(null);
    setEditingExpenseId(null);
    setEditingExpenseNo(null);
    setAddExpenseDate(localNowDateString());
    setSelectedClearingChargeId('');
    setClearingLines([]);
  }, []);

  type ExpenseCreateDraft = {
    documentBranchId: string | null;
    addDesc: string;
    addAmount: string;
    addAccountId: string;
    mainCategoryId: string;
    subCategoryId: string;
    leafCategoryId: string;
    paidToUserId: string;
    addExpenseDate: string;
    selectedClearingChargeId: string;
    addCategory: string;
  };

  const { showRestoredBanner: showExpenseDraftBanner, dismissRestoredBanner: dismissExpenseDraftBanner, clearDraft: clearExpenseDraft } =
    useFormDraft<ExpenseCreateDraft>({
      companyId,
      ownerUserId: effectiveUserId,
      draftId: 'expense-create',
      enabled: showAdd,
      getSnapshot: () => ({
        documentBranchId,
        addDesc,
        addAmount,
        addAccountId,
        mainCategoryId,
        subCategoryId,
        leafCategoryId,
        paidToUserId,
        addExpenseDate,
        selectedClearingChargeId,
        addCategory,
      }),
      applySnapshot: (d) => {
        setDocumentBranchId(d.documentBranchId);
        setAddDesc(d.addDesc);
        setAddAmount(d.addAmount);
        setAddAccountId(d.addAccountId);
        setMainCategoryId(d.mainCategoryId);
        setSubCategoryId(d.subCategoryId);
        setLeafCategoryId(d.leafCategoryId ?? '');
        setPaidToUserId(d.paidToUserId);
        setAddExpenseDate(d.addExpenseDate);
        setSelectedClearingChargeId(d.selectedClearingChargeId);
        setAddCategory(d.addCategory);
      },
    });

  const resetAddFormAndDraft = useCallback(() => {
    clearExpenseDraft();
    resetAddForm();
  }, [clearExpenseDraft, resetAddForm]);

  const handleOpenAdd = () => {
    if (!companyId || branchGateLoading) return;
    setEditingExpenseId(null);
    setEditingExpenseNo(null);
    setExistingReceiptUrl(null);
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

  const noBranchAccess =
    isPermissionLoaded &&
    listBranchScope.mode === 'accessible' &&
    listBranchScope.branchIds.length === 0;

  const loadExpenses = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      if (!isPermissionLoaded) {
        if (!opts?.silent) setLoading(true);
        return;
      }
      if (noBranchAccess) {
        setLoading(false);
        setLoadError('No branch access configured for your account. Contact an administrator.');
        setLoadWarning(null);
        setList([]);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setLoadError(null);
      setLoadWarning(null);
      const scope = listBranchScope;
      const apiBranchId = scope.mode === 'single' ? scope.branchId : null;
      const accessibleBranchIds = scope.mode === 'accessible' ? scope.branchIds : undefined;
      const { data, error } = await expensesApi.getExpenses(companyId, apiBranchId, {
        accessibleBranchIds,
      });
      setLoading(false);
      if (data?.length) {
        setList(
          data.map((r) => ({
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
            expense_category_id: r.expense_category_id ?? null,
            payment_account_display: r.payment_account_display,
            payment_account_id: r.payment_account_id ?? null,
            payment_method: r.payment_method,
            receipt_url: r.receipt_url ?? null,
            status: r.status,
            created_by_name: r.created_by_name ?? null,
            vendor_name: r.vendor_name ?? null,
          })),
        );
        if (error) setLoadWarning(error);
      } else if (error) {
        setLoadError(error);
        setList([]);
      } else {
        setList([]);
      }
    },
    [companyId, listBranchScope, isPermissionLoaded, noBranchAccess],
  );

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const onSync = () => void loadExpenses({ silent: true });
    window.addEventListener('erp-mobile:autosync-complete', onSync);
    return () => window.removeEventListener('erp-mobile:autosync-complete', onSync);
  }, [loadExpenses]);

  const reloadCategoryTree = useCallback(async () => {
    if (!companyId) return;
    let { data, error } = await expensesApi.getExpenseCategoryTree(companyId);
    if (!error && (data?.length ?? 0) === 0) {
      await expensesApi.ensureDefaultExpenseCategories(companyId);
      const reload = await expensesApi.getExpenseCategoryTree(companyId);
      data = reload.data;
    }
    setCategoryTree(data || []);
  }, [companyId]);

  useEffect(() => {
    reloadCategoryTree();
  }, [reloadCategoryTree]);

  useEffect(() => {
    if (!showAdd || !companyId) return;
    accountsApi.getPaymentAccounts(companyId).then(({ data }) => setPaymentAccounts(data || []));
    reloadCategoryTree();
  }, [showAdd, companyId, reloadCategoryTree]);

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
  const effectiveCategorySlug =
    categoryTree.length > 0 && resolvedCategoryId
      ? (deepestCategory?.slug ?? '')
      : (CATEGORY_TO_SLUG[addCategory] ?? addCategory.toLowerCase().replace(/\s+/g, '_'));

  const slugLower = (effectiveCategorySlug || '').toLowerCase();
  const salaryCategoryPath = useMemo(() => {
    if (categoryTree.length === 0) return null;
    if (resolvedCategoryId) {
      return findPathToCategory(categoryTree, resolvedCategoryId);
    }
    const trail = [selectedMain, selectedSub, selectedLeaf].filter(Boolean) as NonNullable<
      typeof selectedMain
    >[];
    return trail.length > 0 ? trail : null;
  }, [categoryTree, resolvedCategoryId, selectedMain, selectedSub, selectedLeaf]);

  const isSalaryCategory = useMemo(() => {
    if (isExpenseSalaryCategory(salaryCategoryPath)) return true;
    return slugLower === 'salaries' || slugLower === 'salary' || slugLower === 'wages';
  }, [salaryCategoryPath, slugLower]);

  const showClearingSection =
    categoryTree.length > 0 && deepestCategory
      ? categoryRequires4120Clearing(deepestCategory)
      : CLEARING_CATEGORY_SLUGS.has(slugLower);

  const isMainServiceOnly =
    showClearingSection &&
    Boolean(selectedMain) &&
    !subCategoryId &&
    deepestCategory?.id === selectedMain?.id;

  const isClearingSubFlow = showClearingSection && !isMainServiceOnly;

  const selectedClearingLine = clearingLines.find(
    (l) => l.sale_charge_id === selectedClearingChargeId,
  );

  const applyCategoryFromExpenseCategoryId = useCallback(
    (categoryId: string | null | undefined) => {
      if (!categoryId || categoryTree.length === 0) return;
      const { level1Id, level2Id, level3Id } = levelIdsFromCategoryId(categoryTree, categoryId);
      if (level1Id) setMainCategoryId(level1Id);
      setSubCategoryId(level2Id);
      setLeafCategoryId(level3Id);
    },
    [categoryTree],
  );

  const selectClearingLine = useCallback(
    (line: expensesApi.ExtraServiceClearingLine | undefined, opts?: { prefillAmount?: boolean }) => {
      if (!line) {
        setSelectedClearingChargeId('');
        return;
      }
      setSelectedClearingChargeId(line.sale_charge_id);
      if (opts?.prefillAmount !== false) {
        setAddAmount(String(line.open_balance));
      }
      if (line.expense_category_id) {
        applyCategoryFromExpenseCategoryId(line.expense_category_id);
      }
    },
    [applyCategoryFromExpenseCategoryId],
  );

  useEffect(() => {
    if (!showAdd || !companyId || !showClearingSection) {
      setClearingLines([]);
      setSelectedClearingChargeId('');
      setClearingLoadError(null);
      setClearingFilterWarning(null);
      return;
    }
    let cancelled = false;
    setClearingLinesLoading(true);
    setClearingLoadError(null);
    setClearingFilterWarning(null);
    const filterAnchor = deepestCategory ?? selectedMain;
    const allowedCategoryIds = resolvedCategoryId
      ? collectCategoryIdsForClearingFilter(categoryTree, resolvedCategoryId)
      : undefined;
    const categorySlugs =
      filterAnchor && categoryTree.length > 0
        ? collectClearingSlugsUnder(filterAnchor)
        : effectiveCategorySlug
          ? [effectiveCategorySlug]
          : undefined;
    expensesApi
      .getExtraServiceClearingLines(companyId, {
        expenseCategoryId: resolvedCategoryId || undefined,
        categorySlug: effectiveCategorySlug || undefined,
        allowedCategoryIds,
        categorySlugs,
      })
      .then(({ data, error, filterWarning }) => {
        if (cancelled) return;
        setClearingLinesLoading(false);
        if (error) {
          setClearingLoadError(error);
          setClearingLines([]);
          return;
        }
        setClearingLines(data || []);
        setClearingFilterWarning(filterWarning ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setClearingLinesLoading(false);
          setClearingLines([]);
          setClearingLoadError(e instanceof Error ? e.message : 'Failed to load open balances.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    showAdd,
    companyId,
    showClearingSection,
    effectiveCategorySlug,
    resolvedCategoryId,
    categoryTree,
    deepestCategory,
    selectedMain,
  ]);

  useEffect(() => {
    if (!showClearingSection || clearingLinesLoading) return;
    if (
      selectedClearingChargeId &&
      !clearingLines.some((l) => l.sale_charge_id === selectedClearingChargeId)
    ) {
      setSelectedClearingChargeId('');
    }
  }, [showClearingSection, clearingLines, clearingLinesLoading, selectedClearingChargeId]);

  const clearingAmtNum = parseFloat(addAmount);
  const clearingCategoryLabel = selectedSub?.name ?? deepestCategory?.name ?? 'Service';
  const hybridPlan = useMemo(() => {
    if (!isClearingSubFlow || !Number.isFinite(clearingAmtNum) || clearingAmtNum <= 0) {
      return null;
    }
    const lines =
      clearingLines.length > 0
        ? clearingLines
        : selectedClearingLine
          ? [selectedClearingLine]
          : [];
    if (lines.length === 0) return null;
    return planHybridServiceExpense(clearingAmtNum, lines, selectedClearingLine ?? null);
  }, [isClearingSubFlow, clearingAmtNum, clearingLines, selectedClearingLine]);

  const clearingSaveBlocked = showClearingSection && clearingLinesLoading;

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
    setSubmitErrorModal(null);
    const amt = parseFloat(addAmount);
    if (!companyId || !writeBranchId || isNaN(amt) || amt <= 0) {
      showExpenseError(
        needsWriteBranchPicker && !writeBranchId
          ? 'Select a branch for this expense.'
          : 'Enter a valid amount greater than zero.',
      );
      return;
    }
    if (!effectiveCategorySlug) {
      showExpenseError('Please select a category.');
      return;
    }
    const selectedSalaryUser = isSalaryCategory ? salaryUsers.find((u) => u.id === paidToUserId) : undefined;
    if (isSalaryCategory && !paidToUserId) {
      showExpenseError('Please select the user to pay (Salary is for Staff / Salesman / Operator only).');
      return;
    }
    const descriptionFinal =
      addDesc.trim() ||
      (isSalaryCategory && selectedSalaryUser
        ? `${selectedSalaryUser.full_name} – Salary`
        : selectedSub?.name ?? selectedMain?.name ?? '');
    if (!descriptionFinal) {
      showExpenseError('Enter a description or select a salary payee.');
      return;
    }
    if (paymentAccounts.length > 0 && !addAccountId) {
      showExpenseError('Please select an account (Cash/Bank).');
      return;
    }
    if (showClearingSection && clearingLoadError) {
      showExpenseError(clearingLoadError);
      return;
    }
    if (showClearingSection && clearingLinesLoading) {
      showExpenseError('Loading open balances…');
      return;
    }
    const session = await authApi.getSession();
    if (!session?.userId) {
      showExpenseError('Session expired.');
      return;
    }
    const expenseUserId = effectiveUserId;
    const editId = editingExpenseId;
    await runSave(editId ? 'Updating expense...' : 'Saving expense...', async () => {
    setAddError(null);
    setSubmitErrorModal(null);
    let receiptUrl: string | null = existingReceiptUrl;
    if (addReceiptFile && navigator.onLine) {
      const up = await expensesApi.uploadExpenseReceipt(companyId, addReceiptFile);
      if (up.error) {
        showExpenseError(up.error);
        return;
      } else if (!up.url) {
        showExpenseError('Receipt could not be uploaded. Remove the file or try again.');
        return;
      } else {
        receiptUrl = up.url;
      }
    }
    const paymentMethod = paymentAccounts.length > 0 ? paymentMethodFromAccount : 'cash';

    const resolveHybridClearing = () => {
      if (!isClearingSubFlow) return null;
      const lines =
        clearingLines.length > 0
          ? clearingLines
          : selectedClearingLine
            ? [selectedClearingLine]
            : [];
      if (lines.length === 0) return null;
      return planHybridServiceExpense(amt, lines, selectedClearingLine ?? null);
    };

    const hybridClearing = resolveHybridClearing();
    const clearingAllocations =
      hybridClearing && hybridClearing.clearingParts.length > 0
        ? hybridClearing.clearingParts.map((p) => ({
            saleChargeId: p.saleChargeId,
            amount: p.amount,
          }))
        : undefined;
    const primaryClearingPart: ClearingAllocation | null =
      hybridClearing?.clearingParts[0] ?? null;

    const buildCreateExpenseInput = () => ({
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
      saleId: primaryClearingPart?.saleId ?? undefined,
      saleChargeId: hybridClearing?.primarySaleChargeId ?? undefined,
      tailorContactId: primaryClearingPart?.tailorContactId ?? undefined,
      expenseCategoryId:
        primaryClearingPart?.expenseCategoryId ?? resolvedCategoryId ?? undefined,
      clearingAllocations,
    });

    if (editId) {
      if (!navigator.onLine) {
        showExpenseError('Editing expenses requires an internet connection.');
        return;
      }
      const { data, error } = await expensesApi.updateExpense({
        companyId,
        expenseId: editId,
        branchId: writeBranchId,
        category: effectiveCategorySlug,
        description: descriptionFinal,
        amount: amt,
        paymentMethod,
        expenseDate: addExpenseDate,
        paymentAccountId: addAccountId || undefined,
        receiptUrl: receiptUrl ?? undefined,
        paidToUserId: isSalaryCategory && paidToUserId ? paidToUserId : undefined,
        payeeName: isSalaryCategory && selectedSalaryUser ? selectedSalaryUser.full_name : undefined,
        expenseCategoryId: resolvedCategoryId || undefined,
      });
      if (error) {
        showExpenseError(error);
        return;
      }
      const displayCategory = resolvedCategoryId
        ? displayLabelForCategoryId(categoryTree, resolvedCategoryId, addCategory)
        : addCategory;
      const updated = data!;
      setList((prev) =>
        prev.map((e) =>
          e.id === editId
            ? {
                ...e,
                expense_no: updated.expense_no || e.expense_no,
                date: updated.expense_date,
                category: displayCategory,
                expense_category_id: updated.expense_category_id ?? resolvedCategoryId ?? null,
                description: updated.description,
                amount: updated.amount,
                branch_id: updated.branch_id ?? writeBranchId,
                payment_account_id: updated.payment_account_id ?? null,
                payment_account_display: updated.payment_account_display,
                payment_method: updated.payment_method,
                receipt_url: updated.receipt_url ?? null,
              }
            : e,
        ),
      );
      setAddError(null);
      setSubmitErrorModal(null);
      resetAddFormAndDraft();
      void loadExpenses({ silent: true });
      return;
    }

    if (!navigator.onLine) {
      try {
        const displayCategory = resolvedCategoryId
          ? displayLabelForCategoryId(categoryTree, resolvedCategoryId, addCategory)
          : addCategory;
        const createInput = buildCreateExpenseInput();
        await addPending(
          'expense',
          {
            companyId: createInput.companyId,
            branchId: createInput.branchId,
            category: createInput.category,
            description: createInput.description,
            amount: createInput.amount,
            paymentMethod: createInput.paymentMethod,
            userId: createInput.userId,
            expenseDate: createInput.expenseDate,
            paymentAccountId: createInput.paymentAccountId,
            receiptUrl: createInput.receiptUrl,
            paidToUserId: createInput.paidToUserId,
            payeeName: createInput.payeeName,
            saleId: createInput.saleId,
            saleChargeId: createInput.saleChargeId,
            tailorContactId: createInput.tailorContactId,
            expenseCategoryId: createInput.expenseCategoryId,
            clearingAllocations: createInput.clearingAllocations,
          },
          companyId,
          writeBranchId,
        );
        setList((prev) => [
          {
            id: `offline-${Date.now()}`,
            expense_no: 'Pending sync',
            date: addExpenseDate,
            created_at: getCurrentLocalTimestamp(),
            category: displayCategory,
            description: descriptionFinal,
            amount: amt,
            branch_id: writeBranchId,
            created_by: expenseUserId,
            expense_category_id: resolvedCategoryId || null,
          },
          ...prev,
        ]);
        setAddError(null);
        setSubmitErrorModal(null);
        resetAddFormAndDraft();
      } catch (e) {
        showExpenseError(e instanceof Error ? e.message : 'Failed to save offline.');
      }
      return;
    }

    const { data, error } = await expensesApi.createExpense(buildCreateExpenseInput());
    if (error) {
      showExpenseError(error);
      return;
    }
    const displayCategory = resolvedCategoryId
      ? displayLabelForCategoryId(categoryTree, resolvedCategoryId, addCategory)
      : addCategory;
    setList((prev) => [
      {
        id: data!.id,
        expense_no: data!.expense_no || '—',
        date: addExpenseDate,
        created_at: getCurrentLocalTimestamp(),
        category: displayCategory,
        expense_category_id: resolvedCategoryId || null,
        description: descriptionFinal,
        amount: amt,
        branch_id: writeBranchId,
        created_by: expenseUserId,
        receipt_url: receiptUrl || null,
      },
      ...prev,
    ]);
    if (data?.receiptWarning) {
      setReceiptNotice(data.receiptWarning);
    }
    setAddError(null);
    setSubmitErrorModal(null);
    resetAddFormAndDraft();
    void loadExpenses({ silent: true });
    });
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

  const filterChips = useMemo(() => {
    if (categoryTree.length > 0) return buildExpenseFilterChips(categoryTree);
    return CATEGORIES;
  }, [categoryTree]);

  const categoryLabelForRow = useCallback(
    (e: { category: string; expense_category_id?: string | null }) =>
      categoryTree.length > 0
        ? displayLabelForCategoryId(categoryTree, e.expense_category_id, e.category)
        : e.category,
    [categoryTree],
  );

  const prefillEditFromRow = useCallback(
    (row: (typeof list)[number]) => {
      setEditingExpenseId(row.id);
      setEditingExpenseNo(row.expense_no || null);
      setExistingReceiptUrl(row.receipt_url ?? null);
      setAddReceiptFile(null);
      setAddDesc(row.description);
      setAddAmount(String(row.amount));
      setAddExpenseDate(row.date);
      setAddCategory(row.category);
      if (row.payment_account_id) setAddAccountId(row.payment_account_id);
      if (row.expense_category_id && categoryTree.length > 0) {
        const path = categoryTree.flatMap((m) => [m, ...(m.children ?? [])]);
        const node = path.find((n) => n.id === row.expense_category_id);
        if (node?.parent_id) {
          const parent = path.find((n) => n.id === node.parent_id);
          if (parent?.parent_id) {
            setMainCategoryId(parent.parent_id);
            setSubCategoryId(parent.id);
            setLeafCategoryId(node.id);
          } else if (parent) {
            setMainCategoryId(parent.id);
            setSubCategoryId(node.id);
            setLeafCategoryId('');
          }
        } else if (node) {
          setMainCategoryId(node.id);
          setSubCategoryId('');
          setLeafCategoryId('');
        }
      }
      setShowAdd(true);
    },
    [categoryTree],
  );

  const handleDeleteExpense = useCallback(async () => {
    if (!deleteTarget || !companyId) return;
    setDeleting(true);
    const { error } = await expensesApi.deleteExpense(deleteTarget.id, companyId);
    setDeleting(false);
    if (error) {
      showExpenseError(error);
      return;
    }
    setList((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDetailExpenseId(null);
  }, [deleteTarget, companyId, showExpenseError]);

  const filtered = useMemo(() => {
    const rows = scopedList.filter((e) => {
      const matchCat = expenseMatchesCategoryFilter(
        filterCategory,
        e.category,
        e.expense_category_id,
        categoryTree,
      );
      const label = categoryLabelForRow(e);
      const matchSearch =
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.expense_no.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
    return sortByDocumentDateTimeDesc(rows, (e) => ({
      documentDate: e.date,
      eventTimestamp: e.created_at ?? null,
    }));
  }, [scopedList, filterCategory, categoryTree, categoryLabelForRow, searchQuery]);

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
      <SwipeBackShell onBack={saving ? () => {} : resetAddFormAndDraft}>
      <div className="relative min-h-screen bg-[#111827] pb-32">
        <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10 flow-screen-header">
          <div className="flex items-center gap-3">
            <button onClick={resetAddFormAndDraft} disabled={saving} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white disabled:opacity-50">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-white">{editingExpenseId ? 'Edit Expense' : 'Add Expense'}</h1>
              <p className="text-xs text-white/80">
                {editingExpenseId
                  ? editingExpenseNo || 'Update existing expense'
                  : 'Record new business expense'}
              </p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <FormDraftRestoredBanner show={showExpenseDraftBanner} onDismiss={dismissExpenseDraftBanner} />
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
                      setLeafCategoryId('');
                      setSelectedClearingChargeId('');
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
                        setSelectedClearingChargeId('');
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
                      onChange={(v) => {
                        setLeafCategoryId(v);
                        setSelectedClearingChargeId('');
                      }}
                      options={[
                        { value: '', label: `— ${selectedSub?.name ?? selectedMain?.name ?? 'Parent'} (sub)` },
                        ...leafOptions.map((n) => ({ value: n.id, label: n.name })),
                      ]}
                      placeholder="Re-sub (optional — narrows sale extra)"
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

            {showClearingSection && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <span className="block text-sm font-medium text-[#D1D5DB] mb-1">
                  Link to sale extra (optional)
                </span>
                <p className="text-xs text-[#6B7280] mb-2">
                  Leave blank to auto-allocate across open balances (oldest invoice first).
                </p>
                {clearingLinesLoading ? (
                  <p className="text-sm text-[#9CA3AF] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Loading open balances…
                  </p>
                ) : clearingLoadError ? (
                  <p className="text-xs text-[#EF4444]">{clearingLoadError}</p>
                ) : clearingLines.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF]">
                    No open balance for this service — expense will post to category only.
                  </p>
                ) : (
                  <>
                    {clearingFilterWarning ? (
                      <p className="text-xs text-[#F59E0B] mb-2">{clearingFilterWarning}</p>
                    ) : null}
                    <CustomSelect
                      value={selectedClearingChargeId}
                      onChange={(v) => {
                        if (!v) {
                          setSelectedClearingChargeId('');
                          return;
                        }
                        const line = clearingLines.find((l) => l.sale_charge_id === v);
                        selectClearingLine(line, { prefillAmount: true });
                      }}
                      options={[
                        { value: '', label: '— Auto-allocate (FIFO) —' },
                        ...clearingLines.map((l) => ({
                          value: l.sale_charge_id,
                          label: `${l.invoice_no} · ${formatSaleChargeDisplayLabel({
                            charge_type: l.charge_type,
                            tailor_name: l.tailor_name,
                          })}`,
                          subtitle: `Open Rs. ${Number(l.open_balance).toLocaleString()}`,
                        })),
                      ]}
                      placeholder="Sale charge"
                      zIndexClass="z-[90]"
                    />
                  </>
                )}
              </div>
            )}

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
                  <>
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
                    {salaryUsers.length === 0 && (
                      <p className="text-xs text-[#F59E0B] mt-2">
                        No eligible users found. Add users in Settings with role Staff/Salesman or enable
                        &quot;Can be assigned as salesman&quot;.
                      </p>
                    )}
                  </>
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
            {hybridPlan &&
              (hybridPlan.clearingParts.length > 0 || hybridPlan.categoryAmount > 0.005) && (
              <p className="text-xs -mt-2 text-[#10B981]">
                <span className="font-medium">
                  One expense Rs. {clearingAmtNum.toLocaleString()}:
                </span>{' '}
                {hybridPlan.clearingParts.length > 0 && (
                  <>
                    {hybridPlan.clearingParts
                      .map(
                        (a) =>
                          `${a.invoiceNo} Rs. ${Number(a.amount).toLocaleString()}`,
                      )
                      .join(' + ')}{' '}
                    (4120 clearing)
                  </>
                )}
                {hybridPlan.categoryAmount > 0.005 && (
                  <>
                    {hybridPlan.clearingParts.length > 0 ? ' + ' : ''}
                    {clearingCategoryLabel} Rs.{' '}
                    {hybridPlan.categoryAmount.toLocaleString()} (category)
                  </>
                )}
              </p>
            )}

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
            disabled={saving || clearingSaveBlocked}
            className="w-full h-12 bg-gradient-to-br from-[#EF4444] to-[#DC2626] hover:opacity-90 disabled:opacity-50 rounded-xl font-medium text-white flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </ActionBar>
        {submitErrorModal ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="expense-error-title"
          >
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5 max-w-sm w-full shadow-2xl">
              <p id="expense-error-title" className="text-white font-semibold mb-2">
                Could not save expense
              </p>
              <p className="text-sm text-[#D1D5DB] mb-4">{submitErrorModal}</p>
              <button
                type="button"
                onClick={() => setSubmitErrorModal(null)}
                className="w-full h-10 bg-[#EF4444] hover:bg-[#DC2626] rounded-lg text-white font-medium"
              >
                OK
              </button>
            </div>
          </div>
        ) : null}
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
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10 flow-screen-header">
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
              type="button"
              onClick={() => setShowCategories(true)}
              className="px-3 py-2.5 bg-white/15 hover:bg-white/25 rounded-lg text-white text-sm font-medium"
            >
              Categories
            </button>
            <button
              onClick={handleOpenAdd}
              disabled={!companyId || branchGateLoading}
              className="flex items-center gap-2 px-3 py-2.5 bg-white text-[#DC2626] hover:bg-white/90 disabled:opacity-50 rounded-lg font-medium text-sm shadow-lg transition-colors"
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
              {filterChips.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    filterCategory === cat.value ? 'bg-white text-[#EF4444]' : 'bg-white/10 text-white hover:bg-white/20'
                  } ${'isSub' in cat && cat.isSub ? 'text-[11px]' : ''}`}
                >
                  <span>{cat.icon}</span>
                  <span className={`font-medium ${'isSub' in cat && cat.isSub ? 'text-[11px]' : 'text-xs'}`}>
                    {cat.label}
                  </span>
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
        {loadWarning && (
          <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/40 rounded-xl text-sm text-[#FCD34D]">
            {loadWarning}
          </div>
        )}
        {loading || !isPermissionLoaded ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#EF4444] animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#EF4444]/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-8 h-8 text-[#FCA5A5]" />
            </div>
            <p className="text-[#FCA5A5] text-sm">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadExpenses()}
              className="mt-4 px-4 py-2 bg-[#374151] hover:bg-[#4B5563] rounded-lg text-white text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#1F2937] rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="w-8 h-8 text-[#6B7280]" />
            </div>
            <p className="text-[#9CA3AF] text-sm">No expenses found</p>
            <p className="text-[#6B7280] text-xs mt-1 mb-4">
              {noBranchAccess
                ? 'You need branch access to view expenses.'
                : 'Try adjusting your filters or add a new expense'}
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              disabled={!companyId || branchGateLoading}
              className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 rounded-lg text-white text-sm font-medium"
            >
              Add expense
            </button>
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
                    <LongPressCard
                      key={e.id}
                      onTap={() => setDetailExpenseId(e.id)}
                      onEdit={() => prefillEditFromRow(e)}
                      onDelete={() => setDeleteTarget({
                        id: e.id,
                        expense_date: e.date,
                        category: e.category,
                        description: e.description,
                        amount: e.amount,
                        payment_method: e.payment_method || 'cash',
                        payment_account_display: e.payment_account_display,
                        payment_account_id: e.payment_account_id,
                        receipt_url: e.receipt_url,
                        status: e.status || 'paid',
                        expense_category_id: e.expense_category_id,
                        vendor_name: e.vendor_name,
                        expense_no: e.expense_no,
                      })}
                      canEdit={!e.id.startsWith('offline-')}
                      canDelete={!e.id.startsWith('offline-')}
                    >
                    <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#EF4444]/50 transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="text-2xl">{getCategoryIcon(e.category)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate mb-1">
                              {e.expense_no && e.expense_no !== '—' ? (
                                <>
                                  <span className="font-mono font-normal">{e.expense_no}</span>
                                  <span className="text-[#6B7280] font-normal"> · </span>
                                </>
                              ) : null}
                              {categoryLabelForRow(e)}
                            </p>
                            <p className="text-xs text-[#9CA3AF] line-clamp-2">{e.description}</p>
                          </div>
                        </div>
                        <div className="text-right ml-2 flex items-start gap-0.5 shrink-0">
                          {e.receipt_url ? (
                            <AttachmentIndicatorButton
                              size="sm"
                              onClick={() =>
                                setReceiptPreview({
                                  url: e.receipt_url!,
                                  name: expenseReceiptName(e.receipt_url!),
                                })
                              }
                            />
                          ) : null}
                          <p className="text-base font-bold text-[#EF4444]">- Rs. {e.amount.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-[#374151]">
                        <span className="text-xs text-[#6B7280] truncate max-w-[60%]">
                          {e.payment_account_display || e.payment_method || '—'}
                        </span>
                        <span className="text-xs text-[#6B7280]">{formatDate(e.date)}</span>
                      </div>
                    </div>
                    </LongPressCard>
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
    {companyId ? (
      <ExpenseCategorySheet
        companyId={companyId}
        open={showCategories}
        onClose={() => setShowCategories(false)}
        onTreeChanged={reloadCategoryTree}
      />
    ) : null}
    {companyId && detailExpenseId ? (
      <ExpenseDetailSheet
        expenseId={detailExpenseId}
        companyId={companyId}
        categoryTree={categoryTree}
        onClose={() => setDetailExpenseId(null)}
        onEdit={(exp) => {
          setDetailExpenseId(null);
          prefillEditFromRow({
            id: exp.id,
            expense_no: exp.expense_no || '—',
            date: exp.expense_date,
            category: exp.category,
            description: exp.description,
            amount: exp.amount,
            expense_category_id: exp.expense_category_id,
            payment_account_id: exp.payment_account_id,
            payment_method: exp.payment_method,
          });
        }}
        onDelete={(exp) => {
          setDetailExpenseId(null);
          setDeleteTarget(exp);
        }}
      />
    ) : null}
    {receiptPreview ? (
      <AttachmentPreviewModal
        isOpen={!!receiptPreview}
        attachments={[receiptPreview]}
        initialIndex={0}
        onClose={() => setReceiptPreview(null)}
      />
    ) : null}
    {deleteTarget ? (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm bg-[#1F2937] border border-[#374151] rounded-xl p-5 space-y-4">
          <h3 className="text-lg font-semibold text-white">Delete expense?</h3>
          <p className="text-sm text-[#9CA3AF]">
            This voids the payment and journal entry, then removes the expense record.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 h-10 border border-[#374151] rounded-lg text-[#9CA3AF] text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteExpense()}
              disabled={deleting}
              className="flex-1 h-10 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 rounded-lg text-white text-sm font-medium"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </>
  );
}
