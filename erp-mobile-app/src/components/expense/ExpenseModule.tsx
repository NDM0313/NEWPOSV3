import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Calendar, DollarSign, Search, Loader2, Upload, X } from 'lucide-react';
import { TextInput, NumericInput, ActionBar } from '../common';
import type { User, Branch } from '../../types';
import * as expensesApi from '../../api/expenses';
import * as authApi from '../../api/auth';
import * as accountsApi from '../../api/accounts';
import * as branchesApi from '../../api/branches';

interface ExpenseModuleProps {
  onBack: () => void;
  user: User;
  companyId: string | null;
  branch: Branch | null;
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

export function ExpenseModule({ onBack, user: _user, companyId, branch }: ExpenseModuleProps) {
  const [list, setList] = useState<{ id: string; expense_no: string; date: string; category: string; description: string; amount: number }[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [branchesList, setBranchesList] = useState<Branch[]>([]);
  const [addBranchId, setAddBranchId] = useState('');

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    let c = false;
    setLoading(true);
    expensesApi.getExpenses(companyId, branch?.id).then(({ data, error }) => {
      if (c) return;
      setLoading(false);
      if (!error && data)
        setList(
          data.map((r: { id: string; expense_no?: string; expense_date: string; category: string; description?: string; amount: number }) => ({
            id: r.id,
            expense_no: r.expense_no || '—',
            date: r.expense_date,
            category: r.category,
            description: r.description || '',
            amount: r.amount,
          }))
        );
    });
    return () => {
      c = true;
    };
  }, [companyId, branch?.id]);

  useEffect(() => {
    if (!showAdd || !companyId) return;
    accountsApi.getPaymentAccounts(companyId).then(({ data }) => setPaymentAccounts(data || []));
    expensesApi.getExpenseCategoryTree(companyId).then(({ data }) => setCategoryTree(data || []));
    if (branch?.id === 'all') {
      branchesApi.getBranches(companyId).then(({ data }) => {
        setBranchesList(data || []);
        if (data?.length && !addBranchId) setAddBranchId(data[0].id);
      });
    } else {
      setBranchesList([]);
      setAddBranchId('');
    }
  }, [showAdd, companyId, branch?.id]);

  const selectedMain = categoryTree.find((m) => m.id === mainCategoryId);
  const subOptions = selectedMain?.children ?? [];
  const selectedSub = subOptions.find((s) => s.id === subCategoryId);
  const effectiveCategorySlug =
    categoryTree.length > 0 && (mainCategoryId || subCategoryId)
      ? (selectedSub?.slug ?? selectedMain?.slug ?? '')
      : (CATEGORY_TO_SLUG[addCategory] ?? addCategory.toLowerCase().replace(/\s+/g, '_'));
  const selectedAccount = paymentAccounts.find((a) => a.id === addAccountId);
  const paymentMethodFromAccount = selectedAccount ? (selectedAccount.type === 'bank' ? 'bank' : selectedAccount.type === 'mobile_wallet' ? 'wallet' : 'cash') : 'cash';
  const effectiveBranchId = branch?.id && branch.id !== 'all' ? branch.id : addBranchId;

