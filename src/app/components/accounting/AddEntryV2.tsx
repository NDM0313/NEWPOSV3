/**
 * Add Entry V2 – Rebuild of Add Entry. Theme-matched, typed, accounting-safe.
 * Entry types: Pure Journal, Customer Receipt, Supplier Payment, Worker Payment, Expense Payment, Internal Transfer, Courier Payment.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Building2,
  AlertCircle,
  ChevronDown,
  Calendar,
  Upload,
  Trash2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { useSupabase } from '@/app/context/SupabaseContext';
import { useAccounting } from '@/app/context/AccountingContext';
import { useExpenses } from '@/app/context/ExpenseContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useFormatCurrency } from '@/app/hooks/useFormatCurrency';
import { accountService } from '@/app/services/accountService';
import { userService } from '@/app/services/userService';
import { contactService } from '@/app/services/contactService';
import { loadPartyFormBalances } from '@/app/services/partyFormBalanceService';
import { warnIfUsingStoredBalanceAsTruth } from '@/app/services/accountingCanonicalGuard';
import { dispatchContactBalancesRefresh } from '@/app/lib/contactBalancesRefresh';
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
import {
  uploadJournalEntryAttachments,
  uploadUnifiedStylePaymentAttachments,
} from '@/app/utils/uploadTransactionAttachments';

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
  initialEntryType?: AddEntryV2Type;
  /** Pre-select party after contacts load (contact row `id` / UUID). */
  initialCustomerContactId?: string;
  initialSupplierContactId?: string;
  /** Pre-fill amount (e.g. outstanding due). */
  initialAmount?: number;
  /** Called only after a successful save, before `onClose`. */
  onRecorded?: () => void | Promise<void>;
}

type AddEntryStep = 'select-type' | 'entry-form';

