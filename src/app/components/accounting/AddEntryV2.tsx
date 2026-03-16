/**
 * Add Entry V2 – Rebuild of Add Entry. Theme-matched, typed, accounting-safe.
 * Entry types: Pure Journal, Customer Receipt, Supplier Payment, Worker Payment, Expense Payment, Internal Transfer, Courier Payment.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ArrowLeftRight,
  ArrowLeft,
  Truck,
  UserCog,
  Receipt,
  Wallet,
  CreditCard,
  X,
  Check,
  Loader2,
  Info,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { accountService } from '@/app/services/accountService';
import { userService } from '@/app/services/userService';
import { contactService } from '@/app/services/contactService';
import { expenseCategoryService } from '@/app/services/expenseCategoryService';
import { courierService } from '@/app/services/courierService';
import { studioService } from '@/app/services/studioService';
import {
  createPureJournalEntry,
  createCustomerReceiptEntry,
  createSupplierPaymentEntry,
  createWorkerPaymentEntry,
  createExpensePaymentEntry,
  createInternalTransferEntry,
  createCourierPaymentEntry,
} from '@/app/services/addEntryV2Service';
import { toast } from 'sonner';

export type AddEntryV2Type =
  | 'pure_journal'
  | 'customer_receipt'
  | 'supplier_payment'
  | 'worker_payment'
  | 'expense_payment'
  | 'internal_transfer'
  | 'courier_payment';

const ENTRY_TYPES: { key: AddEntryV2Type; label: string; description: string; icon: React.ReactNode }[] = [
  { key: 'pure_journal', label: 'Pure Journal', description: 'Record a non-cash accounting adjustment', icon: <FileText size={20} /> },
  { key: 'customer_receipt', label: 'Customer Receipt', description: 'Record payment received from customer', icon: <Receipt size={20} /> },
  { key: 'supplier_payment', label: 'Supplier Payment', description: 'Record payment made to supplier', icon: <CreditCard size={20} /> },
  { key: 'worker_payment', label: 'Worker Payment', description: 'Record payment made to worker', icon: <UserCog size={20} /> },
  { key: 'expense_payment', label: 'Expense Payment', description: 'Record an operating expense payment', icon: <Wallet size={20} /> },
  { key: 'internal_transfer', label: 'Internal Transfer', description: 'Move money between your own accounts', icon: <ArrowLeftRight size={20} /> },
  { key: 'courier_payment', label: 'Courier Payment', description: 'Record payment made to courier company', icon: <Truck size={20} /> },
];

const today = () => new Date().toISOString().slice(0, 10);

export interface AddEntryV2Props {
  onClose: () => void;
}

type AddEntryStep = 'select-type' | 'entry-form';

export function AddEntryV2({ onClose }: AddEntryV2Props) {
  const { companyId, branchId, user } = useSupabase();
  const accounting = useAccounting();
  const { createExpense } = useExpenses();
  const [step, setStep] = useState<AddEntryStep>('select-type');
  const [entryType, setEntryType] = useState<AddEntryV2Type>('pure_journal');
  const [accounts, setAccounts] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [couriers, setCouriers] = useState<{ id: string; name: string; contact_id?: string | null }[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [paymentAccountsList, setPaymentAccountsList] = useState<{ id: string; name: string }[]>([]);
  const [salaryUsers, setSalaryUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state – shared where applicable
  const [entryDate, setEntryDate] = useState(today());
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Mobile Wallet'>('Cash');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [supplierContactId, setSupplierContactId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [courierId, setCourierId] = useState('');
  const [courierName, setCourierName] = useState('');
  const [expenseCategorySlug, setExpenseCategorySlug] = useState('');
  const [expenseSalaryUserId, setExpenseSalaryUserId] = useState('');
  const [expenseSalaryUserName, setExpenseSalaryUserName] = useState('');
  const [expenseBonus, setExpenseBonus] = useState<number>(0);
  const [expenseDeduction, setExpenseDeduction] = useState<number>(0);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined),
      accountService.getPaymentAccountsOnly(companyId),
      contactService.getAllContacts(companyId, 'supplier'),
      contactService.getAllContacts(companyId, 'customer'),
      courierService.getByCompanyId(companyId, false),
      expenseCategoryService.getOperatingCategoriesForPicker(companyId),
    ])
      .then(([acc, payAcc, sup, cust, courierList, expCats]) => {
        const accList = (acc || []).map((a: any) => ({ id: a.id, name: (a.code ? `${a.code} – ` : '') + (a.name || ''), code: a.code }));
        setAccounts(accList);
        const payList = (payAcc || []).map((a: any) => ({ id: a.id, name: a.name || a.code || '' }));
        setPaymentAccountsList(payList);
        setSuppliers((sup || []).filter((c: any) => c.type === 'supplier' || c.type === 'both').map((c: any) => ({ id: c.id, name: c.name || c.id })));
        setCustomers((cust || []).map((c: any) => ({ id: c.id, name: (c as any).name || c.id })));
        setCouriers((courierList || []).map((c: any) => ({ id: c.id, name: c.name || c.id, contact_id: (c as any).contact_id })));
        setExpenseCategories(expCats || []);
        if (payList.length && !paymentAccountId) setPaymentAccountId(payList[0].id);
        if (payList.length >= 2 && !fromAccountId) setFromAccountId(payList[0].id);
        if (payList.length >= 2 && !toAccountId) setToAccountId(payList[1].id);
        if (payList.length === 1 && !fromAccountId) setFromAccountId(payList[0].id);
        if (payList.length === 1 && !toAccountId) setToAccountId(payList[0].id);
        if (accList.length && !debitAccountId) setDebitAccountId(accList[0].id);
        if (accList.length && !creditAccountId) setCreditAccountId(accList[accList.length - 1]?.id || accList[0].id);
        if ((expCats || []).length && !expenseCategorySlug) setExpenseCategorySlug((expCats || [])[0]?.slug || '');
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId) return;
    studioService.getAllWorkers(companyId).then((list) => setWorkers((list || []).map((w: any) => ({ id: w.id, name: w.name || w.id }))));
  }, [companyId]);

  const isExpenseSalary = expenseCategorySlug === 'salaries' || expenseCategorySlug === 'salary';
  useEffect(() => {
    if (!companyId || !isExpenseSalary) return;
    userService.getUsersForSalary(companyId).then((list) =>
      setSalaryUsers((list || []).map((u: any) => ({ id: u.id, full_name: u.full_name || u.email || 'Unknown' })))
    ).catch(() => setSalaryUsers([]));
  }, [companyId, isExpenseSalary]);

  const paymentAccounts = useMemo(() => paymentAccountsList.length > 0 ? paymentAccountsList.map((a) => ({ id: a.id, name: a.name })) : accounts.filter((a) => /cash|bank|wallet/.test((a.name || '').toLowerCase())), [paymentAccountsList, accounts]);

  const preview = useMemo(() => {
    const touchesPayment = ['customer_receipt', 'supplier_payment', 'worker_payment', 'expense_payment', 'courier_payment'].includes(entryType);
    const ledgerSync =
      entryType === 'supplier_payment'
        ? 'Supplier Ledger'
        : entryType === 'worker_payment'
          ? 'Worker Ledger'
          : entryType === 'courier_payment'
            ? 'Courier Reports'
            : null;
    return {
      paymentRow: touchesPayment,
      journalEntry: true,
      ledgerSync,
      roznamcha: touchesPayment,
    };
  }, [entryType]);

  const canSave = useMemo(() => {
    if (amount <= 0) return false;
    switch (entryType) {
      case 'pure_journal':
        return !!(debitAccountId && creditAccountId);
      case 'customer_receipt':
        return !!(customerId && customerName && paymentAccountId);
      case 'supplier_payment':
        return !!(supplierContactId && supplierName && paymentAccountId);
      case 'worker_payment':
        return !!(workerId && workerName && paymentAccountId);
      case 'expense_payment':
        if (!expenseCategorySlug || !paymentAccountId) return false;
        if (isExpenseSalary && !expenseSalaryUserId) return false;
        if (!branchId || branchId === 'all') return false;
        return true;
      case 'internal_transfer':
        return !!(fromAccountId && toAccountId);
      case 'courier_payment':
        return !!(courierId && courierName && paymentAccountId);
      default:
        return false;
    }
  }, [entryType, amount, debitAccountId, creditAccountId, customerId, customerName, supplierContactId, supplierName, workerId, workerName, paymentAccountId, expenseCategorySlug, isExpenseSalary, expenseSalaryUserId, branchId, fromAccountId, toAccountId, courierId, courierName]);

  const handleSubmit = async () => {
    if (!companyId) return;
    const branch = branchId && branchId !== 'all' ? branchId : null;
    const uid = (user as any)?.id ?? null;
    setSaving(true);
    try {
      switch (entryType) {
        case 'pure_journal': {
          if (!debitAccountId || !creditAccountId || amount <= 0) {
            toast.error('Select both accounts and enter amount');
            return;
          }
          await createPureJournalEntry({
            companyId,
            branchId: branch,
            entryDate,
            debitAccountId,
            creditAccountId,
            amount,
            description: description || undefined,
            createdBy: uid,
          });
          toast.success('Journal entry saved');
          break;
        }
        case 'customer_receipt': {
          if (!customerId || !customerName || amount <= 0 || !paymentAccountId) {
            toast.error('Select customer, amount, and payment account');
            return;
          }
          await createCustomerReceiptEntry({
            companyId,
            branchId: branch,
            customerId,
            customerName,
            amount,
            paymentAccountId,
            paymentDate: entryDate,
            paymentMethod,
            notes: description || undefined,
          });
          toast.success('Customer receipt saved');
          break;
        }
        case 'supplier_payment': {
          if (!supplierContactId || !supplierName || amount <= 0 || !paymentAccountId) {
            toast.error('Select supplier, amount, and payment account');
            return;
          }
          await createSupplierPaymentEntry({
            companyId,
            branchId: branch,
            supplierContactId,
            supplierName,
            amount,
            paymentAccountId,
            paymentDate: entryDate,
            paymentMethod,
            notes: description || undefined,
          });
          toast.success('Supplier payment saved');
          break;
        }
        case 'worker_payment': {
          if (!workerId || !workerName || amount <= 0 || !paymentAccountId) {
            toast.error('Select worker, amount, and payment account');
            return;
          }
          await createWorkerPaymentEntry({
            companyId,
            branchId: branch,
            workerId,
            workerName,
            amount,
            paymentAccountId,
            paymentDate: entryDate,
            paymentMethod,
            notes: description || undefined,
          });
          toast.success('Worker payment saved');
          break;
        }
        case 'expense_payment': {
          if (!expenseCategorySlug || amount <= 0 || !paymentAccountId) {
            toast.error('Select expense category, amount, and payment account');
            return;
          }
          if (isExpenseSalary && !expenseSalaryUserId) {
            toast.error('Select employee for Salary expense');
            return;
          }
          const effectiveBranchId = branch || (branchId !== 'all' ? branchId : null);
          if (!effectiveBranchId) {
            toast.error('Select a branch for expense');
            return;
          }
          const paidFromAccount = paymentAccounts.find((a) => a.id === paymentAccountId);
          const paymentMethodName = paidFromAccount?.name || paymentMethod;
          const netAmount = amount + (expenseBonus || 0) - (expenseDeduction || 0);
          const expenseDesc = description || (isExpenseSalary && expenseSalaryUserName ? `${expenseSalaryUserName} – Salary` : expenseCategories.find((c) => c.slug === expenseCategorySlug)?.name || expenseCategorySlug);
          const notes = [expenseBonus ? `Bonus: ${expenseBonus}` : '', expenseDeduction ? `Deduction: ${expenseDeduction}` : ''].filter(Boolean).join('; ') || undefined;
          await createExpense(
            {
              category: expenseCategorySlug,
              description: expenseDesc,
              amount: netAmount,
              date: entryDate,
              paymentMethod: paymentMethodName,
              payeeName: isExpenseSalary ? expenseSalaryUserName : '',
              location: effectiveBranchId,
              status: 'paid',
              submittedBy: '',
              receiptAttached: false,
              notes: notes || description || undefined,
            },
            {
              branchId: effectiveBranchId,
              payment_account_id: paymentAccountId,
              paidToUserId: isExpenseSalary && expenseSalaryUserId ? expenseSalaryUserId : undefined,
            }
          );
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.log('[AddEntryV2] expense_payment saved:', { category: expenseCategorySlug, amount: netAmount, payment_account_id: paymentAccountId, paidToUserId: isExpenseSalary ? expenseSalaryUserId : null });
          }
          toast.success('Expense saved');
          break;
        }
        case 'internal_transfer': {
          if (!fromAccountId || !toAccountId || amount <= 0) {
            toast.error('Select from/to accounts and amount');
            return;
          }
          await createInternalTransferEntry({
            companyId,
            branchId: branch,
            fromAccountId,
            toAccountId,
            amount,
            entryDate,
            description: description || undefined,
            createdBy: uid,
          });
          toast.success('Transfer saved');
          break;
        }
        case 'courier_payment': {
          if (!courierId || !courierName || amount <= 0 || !paymentAccountId) {
            toast.error('Select courier, amount, and payment account');
            return;
          }
          const courier = couriers.find((c) => c.id === courierId);
          await createCourierPaymentEntry({
            companyId,
            branchId: branch,
            courierId,
            courierName,
            courierContactId: courier?.contact_id ?? null,
            amount,
            paymentAccountId,
            paymentDate: entryDate,
            paymentMethod,
            notes: description || undefined,
          });
          toast.success('Courier payment saved');
          break;
        }
      }
      accounting.refreshEntries?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
        <p className="text-gray-400">Select a company first.</p>
      </div>
    );
  }

  const inputClass = 'w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';
  const labelClass = 'block text-sm font-semibold text-gray-300 mb-2';

  return (
    <>
      {/* Backdrop – same as UnifiedPaymentDialog */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl pointer-events-auto animate-in zoom-in-95 duration-200 my-8 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step 1: Entry type selection */}
          {step === 'select-type' && (
            <>
              <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Add Entry</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Select the type of accounting entry you want to record</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="group" aria-label="Entry type">
                  {ENTRY_TYPES.map((t) => {
                    const selected = entryType === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setEntryType(t.key)}
                        className={`text-left p-4 rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                          selected
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'}`}>
                            {t.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-white">{t.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>
                            {selected && (
                              <div className="mt-2 flex items-center gap-1 text-blue-400 text-xs font-medium">
                                <Check size={14} /> Selected
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-800">
                  <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setStep('entry-form')}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Entry form */}
          {step === 'entry-form' && (
            <>
              <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('select-type')}
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    aria-label="Back to entry type"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    {ENTRY_TYPES.find((t) => t.key === entryType)?.icon ?? <FileText className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{ENTRY_TYPES.find((t) => t.key === entryType)?.label ?? 'Add Entry'}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{ENTRY_TYPES.find((t) => t.key === entryType)?.description ?? ''}</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg" aria-label="Close">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className={labelClass}>Date</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClass} />
              </div>
              {(entryType === 'customer_receipt' || entryType === 'supplier_payment' || entryType === 'worker_payment' || entryType === 'expense_payment' || entryType === 'courier_payment') && (
                <div>
                  <Label className={labelClass}>Payment method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Bank' | 'Mobile Wallet')}
                    className={inputClass}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Mobile Wallet">Mobile Wallet</option>
                  </select>
                </div>
              )}
            </div>

            {entryType === 'pure_journal' && (
              <>
                <div>
                  <Label className={labelClass}>Debit account</Label>
                  <select value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Credit account</Label>
                  <select value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {entryType === 'customer_receipt' && (
              <>
                <div>
                  <Label className={labelClass}>Customer</Label>
                  <select
                    value={customerId}
                    onChange={(e) => {
                      const c = customers.find((x) => x.id === e.target.value);
                      setCustomerId(e.target.value);
                      setCustomerName(c?.name ?? '');
                    }}
                    className={inputClass}
                  >
                    <option value="">Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Payment account (Cr)</Label>
                  <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {entryType === 'supplier_payment' && (
              <>
                <div>
                  <Label className={labelClass}>Supplier</Label>
                  <select
                    value={supplierContactId}
                    onChange={(e) => {
                      const s = suppliers.find((x) => x.id === e.target.value);
                      setSupplierContactId(e.target.value);
                      setSupplierName(s?.name ?? '');
                    }}
                    className={inputClass}
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Payment account (Cr)</Label>
                  <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {entryType === 'worker_payment' && (
              <>
                <div>
                  <Label className={labelClass}>Worker</Label>
                  <select
                    value={workerId}
                    onChange={(e) => {
                      const w = workers.find((x) => x.id === e.target.value);
                      setWorkerId(e.target.value);
                      setWorkerName(w?.name ?? '');
                    }}
                    className={inputClass}
                  >
                    <option value="">Select worker</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Payment account (Cr)</Label>
                  <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {entryType === 'expense_payment' && (
              <>
                <div>
                  <Label className={labelClass}>Expense category</Label>
                  <select value={expenseCategorySlug} onChange={(e) => setExpenseCategorySlug(e.target.value)} className={inputClass}>
                    <option value="">Select category</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {isExpenseSalary && (
                  <>
                    <div>
                      <Label className={labelClass}>Employee / User</Label>
                      <select
                        value={expenseSalaryUserId}
                        onChange={(e) => {
                          const u = salaryUsers.find((x) => x.id === e.target.value);
                          setExpenseSalaryUserId(e.target.value);
                          setExpenseSalaryUserName(u?.full_name ?? '');
                        }}
                        className={inputClass}
                      >
                        <option value="">Select employee</option>
                        {salaryUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className={labelClass}>Bonus (Rs)</Label>
                        <Input type="number" min={0} step="0.01" value={expenseBonus || ''} onChange={(e) => setExpenseBonus(parseFloat(e.target.value) || 0)} className={inputClass} />
                      </div>
                      <div>
                        <Label className={labelClass}>Deduction (Rs)</Label>
                        <Input type="number" min={0} step="0.01" value={expenseDeduction || ''} onChange={(e) => setExpenseDeduction(parseFloat(e.target.value) || 0)} className={inputClass} />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label className={labelClass}>Payment account (Cr)</Label>
                  <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {entryType === 'internal_transfer' && (
              <>
                <div>
                  <Label className={labelClass}>From account (Cr)</Label>
                  <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>To account (Dr)</Label>
                  <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {entryType === 'courier_payment' && (
              <>
                <div>
                  <Label className={labelClass}>Courier</Label>
                  <select
                    value={courierId}
                    onChange={(e) => {
                      const c = couriers.find((x) => x.id === e.target.value);
                      setCourierId(e.target.value);
                      setCourierName(c?.name ?? '');
                    }}
                    className={inputClass}
                  >
                    <option value="">Select courier</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className={labelClass}>Payment account (Cr)</Label>
                  <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={inputClass}>
                    {paymentAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <Label className={labelClass}>Amount (Rs)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount === 0 ? '' : amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            <div>
              <Label className={labelClass}>Description / Notes</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={inputClass} rows={2} />
            </div>

            {/* Posting preview */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-white mb-1">Posting preview</p>
                <ul className="text-gray-400 space-y-0.5">
                  <li>{preview.paymentRow ? 'Yes' : 'No'} – Payments row (Roznamcha)</li>
                  <li>Yes – Journal entry</li>
                  {preview.ledgerSync && <li>Sync → {preview.ledgerSync}</li>}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSubmit} disabled={saving || !canSave}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
