/**
 * Accounting Test Module – Account Entry with Type Selection
 * Step 1: "Add Entry" → Type selection dialog (Kya aap karna chahte hain?)
 * Step 2: Form by type (Journal Voucher, Transfer, Supplier, Expense, Worker, Customer Receipt)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ArrowLeftRight,
  Truck,
  UserCog,
  Receipt,
  Check,
  Loader2,
  X,
  Upload,
  Calendar,
  ChevronRight,
  Wallet,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { SearchableSelect } from '@/app/components/ui/searchable-select';
import { useSupabase } from '@/app/context/SupabaseContext';
import { accountService } from '@/app/services/accountService';
import { contactService } from '@/app/services/contactService';
import { expenseCategoryService } from '@/app/services/expenseCategoryService';
import { purchaseService } from '@/app/services/purchaseService';
import { testAccountingService, getTestEntryTypeLabel, type TestEntry } from '@/app/services/testAccountingService';
import { AddExpenseDrawer } from '@/app/components/dashboard/AddExpenseDrawer';
import { uploadJournalEntryAttachments } from '@/app/utils/uploadTransactionAttachments';
import { amountToWords } from '@/app/utils/formatters';
import { toast } from 'sonner';

type ModalType = 'manual' | 'transfer' | 'supplier' | 'worker' | 'expense' | 'customer' | null;

const today = new Date().toISOString().slice(0, 10);

const ENTRY_OPTIONS: { key: ModalType; icon: string; title: string; subtitle: string }[] = [
  { key: 'manual', icon: '📒', title: 'Journal Voucher', subtitle: 'General Ledger Entry' },
  { key: 'transfer', icon: '💰', title: 'Account Transfer', subtitle: 'Bank/Cash to Bank/Cash' },
  { key: 'supplier', icon: '🏭', title: 'Supplier Payment', subtitle: 'Bill Payment to Vendor' },
  { key: 'expense', icon: '💸', title: 'Expense Payment', subtitle: 'Office Expense, Petty Cash' },
  { key: 'worker', icon: '👷', title: 'Worker Payment', subtitle: 'Labour, Staff Salary' },
  { key: 'customer', icon: '💳', title: 'Customer Receipt', subtitle: 'Payment Received' },
];

export function AccountingTestPage() {
  const { companyId, branchId, user } = useSupabase();
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; dueBalance?: number }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string; dueBalance?: number }[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string }[]>([]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TestEntry | null>(null);

  const loadEntries = async () => {
    if (!companyId) return;
    setEntriesLoading(true);
    try {
      const list = await testAccountingService.getTestEntries(companyId, {
        branchId: branchId === 'all' ? undefined : branchId || undefined,
      });
      setEntries(list);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      try {
        const [acc, sup, cust, exp, purchasesData] = await Promise.all([
          accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined),
          contactService.getAllContacts(companyId, 'supplier'),
          contactService.getAllContacts(companyId, 'customer'),
          expenseCategoryService.getCategories(companyId),
          purchaseService.getAllPurchases(companyId, branchId === 'all' ? undefined : branchId || undefined),
        ]);
        setAccounts((acc || []).map((a: any) => ({ id: a.id, name: `${a.code || ''} ${a.name}`.trim() || a.name })));
        const supplierDueMap = new Map<string, number>();
        (purchasesData || []).forEach((p: any) => {
          const sid = p.supplier_id || p.supplier?.id;
          if (sid) {
            const due = p.due_amount ?? (p.total || 0) - (p.paid_amount || 0);
            supplierDueMap.set(sid, (supplierDueMap.get(sid) || 0) + due);
          }
        });
        setSuppliers((sup || []).map((c: any) => ({
          id: c.id,
          name: c.name || c.phone || c.id,
          dueBalance: supplierDueMap.get(c.id) ?? c.supplier_opening_balance ?? c.opening_balance ?? 0,
        })));
        setCustomers((cust || []).map((c: any) => ({ id: c.id, name: c.name || c.phone || c.id })));
        setExpenseCategories((exp || []).map((c: any) => ({ id: c.id, name: c.name })));
        const wrk = await contactService.getAllContacts(companyId, 'worker');
        setWorkers((wrk || []).map((c: any) => ({
          id: c.id,
          name: c.name || c.phone || c.id,
          dueBalance: Math.max(0, Number(c.current_balance) || Number(c.opening_balance) || 0),
        })));
      } catch (e) {
        console.error(e);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId) return;
    loadEntries();
  }, [companyId, branchId]);

  const paymentAccounts = useMemo(
    () => accounts.filter((a) => /cash|bank|wallet/.test(a.name.toLowerCase())),
    [accounts]
  );
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.name.toLowerCase().includes('expense')),
    [accounts]
  );

  const openTypeSelector = () => setShowTypeSelector(true);
  const closeTypeSelector = () => setShowTypeSelector(false);
  const onSelectType = (type: ModalType) => {
    closeTypeSelector();
    setOpenModal(type);
  };
  const onBackFromForm = () => {
    setOpenModal(null);
    setShowTypeSelector(true);
  };

  const onEntrySaved = () => {
    setOpenModal(null);
    loadEntries();
  };

  if (!companyId) {
    return (
      <div className="p-6 text-gray-400">
        <p>Please log in and select a company to use the Accounting Test module.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white">
      <div className="border-b border-gray-800 bg-[#0F1419] px-6 py-5">
        <h1 className="text-2xl font-bold">Account Entry</h1>
        <p className="text-sm text-gray-400 mt-1">Add Entry se type chunein, phir form bharein.</p>
      </div>

      <div className="p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button onClick={openTypeSelector} className="bg-blue-600 hover:bg-blue-500 gap-2">
                <Wallet className="h-4 w-4" />
                Add Entry
              </Button>
              <Button variant="outline" onClick={loadEntries} disabled={entriesLoading} className="gap-2 border-gray-600 text-gray-300">
                <RefreshCw className={`h-4 w-4 ${entriesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          )}
        </div>

        {/* Entries list from database */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Saved Entries (Database)</h2>
            {entriesLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
          {entries.length === 0 && !entriesLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm">No entries yet. Use &quot;Add Entry&quot; to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Entry #</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Amount (PKR)</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-gray-800/80 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-300">{e.entry_date}</td>
                      <td className="px-4 py-3 font-mono text-gray-300">{e.entry_no || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{getTestEntryTypeLabel(e.reference_type)}</td>
                      <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">{e.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{e.amount.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(e)} className="text-gray-400 hover:text-white gap-1">
                          <Eye className="h-4 w-4" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View entry detail drawer */}
      {selectedEntry && (
        <ViewEntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}

      {/* Step 1: Type selection dialog */}
      {showTypeSelector && (
        <TypeSelectionDialog
          onSelect={onSelectType}
          onClose={closeTypeSelector}
        />
      )}

      {/* Step 2: Form modals */}
      {openModal === 'manual' && (
        <ManualEntryModal
          companyId={companyId}
          branchId={branchId}
          createdBy={user?.id}
          accounts={accounts}
          onClose={() => setOpenModal(null)}
          onBack={onBackFromForm}
          onSuccess={() => { onEntrySaved(); toast.success('Manual entry saved.'); }}
        />
      )}
      {openModal === 'transfer' && (
        <TransferModal
          companyId={companyId}
          branchId={branchId}
          createdBy={user?.id}
          accounts={accounts}
          onClose={() => setOpenModal(null)}
          onBack={onBackFromForm}
          onSuccess={() => { onEntrySaved(); toast.success('Transfer saved.'); }}
        />
      )}
      {openModal === 'supplier' && (
        <SupplierPaymentModal
          companyId={companyId}
          branchId={branchId}
          createdBy={user?.id}
          suppliers={suppliers}
          paymentAccounts={paymentAccounts.length ? paymentAccounts : accounts}
          onClose={() => setOpenModal(null)}
          onBack={onBackFromForm}
          onSuccess={() => { onEntrySaved(); toast.success('Supplier payment saved.'); }}
        />
      )}
      {openModal === 'worker' && (
        <WorkerPaymentModal
          companyId={companyId}
          branchId={branchId}
          createdBy={user?.id}
          workers={workers}
          paymentAccounts={paymentAccounts.length ? paymentAccounts : accounts}
          onClose={() => setOpenModal(null)}
          onBack={onBackFromForm}
          onSuccess={() => { onEntrySaved(); toast.success('Worker payment saved.'); }}
        />
      )}
      {openModal === 'expense' && (
        <AddExpenseDrawer
          isOpen={openModal === 'expense'}
          onClose={() => setOpenModal(null)}
          onSuccess={() => { setOpenModal(null); toast.success('Expense recorded.'); loadEntries(); }}
        />
      )}
      {openModal === 'customer' && (
        <CustomerReceiptModal
          companyId={companyId}
          branchId={branchId}
          createdBy={user?.id}
          customers={customers}
          paymentAccounts={paymentAccounts.length ? paymentAccounts : accounts}
          onClose={() => setOpenModal(null)}
          onBack={onBackFromForm}
          onSuccess={() => { onEntrySaved(); toast.success('Customer receipt saved.'); }}
        />
      )}
    </div>
  );
}

// ----- View entry detail modal -----
function ViewEntryDetailModal({ entry, onClose }: { entry: TestEntry; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Entry Details</h2>
                <p className="text-xs text-gray-400">{entry.entry_no} · {getTestEntryTypeLabel(entry.reference_type)}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
              <X size={20} />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Date</span><p className="text-white font-medium">{entry.entry_date}</p></div>
              <div><span className="text-gray-500">Amount</span><p className="text-white font-medium">PKR {entry.amount.toLocaleString()}</p></div>
            </div>
            {entry.description && (
              <div>
                <span className="text-gray-500 text-sm">Description</span>
                <p className="text-gray-200 mt-1">{entry.description}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500 text-sm block mb-2">Lines</span>
              <table className="w-full text-sm border border-gray-700 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-800/80 text-left text-gray-400">
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="px-3 py-2 font-medium text-right">Debit</th>
                    <th className="px-3 py-2 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map((l) => (
                    <tr key={l.id} className="border-t border-gray-700">
                      <td className="px-3 py-2 text-gray-200">{l.account_name || l.account_id}</td>
                      <td className="px-3 py-2 text-right text-green-400">{l.debit > 0 ? l.debit.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 text-right text-red-400">{l.credit > 0 ? l.credit.toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {entry.attachments && entry.attachments.length > 0 && (
              <div>
                <span className="text-gray-500 text-sm block mb-2">Attachments</span>
                <div className="flex flex-wrap gap-2">
                  {entry.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm truncate max-w-[200px]">
                      {a.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="p-5 border-t border-gray-800 flex justify-end">
            <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300">Close</Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Step 1: Type selection dialog -----
function TypeSelectionDialog({
  onSelect,
  onClose,
}: {
  onSelect: (type: ModalType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100]" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto my-8" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📝</span> NEW ACCOUNT ENTRY
                </h2>
                <p className="text-sm text-gray-400 mt-1">Kya aap karna chahte hain?</p>
              </div>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
            {ENTRY_OPTIONS.map(({ key, icon, title, subtitle }) => (
              <button
                key={key}
                type="button"
                onClick={() => key && onSelect(key)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-700/80 hover:border-gray-600 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-medium text-white">{title}</p>
                    <p className="text-xs text-gray-400">{subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-gray-800">
            <Button variant="outline" onClick={onClose} className="w-full border-gray-600 text-gray-300 hover:bg-gray-800">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Manual Entry Modal -----
function ManualEntryModal({
  companyId,
  branchId,
  createdBy,
  accounts,
  onClose,
  onBack,
  onSuccess,
}: {
  companyId: string;
  branchId: string | null;
  createdBy?: string;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onBack?: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(today);
  const [optionalRef, setOptionalRef] = useState('');
  const [description, setDescription] = useState('');
  const [debitId, setDebitId] = useState('');
  const [creditId, setCreditId] = useState('');
  const [amount, setAmount] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [postAsDraft, setPostAsDraft] = useState(false);
  const voucherRef = 'JV-' + new Date().getFullYear() + '-0001'; // Placeholder; actual from backend on save

  const amountNum = parseFloat(amount) || 0;
  const debitName = accounts.find((a) => a.id === debitId)?.name ?? '';
  const creditName = accounts.find((a) => a.id === creditId)?.name ?? '';
  const inWords = amountNum > 0 ? amountToWords(amountNum) : '—';

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!debitId || !creditId) {
      toast.error('Select both Debit and Credit accounts');
      return;
    }
    if (debitId === creditId) {
      toast.error('Debit and Credit accounts cannot be the same');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      let attachments: { url: string; name: string }[] = [];
      if (files.length) {
        attachments = await uploadJournalEntryAttachments(companyId, files);
      }
      await testAccountingService.createManualEntry({
        companyId,
        branchId,
        createdBy,
        date,
        description: description.trim(),
        optionalReference: optionalRef.trim() || undefined,
        debitAccountId: debitId,
        creditAccountId: creditId,
        amount: amountNum,
        attachments: attachments.length ? attachments : undefined,
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          {/* Header – UnifiedPaymentDialog pattern */}
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              {onBack && (
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 text-sm">← BACK</button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">JOURNAL VOUCHER</h2>
                <p className="text-xs text-gray-400 mt-0.5">General Ledger Entry</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <span className="text-xs font-medium text-gray-400">Voucher #</span>
                  <p className="text-sm font-mono text-gray-300 mt-1 bg-gray-900/50 px-2 py-1 rounded inline-block">{voucherRef}</p>
                  <div className="mt-3">
                    <Label className="text-xs text-gray-400">Optional Manual Reference</Label>
                    <Input value={optionalRef} onChange={(e) => setOptionalRef(e.target.value)} placeholder="Optional" className="mt-1 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Date <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Description <span className="text-red-400">*</span></Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Required" rows={3} className="bg-gray-900 border-2 border-gray-700 rounded-lg text-white placeholder-gray-600 focus:border-blue-500 resize-none" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">DEBIT ENTRY</p>
                  <SearchableSelect value={debitId} onValueChange={setDebitId} options={accounts} placeholder="Search or Select Account" className="bg-gray-900" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">CREDIT ENTRY</p>
                  <SearchableSelect value={creditId} onValueChange={setCreditId} options={accounts} placeholder="Search or Select Account" className="bg-gray-900" />
                </div>
                <p className="text-xs text-amber-400">⚠️ Debit & Credit account cannot be same</p>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Amount <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">PKR</span>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="pl-12 bg-gray-900 border-2 border-gray-700 rounded-lg text-white text-lg font-semibold focus:border-blue-500" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">In Words: {inWords}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">ACCOUNTING EFFECT</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-gray-200">Debit: <strong className="text-green-400">{debitName || '—'}</strong> {amountNum > 0 ? `+${amountNum.toLocaleString()}` : ''}</p>
                    <p className="text-gray-200">Credit: <strong className="text-red-400">{creditName || '—'}</strong> {amountNum > 0 ? `-${amountNum.toLocaleString()}` : ''}</p>
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Attachment (Optional)</Label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400">📎 Click to upload. PDF, JPG, PNG</p>
                    </div>
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} className="hidden" />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-gray-800/80 px-2 py-1.5 text-sm text-gray-200">
                          <span className="truncate min-w-0">{file.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-400 hover:text-red-400 p-0.5 rounded" aria-label="Remove file">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">{files.length > 0 && `${files.length} file(s) to upload`}</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm">Cancel</Button>
              <Button variant="outline" onClick={handleSave} disabled={saving || !description.trim() || !debitId || !creditId || amountNum <= 0 || debitId === creditId} className="border-gray-500 text-gray-300 px-5 text-sm">SAVE DRAFT</Button>
              <Button onClick={handleSave} disabled={saving || !description.trim() || !debitId || !creditId || amountNum <= 0 || debitId === creditId} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[130px] px-5 py-2.5 text-sm font-semibold">
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span> : <span className="flex items-center gap-2"><Check size={16} /> POST ENTRY</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Transfer Modal -----
function TransferModal({
  companyId,
  branchId,
  createdBy,
  accounts,
  onClose,
  onSuccess,
  onBack,
}: {
  companyId: string;
  branchId: string | null;
  createdBy?: string;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [date, setDate] = useState(today);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const amountNum = parseFloat(amount) || 0;
  const fromName = accounts.find((a) => a.id === fromId)?.name ?? '';
  const toName = accounts.find((a) => a.id === toId)?.name ?? '';

  const handleSave = async () => {
    if (!fromId || !toId) {
      toast.error('Select From and To accounts');
      return;
    }
    if (fromId === toId) {
      toast.error('From and To accounts cannot be the same');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      let attachments: { url: string; name: string }[] = [];
      if (files.length) attachments = await uploadJournalEntryAttachments(companyId, files);
      await testAccountingService.createTransfer({
        companyId,
        branchId,
        createdBy,
        date,
        fromAccountId: fromId,
        toAccountId: toId,
        amount: amountNum,
        description: description.trim() || 'Account transfer',
        attachments: attachments.length ? attachments : undefined,
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              {onBack && (
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 text-sm">← BACK</button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <ArrowLeftRight className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Account Transfer</h2>
                <p className="text-xs text-gray-400 mt-0.5">Bank/Cash to Bank/Cash</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Date <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">From Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={fromId} onValueChange={setFromId} options={accounts} placeholder="Select source account" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">To Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={toId} onValueChange={setToId} options={accounts} placeholder="Select destination account" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Amount <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">PKR</span>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-12 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="space-y-4">
                {fromName && toName && amountNum > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Summary</span>
                    <p className="text-sm text-blue-200 mt-2">Dr <strong>{toName}</strong>, Cr <strong>{fromName}</strong></p>
                    <p className="text-lg font-bold text-blue-300 mt-1">PKR {amountNum.toLocaleString()}</p>
                  </div>
                )}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Attachment (Optional)</Label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400"><span className="text-blue-400 font-medium">Click to upload</span></p>
                    </div>
                    <input type="file" multiple onChange={(e) => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} className="hidden" />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-gray-800/80 px-2 py-1.5 text-sm text-gray-200">
                          <span className="truncate min-w-0">{file.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-400 hover:text-red-400 p-0.5 rounded" aria-label="Remove file">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">{files.length > 0 && `${files.length} file(s) to upload`}</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !fromId || !toId || fromId === toId || amountNum <= 0} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold">
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span> : <span className="flex items-center gap-2"><Check size={16} /> Save</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Supplier Payment Modal -----
function SupplierPaymentModal({
  companyId,
  branchId,
  createdBy,
  suppliers,
  paymentAccounts,
  onClose,
  onSuccess,
  onBack,
}: {
  companyId: string;
  branchId: string | null;
  createdBy?: string;
  suppliers: { id: string; name: string; dueBalance?: number }[];
  paymentAccounts: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [date, setDate] = useState(today);
  const [supplierId, setSupplierId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const amountNum = parseFloat(amount) || 0;
  const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? '';

  const handleSave = async () => {
    if (!supplierId || !paymentAccountId) {
      toast.error('Select supplier and payment account');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      let attachments: { url: string; name: string }[] = [];
      if (files.length) attachments = await uploadJournalEntryAttachments(companyId, files);
      await testAccountingService.createSupplierPayment({
        companyId,
        branchId,
        createdBy,
        date,
        supplierId,
        supplierName,
        paymentAccountId,
        amount: amountNum,
        description: description.trim() || 'Supplier payment',
        attachments: attachments.length ? attachments : undefined,
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              {onBack && (
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 text-sm">← BACK</button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Supplier Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">Bill Payment to Vendor</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <span className="text-xs font-medium text-gray-400">Supplier Details</span>
                  <div className="mt-2">
                    <SearchableSelect value={supplierId} onValueChange={setSupplierId} options={suppliers} placeholder="Select supplier" badgeColor="orange" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Date <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Payment Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={paymentAccountId} onValueChange={setPaymentAccountId} options={paymentAccounts} placeholder="Select account" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Amount <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">PKR</span>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-12 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="space-y-4">
                {supplierName && amountNum > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Summary</span>
                    <p className="text-sm text-blue-200 mt-2">Dr Accounts Payable ({supplierName}), Cr Payment Account</p>
                    <p className="text-lg font-bold text-blue-300 mt-1">PKR {amountNum.toLocaleString()}</p>
                  </div>
                )}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Attachment (Optional)</Label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400"><span className="text-blue-400 font-medium">Click to upload</span></p>
                    </div>
                    <input type="file" multiple onChange={(e) => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} className="hidden" />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-gray-800/80 px-2 py-1.5 text-sm text-gray-200">
                          <span className="truncate min-w-0">{file.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-400 hover:text-red-400 p-0.5 rounded" aria-label="Remove file">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">{files.length > 0 && `${files.length} file(s) to upload`}</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !supplierId || !paymentAccountId || amountNum <= 0} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold">
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span> : <span className="flex items-center gap-2"><Check size={16} /> Save</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Worker Payment Modal -----
function WorkerPaymentModal({
  companyId,
  branchId,
  createdBy,
  workers,
  paymentAccounts,
  onClose,
  onSuccess,
  onBack,
}: {
  companyId: string;
  branchId: string | null;
  createdBy?: string;
  workers: { id: string; name: string; dueBalance?: number }[];
  paymentAccounts: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [date, setDate] = useState(today);
  const [workerId, setWorkerId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const amountNum = parseFloat(amount) || 0;
  const workerName = workers.find((w) => w.id === workerId)?.name ?? '';

  const handleSave = async () => {
    if (!workerId || !paymentAccountId) {
      toast.error('Select worker and payment account');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      let attachments: { url: string; name: string }[] = [];
      if (files.length) attachments = await uploadJournalEntryAttachments(companyId, files);
      await testAccountingService.createWorkerPayment({
        companyId,
        branchId,
        createdBy,
        date,
        workerId,
        workerName,
        paymentAccountId,
        amount: amountNum,
        description: description.trim() || 'Worker payment',
        attachments: attachments.length ? attachments : undefined,
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  function FilePreview({ file }: { file: File }) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
      if (!isImage(file)) return;
      const u = URL.createObjectURL(file);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }, [file]);
    if (!isImage(file)) return (
      <div className="w-12 h-12 rounded border border-gray-700 bg-gray-800 flex items-center justify-center">
        <FileType className="h-6 w-6 text-gray-500" />
      </div>
    );
    if (!url) return <div className="w-12 h-12 rounded border border-gray-700 bg-gray-800 animate-pulse" />;
    return <img src={url} alt="" className="w-12 h-12 object-cover rounded border border-gray-700" />;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              {onBack && (
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 text-sm">← BACK</button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <UserCog className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Worker Payment</h2>
                <p className="text-xs text-gray-400 mt-0.5">Labour, Staff Salary</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <span className="text-xs font-medium text-gray-400">Worker Details</span>
                  <div className="mt-2">
                    <SearchableSelect value={workerId} onValueChange={setWorkerId} options={workers} placeholder="Select worker" badgeColor="orange" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Date <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Payment Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={paymentAccountId} onValueChange={setPaymentAccountId} options={paymentAccounts} placeholder="Select account" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Amount <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">PKR</span>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-12 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="space-y-4">
                {workerName && amountNum > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Summary</span>
                    <p className="text-sm text-blue-200 mt-2">Dr Salary/Worker Payable ({workerName}), Cr Payment Account</p>
                    <p className="text-lg font-bold text-blue-300 mt-1">PKR {amountNum.toLocaleString()}</p>
                  </div>
                )}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Attachment (Optional)</Label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400"><span className="text-blue-400 font-medium">Click to upload</span></p>
                    </div>
                    <input type="file" multiple onChange={(e) => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} className="hidden" />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-gray-800/80 px-2 py-1.5 text-sm text-gray-200">
                          <span className="truncate min-w-0">{file.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-400 hover:text-red-400 p-0.5 rounded" aria-label="Remove file">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">{files.length > 0 && `${files.length} file(s) to upload`}</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !workerId || !paymentAccountId || amountNum <= 0} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold">
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span> : <span className="flex items-center gap-2"><Check size={16} /> Save</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Expense Entry Modal -----
function ExpenseEntryModal({
  companyId,
  branchId,
  createdBy,
  expenseAccounts,
  paymentAccounts,
  onClose,
  onSuccess,
  onBack,
}: {
  companyId: string;
  branchId: string | null;
  createdBy?: string;
  expenseAccounts: { id: string; name: string }[];
  paymentAccounts: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [date, setDate] = useState(today);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const amountNum = parseFloat(amount) || 0;
  const expenseName = expenseAccounts.find((a) => a.id === expenseAccountId)?.name ?? '';

  const handleSave = async () => {
    if (!expenseAccountId || !paymentAccountId) {
      toast.error('Select expense account and payment account');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      let attachments: { url: string; name: string }[] = [];
      if (files.length) attachments = await uploadJournalEntryAttachments(companyId, files);
      await testAccountingService.createExpenseEntry({
        companyId,
        branchId,
        createdBy,
        date,
        expenseAccountId,
        paymentAccountId,
        amount: amountNum,
        description: description.trim() || 'Expense entry',
        attachments: attachments.length ? attachments : undefined,
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              {onBack && (
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 text-sm">← BACK</button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Expense Entry</h2>
                <p className="text-xs text-gray-400 mt-0.5">Office Expense, Petty Cash</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Date <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Expense Category / Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={expenseAccountId} onValueChange={setExpenseAccountId} options={expenseAccounts} placeholder="Select expense account" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Payment Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={paymentAccountId} onValueChange={setPaymentAccountId} options={paymentAccounts} placeholder="Select account" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Amount <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">PKR</span>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-12 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>

                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="space-y-4">
                {expenseName && amountNum > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Summary</span>
                    <p className="text-sm text-blue-200 mt-2">Dr <strong>{expenseName}</strong>, Cr Payment Account</p>
                    <p className="text-lg font-bold text-blue-300 mt-1">PKR {amountNum.toLocaleString()}</p>
                  </div>
                )}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Attachment (Optional)</Label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400"><span className="text-blue-400 font-medium">Click to upload</span></p>
                    </div>
                    <input type="file" multiple onChange={(e) => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} className="hidden" />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-gray-800/80 px-2 py-1.5 text-sm text-gray-200">
                          <span className="truncate min-w-0">{file.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-400 hover:text-red-400 p-0.5 rounded" aria-label="Remove file">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">{files.length > 0 && `${files.length} file(s) to upload`}</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !expenseAccountId || !paymentAccountId || amountNum <= 0} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold">
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span> : <span className="flex items-center gap-2"><Check size={16} /> Save</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ----- Customer Receipt Modal -----
function CustomerReceiptModal({
  companyId,
  branchId,
  createdBy,
  customers,
  paymentAccounts,
  onClose,
  onSuccess,
  onBack,
}: {
  companyId: string;
  branchId: string | null;
  createdBy?: string;
  customers: { id: string; name: string }[];
  paymentAccounts: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [date, setDate] = useState(today);
  const [customerId, setCustomerId] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const amountNum = parseFloat(amount) || 0;
  const customerName = customers.find((c) => c.id === customerId)?.name ?? '';

  const handleSave = async () => {
    if (!customerId || !paymentAccountId) {
      toast.error('Select customer and payment account');
      return;
    }
    if (amountNum <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    setSaving(true);
    try {
      let attachments: { url: string; name: string }[] = [];
      if (files.length) attachments = await uploadJournalEntryAttachments(companyId, files);
      await testAccountingService.createCustomerReceipt({
        companyId,
        branchId,
        createdBy,
        date,
        customerId,
        customerName,
        paymentAccountId,
        amount: amountNum,
        description: description.trim() || 'Customer receipt',
        attachments: attachments.length ? attachments : undefined,
      });
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
            <div className="flex items-center gap-3">
              {onBack && (
                <button type="button" onClick={onBack} className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 text-sm">← BACK</button>
              )}
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Customer Receipt</h2>
                <p className="text-xs text-gray-400 mt-0.5">Payment Received</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Date <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Customer <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={customerId} onValueChange={setCustomerId} options={customers} placeholder="Search or Select Customer" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Payment Account <span className="text-red-400">*</span></Label>
                  <SearchableSelect value={paymentAccountId} onValueChange={setPaymentAccountId} options={paymentAccounts} placeholder="Select account (Cash/Bank)" />
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Amount <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">PKR</span>
                    <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-12 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500" />
                  </div>
                </div>
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="e.g. Payment against invoice" className="bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:border-blue-500 resize-none" />
                </div>
              </div>
              <div className="space-y-4">
                {customerName && amountNum > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Summary</span>
                    <p className="text-sm text-blue-200 mt-2">Dr Payment Account, Cr Accounts Receivable ({customerName})</p>
                    <p className="text-lg font-bold text-blue-300 mt-1">PKR {amountNum.toLocaleString()}</p>
                  </div>
                )}
                <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-4">
                  <Label className="block text-sm font-semibold text-gray-300 mb-2">Attachment (Optional)</Label>
                  <label className="block cursor-pointer">
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                      <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-xs text-gray-400">📎 Upload payment proof</p>
                    </div>
                    <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} className="hidden" />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-gray-800/80 px-2 py-1.5 text-sm text-gray-200">
                          <span className="truncate min-w-0">{file.name}</span>
                          <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-gray-400 hover:text-red-400 p-0.5 rounded" aria-label="Remove file">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 border-t border-gray-800 bg-gray-950/50">
            <div className="text-xs text-gray-400">{files.length > 0 && `${files.length} file(s) to upload`}</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose} disabled={saving} className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5 text-sm">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !customerId || !paymentAccountId || amountNum <= 0} className="bg-blue-600 hover:bg-blue-500 text-white min-w-[150px] px-5 py-2.5 text-sm font-semibold">
                {saving ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span> : <span className="flex items-center gap-2"><Check size={16} /> Record Receipt</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