export function AddEntryV2({
  onClose,
  initialEntryType,
  initialCustomerContactId,
  initialSupplierContactId,
  initialAmount,
  onRecorded,
}: AddEntryV2Props) {
  const { companyId, branchId, user } = useSupabase();
  const settings = useSettings();
  const { formatCurrency } = useFormatCurrency();
  const accounting = useAccounting();
  const { createExpense } = useExpenses();
  const [step, setStep] = useState<AddEntryStep>('select-type');
  const [entryType, setEntryType] = useState<AddEntryV2Type>('pure_journal');
  useEffect(() => {
    if (!initialEntryType) return;
    setEntryType(initialEntryType);
    setStep('entry-form');
  }, [initialEntryType]);

  const [accounts, setAccounts] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; dueGl: number; dueOp: number }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; dueGl: number; dueOp: number }[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string; dueGl: number; dueOp: number }[]>([]);
  const [couriers, setCouriers] = useState<{ id: string; name: string; contact_id?: string | null; dueGl: number; dueOp: number }[]>([]);
  /** Journal-derived party balances (AR/AP/worker accounts) — includes manual receipts/payments. */
  const [glBalancesOk, setGlBalancesOk] = useState(false);
  /** Sales/purchases/worker_ledger RPC — open-document view. */
  const [operationalBalancesOk, setOperationalBalancesOk] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [paymentAccountsList, setPaymentAccountsList] = useState<{ id: string; name: string }[]>([]);
  const [salaryUsers, setSalaryUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialPropsAppliedRef = useRef(false);

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
  /** Optional files — stored on `payments` (receipt/pay flows) or `journal_entries` (pure journal / transfer). Same bucket/layout as UnifiedPaymentDialog. */
  const [entryAttachmentFiles, setEntryAttachmentFiles] = useState<File[]>([]);

  const showEntryAttachments = useMemo(
    () =>
      step === 'entry-form' &&
      entryType !== 'expense_payment' &&
      !loading,
    [step, entryType, loading]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const loadFormData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!companyId) return;
    const silent = Boolean(opts?.silent);
    if (!silent) setLoading(true);
    try {
      const [{ byContactId, glRpcOk, operationalRpcOk }, acc, payAcc, allContacts, courierList, expCats, workerList] =
        await Promise.all([
          loadPartyFormBalances(companyId, branchId === 'all' ? null : branchId || null),
          accountService.getAllAccounts(companyId, branchId === 'all' ? undefined : branchId || undefined),
          accountService.getPaymentAccountsOnly(companyId),
          contactService.getAllContacts(companyId),
          courierService.getByCompanyId(companyId, false),
          expenseCategoryService.getOperatingCategoriesForPicker(companyId),
          studioService.getWorkersWithStats(companyId).catch(() => null as null),
        ]);

      setGlBalancesOk(glRpcOk);
      setOperationalBalancesOk(operationalRpcOk);

      const accList = (acc || []).map((a: any) => ({ id: a.id, name: (a.code ? `${a.code} – ` : '') + (a.name || ''), code: a.code }));
      setAccounts(accList);
      const payList = (payAcc || []).map((a: any) => ({ id: a.id, name: a.name || a.code || '' }));
      setPaymentAccountsList(payList);

      const row = (id: string) => byContactId.get(id);

      const contacts = allContacts || [];
      setSuppliers(
        contacts
          .filter((c: any) => c.type === 'supplier' || c.type === 'both')
          .map((c: any) => {
            const r = row(c.id);
            const dueOp =
              operationalRpcOk && r ? r.opPayable : Number(c.current_balance) || 0;
            const dueGl = glRpcOk && r ? r.glApPayable : 0;
            return { id: c.id, name: c.name || c.id, dueGl, dueOp };
          })
      );
      setCustomers(
        contacts
          .filter((c: any) => c.type === 'customer' || c.type === 'both')
          .map((c: any) => {
            const r = row(c.id);
            const dueOp =
              operationalRpcOk && r ? r.opReceivable : Number(c.current_balance) || 0;
            const dueGl = glRpcOk && r ? r.glArReceivable : 0;
            return { id: c.id, name: c.name || c.id, dueGl, dueOp };
          })
      );
      setCouriers(
        (courierList || []).map((c: any) => {
          const cid = (c as any).contact_id as string | null | undefined;
          const r = cid ? row(cid) : undefined;
          const dueOp = cid && operationalRpcOk && r ? r.opPayable : cid && !operationalRpcOk ? Number(c.current_balance) || 0 : 0;
          const dueGl = cid && glRpcOk && r ? r.glApPayable : 0;
          return { id: c.id, name: c.name || c.id, contact_id: cid ?? null, dueGl, dueOp };
        })
      );

      const workersSrc = workerList ?? (await studioService.getAllWorkers(companyId));
      setWorkers(
        (workersSrc || []).map((w: any) => {
          const r = row(w.id);
          const dueOp =
            operationalRpcOk && r ? r.opPayable : Number(w.pendingAmount ?? w.current_balance) || 0;
          const dueGl = glRpcOk && r ? r.glWorkerPayable : 0;
          return { id: w.id, name: w.name || w.id, dueGl, dueOp };
        })
      );

      setExpenseCategories(expCats || []);
      setPaymentAccountId((prev) => prev || (payList[0]?.id ?? ''));
      setFromAccountId((prev) => prev || payList[0]?.id || '');
      setToAccountId((prev) => prev || payList[1]?.id || payList[0]?.id || '');
      setDebitAccountId((prev) => prev || accList[0]?.id || '');
      setCreditAccountId((prev) => prev || accList[accList.length - 1]?.id || accList[0]?.id || '');
      setExpenseCategorySlug((prev) => prev || (expCats || [])[0]?.slug || '');
      if (!operationalRpcOk) {
        warnIfUsingStoredBalanceAsTruth(
          'AddEntryV2',
          'current_balance',
          'Open-doc column may use contact/worker cache when get_contact_balances_summary fails'
        );
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [companyId, branchId]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  useEffect(() => {
    initialPropsAppliedRef.current = false;
  }, [initialCustomerContactId, initialSupplierContactId, initialAmount]);

  useEffect(() => {
    if (loading || initialPropsAppliedRef.current) return;
    if (initialCustomerContactId) {
      const c = customers.find((x) => x.id === initialCustomerContactId);
      if (c) {
        setCustomerId(initialCustomerContactId);
        setCustomerName(c.name);
      }
    }
    if (initialSupplierContactId) {
      const s = suppliers.find((x) => x.id === initialSupplierContactId);
      if (s) {
        setSupplierContactId(initialSupplierContactId);
        setSupplierName(s.name);
      }
    }
    if (initialAmount != null && Number.isFinite(Number(initialAmount))) {
      setAmount(Math.max(0, Number(initialAmount)));
    }
    initialPropsAppliedRef.current = true;
  }, [loading, customers, suppliers, initialCustomerContactId, initialSupplierContactId, initialAmount]);

  const isExpenseSalary = expenseCategorySlug === 'salaries' || expenseCategorySlug === 'salary';
  useEffect(() => {
    if (!companyId || !isExpenseSalary) return;
    userService.getUsersForSalary(companyId).then((list) =>
      setSalaryUsers((list || []).map((u: any) => ({ id: u.id, full_name: u.full_name || u.email || 'Unknown' })))
    ).catch(() => setSalaryUsers([]));
  }, [companyId, isExpenseSalary]);

  const paymentAccounts = useMemo(() => paymentAccountsList.length > 0 ? paymentAccountsList.map((a) => ({ id: a.id, name: a.name })) : accounts.filter((a) => /cash|bank|wallet/.test((a.name || '').toLowerCase())), [paymentAccountsList, accounts]);

  /** COA balance from AccountingContext (journal merge) — same source as UnifiedPaymentDialog. */
  const glBalanceByAccountId = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounting.accounts || []) {
      m.set(a.id, Number((a as { balance?: number }).balance) || 0);
    }
    return m;
  }, [accounting.accounts]);

  /** Primary due: GL journal subledger when available (matches manual receipts/payments); else open-document RPC. */
  const selectedPartyDue = useMemo(() => {
    switch (entryType) {
      case 'customer_receipt': {
        const c = customers.find((x) => x.id === customerId);
        if (!c) return 0;
        return glBalancesOk ? c.dueGl : c.dueOp;
      }
      case 'supplier_payment': {
        const s = suppliers.find((x) => x.id === supplierContactId);
        if (!s) return 0;
        return glBalancesOk ? s.dueGl : s.dueOp;
      }
      case 'worker_payment': {
        const w = workers.find((x) => x.id === workerId);
        if (!w) return 0;
        return glBalancesOk ? w.dueGl : w.dueOp;
      }
      case 'courier_payment': {
        const c = couriers.find((x) => x.id === courierId);
        if (!c) return 0;
        return glBalancesOk ? c.dueGl : c.dueOp;
      }
      default:
        return null;
    }
  }, [entryType, customerId, customers, supplierContactId, suppliers, workerId, workers, courierId, couriers, glBalancesOk]);

  const selectedPartyLabel = useMemo(() => {
    switch (entryType) {
      case 'customer_receipt':
        return {
          entity: 'Customer',
          badge: 'CUSTOMER',
          dueLabel: glBalancesOk ? 'Due (GL — Accounts Receivable)' : 'Due (open invoices / opening)',
        };
      case 'supplier_payment':
        return {
          entity: 'Supplier',
          badge: 'SUPPLIER',
          dueLabel: glBalancesOk ? 'Due (GL — Accounts Payable)' : 'Due (open bills / opening)',
        };
      case 'worker_payment':
        return {
          entity: 'Worker',
          badge: 'WORKER',
          dueLabel: glBalancesOk ? 'Due (GL — worker payable / advance)' : 'Due (studio ledger / opening)',
        };
      case 'courier_payment':
        return {
          entity: 'Courier',
          badge: 'COURIER',
          dueLabel: glBalancesOk ? 'Due (GL — AP for linked contact)' : 'Due (open-doc AP)',
        };
      default:
        return null;
    }
  }, [entryType, glBalancesOk]);

  /** Prefill remarks when opening payment flows — only overwrites empty or prior auto-lines. */
  useEffect(() => {
    const isAutoOrEmpty = (d: string) => {
      const t = d.trim();
      if (!t) return true;
      return (
        t.startsWith('Worker payment to') ||
        t.startsWith('Customer receipt from') ||
        t.startsWith('Supplier payment to') ||
        t.startsWith('Courier payment to')
      );
    };
    setDescription((prev) => {
      if (!isAutoOrEmpty(prev)) return prev;
      if (entryType === 'worker_payment' && workerName.trim()) {
        return `Worker payment to ${workerName.trim()}.`;
      }
      if (entryType === 'customer_receipt' && customerName.trim()) {
        return `Customer receipt from ${customerName.trim()}.`;
      }
      if (entryType === 'supplier_payment' && supplierName.trim()) {
        return `Supplier payment to ${supplierName.trim()}.`;
      }
      if (entryType === 'courier_payment' && courierName.trim()) {
        return `Courier payment to ${courierName.trim()}.`;
      }
      return prev;
    });
  }, [entryType, workerName, customerName, supplierName, courierName]);

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
      let uploadedAttachments: { url: string; name: string }[] | undefined;
      if (entryAttachmentFiles.length > 0) {
        if (entryType === 'pure_journal' || entryType === 'internal_transfer') {
          const up = await uploadJournalEntryAttachments(companyId, entryAttachmentFiles);
          uploadedAttachments = up.length ? up : undefined;
        } else if (
          entryType === 'customer_receipt' ||
          entryType === 'supplier_payment' ||
          entryType === 'worker_payment' ||
          entryType === 'courier_payment'
        ) {
          const segment =
            entryType === 'customer_receipt'
              ? `manual-receipt/${customerId}`
              : entryType === 'supplier_payment'
                ? `manual-payment/${supplierContactId}`
                : entryType === 'worker_payment'
                  ? `worker-payment/${workerId}`
                  : `courier-payment/${courierId}`;
          const up = await uploadUnifiedStylePaymentAttachments(companyId, segment, entryAttachmentFiles);
          uploadedAttachments = up.length ? up : undefined;
        }
      }

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
            attachments: uploadedAttachments,
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
            attachments: uploadedAttachments,
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
            attachments: uploadedAttachments,
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
            attachments: uploadedAttachments,
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
            attachments: uploadedAttachments,
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
            attachments: uploadedAttachments,
          });
          toast.success('Courier payment saved');
          break;
        }
      }
      await accounting.refreshEntries?.();
      await loadFormData({ silent: true });
      dispatchContactBalancesRefresh(companyId);
      await Promise.resolve(onRecorded?.());
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    const empty = (
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
        <p className="text-gray-400">Select a company first.</p>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(empty, document.body) : null;
  }

  const inputClass =
    'w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors';
  const labelClass = 'block text-sm font-semibold text-gray-300 mb-2';
  const cardInnerClass = 'bg-gray-950/50 border border-gray-800 rounded-xl p-4';
  const currencyPrefix =
    settings.company?.currency === 'PKR' || !settings.company?.currency ? 'Rs.' : settings.company?.currency || currencySymbol;

  const modal = (
    <>
      {/* Shell matches UnifiedPaymentDialog; portaled to body so parent overflow-hidden (e.g. Accounting dashboard) does not clip. */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none overflow-y-auto">
        <div
          className="bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl shadow-black/40 w-full max-w-[700px] h-[850px] pointer-events-auto animate-in zoom-in-95 duration-200 my-6 max-h-[92vh] overflow-y-auto ring-1 ring-white/5"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
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
                        className={`text-left p-4 rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 shadow-sm ${
                          selected
                            ? 'border-blue-500 bg-gradient-to-br from-blue-500/15 to-gray-900/80 text-white ring-1 ring-blue-500/30'
                            : 'border-gray-700/80 bg-gray-800/40 text-gray-300 hover:border-gray-600 hover:bg-gray-800/70 hover:shadow-md'
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
                    onClick={() => {
                      setEntryAttachmentFiles([]);
                      setStep('select-type');
                    }}
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
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* LEFT — party / accounts / amount / method (UnifiedPaymentDialog style) */}
                      <div className="space-y-4">
                        {entryType === 'customer_receipt' && selectedPartyLabel && (
                          <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-400">{selectedPartyLabel.entity} details</span>
                              <Badge variant="outline" className="border-blue-500/40 text-blue-300 bg-blue-500/10">
                                {selectedPartyLabel.badge}
                              </Badge>
                            </div>
                            <Label className={labelClass}>{selectedPartyLabel.entity}</Label>
                            <div className="relative">
                              <select
                                value={customerId}
                                onChange={(e) => {
                                  const c = customers.find((x) => x.id === e.target.value);
                                  setCustomerId(e.target.value);
                                  setCustomerName(c?.name ?? '');
                                }}
                                className={`${inputClass} appearance-none pr-10`}
                              >
                                <option value="">Select customer</option>
                                {customers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                    {glBalancesOk && operationalBalancesOk
                                      ? ` — GL ${formatCurrency(c.dueGl)} · Doc ${formatCurrency(c.dueOp)}`
                                      : ` — Due: ${formatCurrency(glBalancesOk ? c.dueGl : c.dueOp)}`}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {customerId && (
                              <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                                <p className="text-lg font-bold text-white">{customerName}</p>
                                <div className="space-y-2 pt-2 border-t border-gray-800">
                                  {glBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (GL — Accounts Receivable)</span>
                                      <span className="text-xl font-bold text-amber-400 tabular-nums shrink-0">
                                        {formatCurrency(customers.find((x) => x.id === customerId)?.dueGl ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (open-doc — invoices / opening)</span>
                                      <span
                                        className={`text-xl font-bold tabular-nums shrink-0 ${glBalancesOk ? 'text-slate-300' : 'text-amber-400'}`}
                                      >
                                        {formatCurrency(customers.find((x) => x.id === customerId)?.dueOp ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {!glBalancesOk && !operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">{selectedPartyLabel.dueLabel}</span>
                                      <span className="text-xl font-bold text-amber-400 tabular-nums">{formatCurrency(selectedPartyDue ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {!glBalancesOk && (
                                  <p className="text-[10px] text-amber-500/90 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    GL party balances need <code className="text-amber-400/90">get_contact_party_gl_balances</code>; showing open-doc or fallback.
                                  </p>
                                )}
                                {!operationalBalancesOk && glBalancesOk && (
                                  <p className="text-[10px] text-slate-500 flex items-start gap-1">
                                    <Info size={12} className="mt-0.5 shrink-0" />
                                    Open-doc totals unavailable — compare to Contacts when RPC is restored.
                                  </p>
                                )}
                              </div>
                            )}
                            {customerId && (
                              <p className="mt-3 text-[10px] text-gray-500 leading-relaxed">
                                Open invoices are settled automatically in <span className="text-gray-400">oldest-first (FIFO)</span> order. Any unused amount stays as unapplied customer credit.
                              </p>
                            )}
                          </div>
                        )}

                        {entryType === 'supplier_payment' && selectedPartyLabel && (
                          <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-400">{selectedPartyLabel.entity} details</span>
                              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                                {selectedPartyLabel.badge}
                              </Badge>
                            </div>
                            <Label className={labelClass}>{selectedPartyLabel.entity}</Label>
                            <div className="relative">
                              <select
                                value={supplierContactId}
                                onChange={(e) => {
                                  const s = suppliers.find((x) => x.id === e.target.value);
                                  setSupplierContactId(e.target.value);
                                  setSupplierName(s?.name ?? '');
                                }}
                                className={`${inputClass} appearance-none pr-10`}
                              >
                                <option value="">Select supplier</option>
                                {suppliers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                    {glBalancesOk && operationalBalancesOk
                                      ? ` — GL ${formatCurrency(s.dueGl)} · Doc ${formatCurrency(s.dueOp)}`
                                      : ` — due: ${formatCurrency(glBalancesOk ? s.dueGl : s.dueOp)}`}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {supplierContactId && (
                              <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                                <p className="text-lg font-bold text-white">{supplierName}</p>
                                <div className="space-y-2 pt-2 border-t border-gray-800">
                                  {glBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (GL — Accounts Payable)</span>
                                      <span className="text-xl font-bold text-yellow-400 tabular-nums shrink-0">
                                        {formatCurrency(suppliers.find((x) => x.id === supplierContactId)?.dueGl ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (open-doc — bills / opening)</span>
                                      <span
                                        className={`text-xl font-bold tabular-nums shrink-0 ${glBalancesOk ? 'text-slate-300' : 'text-yellow-400'}`}
                                      >
                                        {formatCurrency(suppliers.find((x) => x.id === supplierContactId)?.dueOp ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {!glBalancesOk && !operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">{selectedPartyLabel.dueLabel}</span>
                                      <span className="text-xl font-bold text-yellow-400 tabular-nums">{formatCurrency(selectedPartyDue ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {!glBalancesOk && (
                                  <p className="text-[10px] text-amber-500/90 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    GL party balances need <code className="text-amber-400/90">get_contact_party_gl_balances</code>; showing open-doc or fallback.
                                  </p>
                                )}
                                {!operationalBalancesOk && glBalancesOk && (
                                  <p className="text-[10px] text-slate-500 flex items-start gap-1">
                                    <Info size={12} className="mt-0.5 shrink-0" />
                                    Open-doc totals unavailable — compare to Contacts when RPC is restored.
                                  </p>
                                )}
                                {amount > 0 && (selectedPartyDue ?? 0) > 0 && amount > (selectedPartyDue ?? 0) && (
                                  <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                                    <AlertCircle size={14} />
                                    <span>Amount exceeds recorded due — allowed if paying extra on account.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {entryType === 'worker_payment' && selectedPartyLabel && (
                          <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-400">{selectedPartyLabel.entity} details</span>
                              <Badge variant="outline" className="border-violet-500/40 text-violet-300 bg-violet-500/10">
                                {selectedPartyLabel.badge}
                              </Badge>
                            </div>
                            <Label className={labelClass}>Worker</Label>
                            <div className="relative">
                              <select
                                value={workerId}
                                onChange={(e) => {
                                  const w = workers.find((x) => x.id === e.target.value);
                                  setWorkerId(e.target.value);
                                  setWorkerName(w?.name ?? '');
                                }}
                                className={`${inputClass} appearance-none pr-10`}
                              >
                                <option value="">Select worker</option>
                                {workers.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                    {glBalancesOk && operationalBalancesOk
                                      ? ` — GL ${formatCurrency(w.dueGl)} · Doc ${formatCurrency(w.dueOp)}`
                                      : ` — due: ${formatCurrency(glBalancesOk ? w.dueGl : w.dueOp)}`}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {workerId && (
                              <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                                <p className="text-lg font-bold text-white">{workerName}</p>
                                <div className="space-y-2 pt-2 border-t border-gray-800">
                                  {glBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (GL — worker payable / advance)</span>
                                      <span className="text-xl font-bold text-yellow-400 tabular-nums shrink-0">
                                        {formatCurrency(workers.find((x) => x.id === workerId)?.dueGl ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (open-doc — studio / opening)</span>
                                      <span
                                        className={`text-xl font-bold tabular-nums shrink-0 ${glBalancesOk ? 'text-slate-300' : 'text-yellow-400'}`}
                                      >
                                        {formatCurrency(workers.find((x) => x.id === workerId)?.dueOp ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {!glBalancesOk && !operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">{selectedPartyLabel.dueLabel}</span>
                                      <span className="text-xl font-bold text-yellow-400 tabular-nums">{formatCurrency(selectedPartyDue ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {!glBalancesOk && (
                                  <p className="text-[10px] text-amber-500/90 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    GL worker balances need <code className="text-amber-400/90">get_contact_party_gl_balances</code>; showing studio ledger or fallback.
                                  </p>
                                )}
                                {!operationalBalancesOk && glBalancesOk && (
                                  <p className="text-[10px] text-slate-500 flex items-start gap-1">
                                    <Info size={12} className="mt-0.5 shrink-0" />
                                    Open-doc totals unavailable — compare to Contacts when RPC is restored.
                                  </p>
                                )}
                                {amount > 0 && (selectedPartyDue ?? 0) > 0 && amount > (selectedPartyDue ?? 0) && (
                                  <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                                    <AlertCircle size={14} />
                                    <span>Amount exceeds unpaid ledger total — allowed if intentional.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {entryType === 'courier_payment' && selectedPartyLabel && (
                          <div className="bg-gradient-to-br from-gray-950/80 to-gray-900/50 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-medium text-gray-400">{selectedPartyLabel.entity} details</span>
                              <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                                {selectedPartyLabel.badge}
                              </Badge>
                            </div>
                            <Label className={labelClass}>Courier</Label>
                            <div className="relative">
                              <select
                                value={courierId}
                                onChange={(e) => {
                                  const c = couriers.find((x) => x.id === e.target.value);
                                  setCourierId(e.target.value);
                                  setCourierName(c?.name ?? '');
                                }}
                                className={`${inputClass} appearance-none pr-10`}
                              >
                                <option value="">Select courier</option>
                                {couriers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                    {glBalancesOk && operationalBalancesOk
                                      ? ` — GL ${formatCurrency(c.dueGl)} · Doc ${formatCurrency(c.dueOp)}`
                                      : (glBalancesOk ? c.dueGl : c.dueOp) > 0
                                        ? ` — due: ${formatCurrency(glBalancesOk ? c.dueGl : c.dueOp)}`
                                        : ''}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {courierId && (
                              <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                                <p className="text-lg font-bold text-white">{courierName}</p>
                                <div className="space-y-2 pt-2 border-t border-gray-800">
                                  {glBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (GL — AP for linked contact)</span>
                                      <span className="text-xl font-bold text-yellow-400 tabular-nums shrink-0">
                                        {formatCurrency(couriers.find((x) => x.id === courierId)?.dueGl ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">Due (open-doc AP)</span>
                                      <span
                                        className={`text-xl font-bold tabular-nums shrink-0 ${glBalancesOk ? 'text-slate-300' : 'text-yellow-400'}`}
                                      >
                                        {formatCurrency(couriers.find((x) => x.id === courierId)?.dueOp ?? 0)}
                                      </span>
                                    </div>
                                  )}
                                  {!glBalancesOk && !operationalBalancesOk && (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs text-gray-400">{selectedPartyLabel.dueLabel}</span>
                                      <span className="text-xl font-bold text-yellow-400 tabular-nums">{formatCurrency(selectedPartyDue ?? 0)}</span>
                                    </div>
                                  )}
                                </div>
                                {!glBalancesOk && (
                                  <p className="text-[10px] text-amber-500/90 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    GL courier AP needs <code className="text-amber-400/90">get_contact_party_gl_balances</code> and linked contact.
                                  </p>
                                )}
                                {!operationalBalancesOk && glBalancesOk && (
                                  <p className="text-[10px] text-slate-500 flex items-start gap-1">
                                    <Info size={12} className="mt-0.5 shrink-0" />
                                    Open-doc AP unavailable — compare to Contacts when RPC is restored.
                                  </p>
                                )}
                                {!(couriers.find((c) => c.id === courierId)?.contact_id) && (selectedPartyDue ?? 0) === 0 && (
                                  <p className="text-[10px] text-gray-500">Link courier to supplier contact for AP due from summaries.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {entryType === 'pure_journal' && (
                          <div className={cardInnerClass}>
                            <Label className={labelClass}>Debit account</Label>
                            <div className="relative mb-4">
                              <select value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                                <option value="">Select</option>
                                {accounts.map((a) => {
                                  const bal = glBalanceByAccountId.get(a.id) ?? 0;
                                  return (
                                    <option key={a.id} value={a.id}>
                                      {a.name} • GL: {formatCurrency(bal)}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            <Label className={labelClass}>Credit account</Label>
                            <div className="relative">
                              <select value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                                <option value="">Select</option>
                                {accounts.map((a) => {
                                  const bal = glBalanceByAccountId.get(a.id) ?? 0;
                                  return (
                                    <option key={a.id} value={a.id}>
                                      {a.name} • GL: {formatCurrency(bal)}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {(debitAccountId || creditAccountId) && (
                              <div className="mt-3 space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs">
                                {debitAccountId && (
                                  <div className="flex justify-between gap-2 text-gray-400">
                                    <span>Debit (GL balance)</span>
                                    <span className="font-mono text-emerald-400 tabular-nums">
                                      {formatCurrency(glBalanceByAccountId.get(debitAccountId) ?? 0)}
                                    </span>
                                  </div>
                                )}
                                {creditAccountId && (
                                  <div className="flex justify-between gap-2 text-gray-400">
                                    <span>Credit (GL balance)</span>
                                    <span className="font-mono text-emerald-400 tabular-nums">
                                      {formatCurrency(glBalanceByAccountId.get(creditAccountId) ?? 0)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {entryType === 'internal_transfer' && (
                          <div className={cardInnerClass}>
                            <Label className={labelClass}>From account (Cr)</Label>
                            <div className="relative mb-4">
                              <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                                {paymentAccounts.map((a) => {
                                  const bal = glBalanceByAccountId.get(a.id) ?? 0;
                                  return (
                                    <option key={a.id} value={a.id}>
                                      {a.name} • GL: {formatCurrency(bal)}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            <Label className={labelClass}>To account (Dr)</Label>
                            <div className="relative">
                              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                                {paymentAccounts.map((a) => {
                                  const bal = glBalanceByAccountId.get(a.id) ?? 0;
                                  return (
                                    <option key={a.id} value={a.id}>
                                      {a.name} • GL: {formatCurrency(bal)}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {(fromAccountId || toAccountId) && (
                              <div className="mt-3 space-y-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs">
                                {fromAccountId && (
                                  <div className="flex justify-between gap-2 text-gray-400">
                                    <span>From — GL balance</span>
                                    <span className="font-mono text-emerald-400 tabular-nums">
                                      {formatCurrency(glBalanceByAccountId.get(fromAccountId) ?? 0)}
                                    </span>
                                  </div>
                                )}
                                {toAccountId && (
                                  <div className="flex justify-between gap-2 text-gray-400">
                                    <span>To — GL balance</span>
                                    <span className="font-mono text-emerald-400 tabular-nums">
                                      {formatCurrency(glBalanceByAccountId.get(toAccountId) ?? 0)}
                                    </span>
                                  </div>
                                )}
                                {fromAccountId && amount > 0 && amount > (glBalanceByAccountId.get(fromAccountId) ?? 0) && (
                                  <div className="flex items-center gap-2 text-orange-400 text-[11px] bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                                    <AlertCircle size={12} />
                                    <span>Transfer amount exceeds &quot;from&quot; account GL balance.</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {entryType === 'expense_payment' && (
                          <div className={cardInnerClass}>
                            <Label className={labelClass}>Expense category</Label>
                            <div className="relative mb-4">
                              <select value={expenseCategorySlug} onChange={(e) => setExpenseCategorySlug(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                                <option value="">Select category</option>
                                {expenseCategories.map((c) => (
                                  <option key={c.id} value={c.slug}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {isExpenseSalary && (
                              <>
                                <Label className={labelClass}>Employee / User</Label>
                                <div className="relative mb-4">
                                  <select
                                    value={expenseSalaryUserId}
                                    onChange={(e) => {
                                      const u = salaryUsers.find((x) => x.id === e.target.value);
                                      setExpenseSalaryUserId(e.target.value);
                                      setExpenseSalaryUserName(u?.full_name ?? '');
                                    }}
                                    className={`${inputClass} appearance-none pr-10`}
                                  >
                                    <option value="">Select employee</option>
                                    {salaryUsers.map((u) => (
                                      <option key={u.id} value={u.id}>
                                        {u.full_name}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div>
                                    <Label className={labelClass}>Bonus</Label>
                                    <Input type="number" min={0} step="0.01" value={expenseBonus || ''} onChange={(e) => setExpenseBonus(parseFloat(e.target.value) || 0)} className={inputClass} />
                                  </div>
                                  <div>
                                    <Label className={labelClass}>Deduction</Label>
                                    <Input type="number" min={0} step="0.01" value={expenseDeduction || ''} onChange={(e) => setExpenseDeduction(parseFloat(e.target.value) || 0)} className={inputClass} />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Amount — prominent like UnifiedPaymentDialog */}
                        <div className={cardInnerClass}>
                          <Label className={labelClass}>
                            Amount <span className="text-red-400">*</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-semibold">{currencyPrefix}</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={amount === 0 ? '' : amount}
                              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg pl-14 pr-4 py-3 text-white text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                          </div>
                          {entryType === 'customer_receipt' &&
                            customerId &&
                            amount > 0 &&
                            (selectedPartyDue ?? 0) > 0 &&
                            amount <= (selectedPartyDue ?? 0) && (
                              <div className="flex items-center justify-between mt-2 text-xs">
                                <span className="text-gray-400">Remaining receivable (after this)</span>
                                <span className="text-green-400 font-semibold">{formatCurrency(Math.max(0, (selectedPartyDue ?? 0) - amount))}</span>
                              </div>
                            )}
                        </div>

                        {(entryType === 'customer_receipt' ||
                          entryType === 'supplier_payment' ||
                          entryType === 'worker_payment' ||
                          entryType === 'expense_payment' ||
                          entryType === 'courier_payment') && (
                          <div className={cardInnerClass}>
                            <Label className={labelClass}>
                              Payment method <span className="text-red-400">*</span>
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['Cash', 'Bank', 'Mobile Wallet'] as const).map((m) => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setPaymentMethod(m)}
                                  className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 transition-all ${
                                    paymentMethod === m ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                                  }`}
                                >
                                  {m === 'Cash' && <Wallet size={18} className={paymentMethod === m ? 'text-blue-400' : 'text-gray-400'} />}
                                  {m === 'Bank' && <Building2 size={18} className={paymentMethod === m ? 'text-blue-400' : 'text-gray-400'} />}
                                  {m === 'Mobile Wallet' && <CreditCard size={18} className={paymentMethod === m ? 'text-blue-400' : 'text-gray-400'} />}
                                  <span className={`text-xs font-medium ${paymentMethod === m ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {m === 'Mobile Wallet' ? 'Wallet' : m}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {(entryType === 'customer_receipt' ||
                          entryType === 'supplier_payment' ||
                          entryType === 'worker_payment' ||
                          entryType === 'expense_payment' ||
                          entryType === 'courier_payment') && (
                          <div className={cardInnerClass}>
                            <Label className={labelClass}>
                              Payment account (Cr) <span className="text-red-400">*</span>
                            </Label>
                            <div className="relative">
                              <select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)} className={`${inputClass} appearance-none pr-10`}>
                                {paymentAccounts.map((a) => {
                                  const bal = glBalanceByAccountId.get(a.id) ?? 0;
                                  return (
                                    <option key={a.id} value={a.id}>
                                      {a.name} • GL: {formatCurrency(bal)}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                            </div>
                            {paymentAccountId &&
                              (() => {
                                const bal = glBalanceByAccountId.get(paymentAccountId) ?? 0;
                                const acc = accounting.accounts.find((x) => x.id === paymentAccountId);
                                if (!acc) return null;
                                if (amount > bal && amount > 0) {
                                  return (
                                    <div className="space-y-2 mt-3">
                                      <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/80 px-3 py-2">
                                        <span className="text-xs text-gray-400">Account balance (GL)</span>
                                        <span className="text-sm font-bold text-emerald-400 tabular-nums">{formatCurrency(bal)}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-orange-400 text-xs bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                                        <AlertCircle size={14} />
                                        <span>Payment amount exceeds this account&apos;s GL (journal) balance.</span>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="mt-3 space-y-2">
                                    <div className="text-xs text-gray-400">
                                      Selected: <span className="text-white font-medium">{acc.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                                      <span className="text-xs text-gray-400">Account balance (GL)</span>
                                      <span className="text-base font-bold text-emerald-400 tabular-nums">{formatCurrency(bal)}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                        )}
                      </div>

                      {/* RIGHT — date, notes, preview */}
                      <div className="space-y-4">
                        <div className={cardInnerClass}>
                          <Label className={labelClass}>
                            Entry date <span className="text-red-400">*</span>
                          </Label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                            <Input
                              type="date"
                              value={entryDate}
                              onChange={(e) => setEntryDate(e.target.value)}
                              className={`${inputClass} pl-10`}
                            />
                          </div>
                        </div>

                        {showEntryAttachments && (
                          <div className={cardInnerClass}>
                            <Label className={labelClass}>Attachments (Optional)</Label>
                            <label className="block cursor-pointer">
                              <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900/50 transition-all text-center">
                                <Upload className="mx-auto mb-2 text-gray-500" size={24} />
                                <p className="text-xs text-gray-400 mb-0.5">
                                  <span className="text-blue-400 font-medium">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-600">PDF, PNG, JPG up to 10MB</p>
                              </div>
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={(e) => {
                                  const list = e.target.files;
                                  if (!list?.length) return;
                                  setEntryAttachmentFiles((prev) => [...prev, ...Array.from(list)]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {entryAttachmentFiles.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {entryAttachmentFiles.map((file, index) => (
                                  <div
                                    key={`${file.name}-${index}`}
                                    className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg p-2"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <FileText className="text-blue-400 flex-shrink-0" size={16} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs text-white font-medium truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEntryAttachmentFiles((prev) => prev.filter((_, i) => i !== index))}
                                      className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                                      aria-label={`Remove ${file.name}`}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className={cardInnerClass}>
                          <Label className={labelClass}>Description / Notes</Label>
                          <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional remarks…"
                            rows={5}
                            className="w-full bg-gray-900 border-2 border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none min-h-[120px]"
                          />
                        </div>

                        <div className="bg-gradient-to-br from-blue-950/30 to-gray-900/50 border border-blue-900/30 rounded-xl p-4 flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-semibold text-white mb-1.5">Posting preview</p>
                            <ul className="text-gray-400 space-y-1 text-xs">
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                {preview.paymentRow ? 'Payments row (Roznamcha)' : 'No payments row'}
                              </li>
                              <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                Journal entry
                              </li>
                              {preview.ledgerSync && (
                                <li className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Sync → {preview.ledgerSync}
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-gray-800">
                      <div className="text-xs text-gray-400 min-w-0">
                        {entryAttachmentFiles.length > 0 ? (
                          <span className="flex items-center gap-1.5">
                            <FileText size={12} />
                            {entryAttachmentFiles.length} new file{entryAttachmentFiles.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <p className="text-gray-500 hidden sm:block">Esc to close · double-entry enforced in service layer</p>
                        )}
                      </div>
                      <div className="flex gap-3 ml-auto shrink-0">
                        <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 px-5" onClick={onClose} disabled={saving}>
                          Cancel
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-500 text-white min-w-[140px] font-semibold" onClick={handleSubmit} disabled={saving || !canSave}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                          Save entry
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