  const handleAdd = async () => {
    const amt = parseFloat(addAmount);
    if (!companyId || !effectiveBranchId || !addDesc.trim() || isNaN(amt) || amt <= 0) {
      setAddError(
        branch?.id === 'all' && !addBranchId
          ? 'Select a branch for this expense.'
          : 'Enter valid description and amount.'
      );
      return;
    }
    if (!effectiveCategorySlug) {
      setAddError('Please select a category.');
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
    setSaving(true);
    setAddError(null);
    let receiptUrl: string | null = null;
    if (addReceiptFile) {
      const up = await expensesApi.uploadExpenseReceipt(companyId, addReceiptFile);
      if (up.error) {
        const isBucketMissing = up.error.toLowerCase().includes('bucket') && up.error.toLowerCase().includes('not found');
        if (isBucketMissing) {
          receiptUrl = null;
          setAddError('Receipt could not be uploaded (storage bucket missing). Saving expense without attachment.');
        } else {
          setSaving(false);
          setAddError(up.error);
          return;
        }
      } else {
        receiptUrl = up.url;
      }
    }
    const paymentMethod = paymentAccounts.length > 0 ? paymentMethodFromAccount : 'cash';
    const { data, error } = await expensesApi.createExpense({
      companyId,
      branchId: effectiveBranchId,
      category: effectiveCategorySlug,
      description: addDesc.trim(),
      amount: amt,
      paymentMethod,
      userId: session.userId,
      paymentAccountId: addAccountId || undefined,
      receiptUrl: receiptUrl || undefined,
    });
    setSaving(false);
    if (error) {
      setAddError(error);
      return;
    }
    const displayCategory = selectedSub?.name ?? selectedMain?.name ?? addCategory;
    setList((prev) => [
      { id: data!.id, expense_no: data!.expense_no, date: new Date().toISOString().slice(0, 10), category: displayCategory, description: addDesc.trim(), amount: amt },
      ...prev,
    ]);
    setAddError(null);
    setShowAdd(false);
    setAddDesc('');
    setAddAmount('');
    setAddAccountId('');
    setMainCategoryId('');
    setSubCategoryId('');
    setAddReceiptFile(null);
    setAddBranchId('');
  };

  const filtered = list.filter((e) => {
    const matchCat = filterCategory === 'all' || e.category === filterCategory;
    const matchSearch =
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.expense_no.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped = filtered.reduce(
    (acc, e) => {
      const g = getDateGroup(e.date);
      if (!acc[g]) acc[g] = [];
      acc[g].push(e);
      return acc;
    },
    {} as Record<DateGroup, typeof list>
  );

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const todayAmount = (grouped.today || []).reduce((s, e) => s + e.amount, 0);
  const groupLabels: Record<DateGroup, string> = { today: 'Today', yesterday: 'Yesterday', thisWeek: 'This Week', older: 'Older' };

  if (showAdd) {
    return (
      <div className="min-h-screen bg-[#111827] pb-32">
        <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
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
            {/* Branch (when "All Branches" is selected) */}
            {branch?.id === 'all' && branchesList.length > 0 && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Branch *</label>
                <select
                  value={addBranchId}
                  onChange={(e) => setAddBranchId(e.target.value)}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#EF4444]"
                >
                  <option value="">Select branch for this expense</option>
                  {branchesList.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="text-xs text-[#9CA3AF] mt-1">Expense will be recorded under the selected branch.</p>
              </div>
            )}

            {/* Account (Cash/Bank) */}
            {paymentAccounts.length > 0 && (
              <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
                <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Paid from (Account) *</label>
                <select
                  value={addAccountId}
                  onChange={(e) => setAddAccountId(e.target.value)}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#EF4444]"
                >
                  <option value="">Select account (Cash / Bank)</option>
                  {paymentAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) — Rs. {acc.balance.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category: tree (main + sub) or fallback */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <label className="block text-sm font-medium text-[#D1D5DB] mb-2">Category *</label>
              {categoryTree.length > 0 ? (
                <div className="space-y-3">
                  <select
                    value={mainCategoryId || '_none'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMainCategoryId(v === '_none' ? '' : v);
                      setSubCategoryId('');
                    }}
                    className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#EF4444]"
                  >
                    <option value="_none">Select main category</option>
                    {categoryTree.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {subOptions.length > 0 && (
                    <select
                      value={subCategoryId || '_main'}
                      onChange={(e) => setSubCategoryId(e.target.value === '_main' ? '' : e.target.value)}
                      className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#EF4444]"
                    >
                      <option value="_main">— {selectedMain?.name} (main)</option>
                      {subOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 text-white focus:outline-none focus:border-[#EF4444]"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            <TextInput
              label="Description *"
              value={addDesc}
              onChange={setAddDesc}
              placeholder="What was this expense for?"
              required
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setAddReceiptFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#374151] rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-[#374151]/30 transition-colors text-[#9CA3AF]"
              >
                <Upload className="w-8 h-8 mb-2" />
                <span className="text-sm">{addReceiptFile ? addReceiptFile.name : 'Tap to upload receipt (PNG, JPG, PDF up to 5MB)'}</span>
              </button>
              {addReceiptFile && (
                <button
                  type="button"
                  onClick={() => { setAddReceiptFile(null); fileInputRef.current && (fileInputRef.current.value = ''); }}
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
    );
  }

  return (
    <div className="min-h-screen bg-[#111827] pb-24">
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
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2.5 bg-white text-[#DC2626] hover:bg-white/90 rounded-lg font-medium text-sm shadow-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
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

      <button
        onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-[#EF4444] to-[#DC2626] rounded-full shadow-lg flex items-center justify-center z-20 hover:scale-110 transition-transform"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={3} />
      </button>
    </div>
  );
}
