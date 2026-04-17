// ============================================
// 🎯 EXPENSE CONTEXT
// ============================================
// Manages expenses with auto-numbering and accounting integration

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { documentNumberService } from '@/app/services/documentNumberService';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { expenseService, Expense as SupabaseExpense } from '@/app/services/expenseService';
import { accountingService } from '@/app/services/accountingService';
import { voidJournalEntries } from '@/app/services/accountingIntegrityService';
import {
  assertDomainEditSafetyTestMode,
  buildExpenseCanonicalComparisonRows,
  classifyPaidExpenseEdit,
  type ExpenseEditClassification,
  type PaidExpenseSnapshot,
} from '@/app/lib/accountingEditClassification';
import { normalizeNullableText } from '@/app/lib/expenseEditCanonical';
import { formatFieldChangeLines, logDocumentEditActivity } from '@/app/lib/documentEditActivityLog';
import {
  createExpenseEditTraceId,
  pushExpenseEditTrace,
} from '@/app/lib/expenseEditTrace';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
export type ExpenseCategory = 
  | 'Rent' 
  | 'Utilities' 
  | 'Salaries' 
  | 'Marketing' 
  | 'Travel' 
  | 'Office Supplies' 
  | 'Repairs & Maintenance'
  | 'Other';

export interface Expense {
  id: string;
  expenseNo: string;
  category: ExpenseCategory | string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  /** Chart payment account UUID when stored on the expense row */
  paymentAccountId?: string;
  payeeName: string;
  location: string;
  status: ExpenseStatus;
  submittedBy: string;
  approvedBy?: string;
  approvedDate?: string;
  receiptAttached: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseContextType {
  expenses: Expense[];
  loading: boolean;
  getExpenseById: (id: string) => Expense | undefined;
  createExpense: (expense: Omit<Expense, 'id' | 'expenseNo' | 'createdAt' | 'updatedAt'> & { category: ExpenseCategory | string }, options?: { branchId?: string; payment_account_id?: string; paidToUserId?: string }) => Promise<Expense>;
  updateExpense: (id: string, updates: Partial<Expense>, options?: { silent?: boolean }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  approveExpense: (id: string, approvedBy: string) => Promise<void>;
  rejectExpense: (id: string) => Promise<void>;
  markAsPaid: (id: string, paymentMethod: string) => Promise<void>;
  getExpensesByCategory: (category: ExpenseCategory) => Expense[];
  getExpensesByStatus: (status: ExpenseStatus) => Expense[];
  getTotalByCategory: (category: ExpenseCategory) => number;
  refreshExpenses: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    // During hot reload in development, context might not be available
    // During hot reload or initial mount, context might not be available; return safe default to prevent crashes
    if (import.meta.env.DEV) {
      const defaultError = () => { throw new Error('ExpenseProvider not available'); };
      return {
        expenses: [],
        loading: false,
        getExpenseById: () => undefined,
        createExpense: defaultError,
        updateExpense: async () => {
          defaultError();
        },
        deleteExpense: defaultError,
        recordPayment: defaultError,
        getExpensesByDateRange: () => [],
        getTotalByCategory: () => 0,
        refreshExpenses: async () => {},
      } as ExpenseContextType;
    }
    throw new Error('useExpenses must be used within ExpenseProvider');
  }
  return context;
};

// ============================================
// PROVIDER
// ============================================

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const accounting = useAccounting();
  const { companyId, branchId, user, requiresBranchSelection } = useSupabase();
  /** Serialize updates per expense so two saves cannot both reverse+repost the same JE. */
  const expenseUpdateChainRef = useRef<Map<string, Promise<unknown>>>(new Map());

  // Map category from app format to Supabase format (accepts slug string from expense_categories)
  const mapCategoryToSupabase = (category: ExpenseCategory | string): string => {
    if (typeof category === 'string' && /^[a-z0-9_]+$/.test(category)) return category;
    const mapping: Record<ExpenseCategory, string> = {
      'Rent': 'rent',
      'Utilities': 'utilities',
      'Salaries': 'salaries',
      'Marketing': 'marketing',
      'Travel': 'travel',
      'Office Supplies': 'office_supplies',
      'Repairs & Maintenance': 'repairs',
      'Other': 'miscellaneous',
    };
    return mapping[category as ExpenseCategory] || (typeof category === 'string' ? category.toLowerCase().replace(/\s+/g, '_') : 'miscellaneous');
  };

  // Map category from Supabase format to app format (slug, name, or display name)
  const mapCategoryFromSupabase = (category: string | null | undefined): ExpenseCategory | string => {
    const mapping: Record<string, ExpenseCategory> = {
      'rent': 'Rent', 'utilities': 'Utilities', 'salaries': 'Salaries', 'marketing': 'Marketing',
      'travel': 'Travel', 'office_supplies': 'Office Supplies', 'repairs': 'Repairs & Maintenance',
      'professional_fees': 'Other', 'insurance': 'Other', 'taxes': 'Other', 'miscellaneous': 'Other',
    };
    if (!category) return 'Other';
    const slug = category.toLowerCase().trim().replace(/\s+/g, '_');
    if (mapping[slug]) return mapping[slug];
    if (mapping[category]) return mapping[category];
    return category; // Already display name from expense_categories.name
  };

  // Convert Supabase expense format to app format
  const convertFromSupabaseExpense = useCallback((supabaseExpense: any): Expense => {
    const id = supabaseExpense.id || '';
    const expenseNo = supabaseExpense.expense_no || '';
    // Use expense_category join when category string is empty (expense_category_id used)
    const categoryRaw = supabaseExpense.category
      || supabaseExpense.expense_category?.name
      || supabaseExpense.expense_category?.slug;
    return {
      id,
      expenseNo,
      category: mapCategoryFromSupabase(categoryRaw),
      description: supabaseExpense.description || '',
      amount: supabaseExpense.amount || 0,
      date: supabaseExpense.expense_date || new Date().toISOString().split('T')[0],
      paymentMethod: supabaseExpense.payment_method || 'Cash',
      paymentAccountId: supabaseExpense.payment_account_id || undefined,
      payeeName:
        supabaseExpense.vendor_name ||
        supabaseExpense.supplier_name ||
        supabaseExpense.payee_name ||
        '',
      location: supabaseExpense.branch_id || '',
      status: supabaseExpense.status || 'draft',
      submittedBy: supabaseExpense.created_by_user?.full_name || supabaseExpense.created_by || '',
      approvedBy: supabaseExpense.approved_by_user?.full_name || supabaseExpense.approved_by,
      approvedDate: supabaseExpense.approved_at,
      receiptAttached: false, // TODO: Add receipt field to schema
      notes: supabaseExpense.notes,
      createdAt: supabaseExpense.created_at || new Date().toISOString(),
      updatedAt: supabaseExpense.updated_at || new Date().toISOString(),
    };
  }, []);

  // Load expenses from database
  const loadExpenses = useCallback(async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const data = await expenseService.getAllExpenses(companyId, branchId === 'all' ? undefined : branchId || undefined);
      setExpenses(data.map(convertFromSupabaseExpense));
    } catch (error) {
      console.error('[EXPENSE CONTEXT] Error loading expenses:', error);
      toast.error('Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, branchId, convertFromSupabaseExpense]);

  // Load expenses from Supabase on mount
  useEffect(() => {
    if (companyId) {
      loadExpenses();
    } else {
      setLoading(false);
    }
  }, [companyId, loadExpenses]);

  // Get expense by ID
  const getExpenseById = (id: string): Expense | undefined => {
    return expenses.find(e => e.id === id);
  };

  // Create new expense (options.branchId = override for drawer; options.payment_account_id = chart account id)
  const createExpense = async (
    expenseData: Omit<Expense, 'id' | 'expenseNo' | 'createdAt' | 'updatedAt'>,
    options?: { branchId?: string; payment_account_id?: string }
  ): Promise<Expense> => {
    const effectiveBranchId = options?.branchId ?? branchId;
    if (!companyId || !user) throw new Error('Company and user are required');
    if (!effectiveBranchId || effectiveBranchId === 'all') {
      if (requiresBranchSelection) throw new Error('Branch is required');
      throw new Error('No branch available. Please try again.');
    }

    try {
      // ERP Numbering Engine: atomic, duplicate-free
      const expenseNo = await documentNumberService.getNextDocumentNumber(companyId, effectiveBranchId, 'expense');

      // Convert to Supabase format (expense_no = EXP-0001 style from document numbering)
      const supabaseExpense: Partial<SupabaseExpense> = {
        company_id: companyId,
        branch_id: effectiveBranchId,
        expense_no: expenseNo,
        expense_date: expenseData.date,
        category: mapCategoryToSupabase(expenseData.category),
        description: expenseData.description,
        amount: expenseData.amount,
        payment_method: expenseData.paymentMethod,
        status: expenseData.status === 'paid' ? 'paid' : expenseData.status === 'approved' ? 'approved' : expenseData.status === 'rejected' ? 'rejected' : 'submitted',
        notes: expenseData.notes,
        created_by: user.id,
      };
      if (options?.payment_account_id) supabaseExpense.payment_account_id = options.payment_account_id;
      if (options?.paidToUserId) (supabaseExpense as any).paid_to_user_id = options.paidToUserId;
      if (expenseData.payeeName?.trim()) (supabaseExpense as any).vendor_name = expenseData.payeeName.trim();

      // Save to Supabase
      const result = await expenseService.createExpense(supabaseExpense);

      // Convert back to app format (use generated expenseNo if DB doesn't return expense_no)
      const newExpense = convertFromSupabaseExpense(result);
      if (!newExpense.expenseNo) (newExpense as { expenseNo: string }).expenseNo = expenseNo;
      
      // Update local state
      setExpenses(prev => [newExpense, ...prev]);

      if (newExpense.status === 'paid' && options?.paidToUserId && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'user', entityId: options.paidToUserId } }));
      }

      // Auto-post to accounting if paid
      if (newExpense.status === 'paid') {
        accounting.recordExpense({
          expenseId: newExpense.id,
          category: newExpense.category,
          amount: newExpense.amount,
          paymentMethod: newExpense.paymentMethod,
          date: newExpense.date,
          description: newExpense.description,
        });
      }

      toast.success(`Expense ${expenseNo} created successfully!`);
      
      return newExpense;
    } catch (error: any) {
      console.error('[EXPENSE CONTEXT] Error creating expense:', error);
      toast.error(`Failed to create expense: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Update expense
  const updateExpense = async (
    id: string,
    updates: Partial<Expense> & { paymentAccountId?: string },
    options?: { silent?: boolean }
  ): Promise<void> => {
    const prev = expenseUpdateChainRef.current.get(id) ?? Promise.resolve();
    const next = prev.then(() => updateExpenseBody(id, updates, options));
    expenseUpdateChainRef.current.set(id, next);
    try {
      await next;
    } finally {
      if (expenseUpdateChainRef.current.get(id) === next) {
        expenseUpdateChainRef.current.delete(id);
      }
    }
  };

  const updateExpenseBody = async (
    id: string,
    updates: Partial<Expense> & { paymentAccountId?: string },
    options?: { silent?: boolean }
  ): Promise<void> => {
    const traceId = createExpenseEditTraceId(id);
    try {
      const existing = getExpenseById(id);
      if (!existing) throw new Error('Expense not found');
      pushExpenseEditTrace({
        traceId,
        ts: new Date().toISOString(),
        expenseId: id,
        companyId: companyId || null,
        phase: 'start',
        data: {
          oldSnapshot: {
            status: existing.status,
            amount: existing.amount,
            category: existing.category,
            paymentMethod: existing.paymentMethod,
            paymentAccountId: existing.paymentAccountId || null,
            date: existing.date,
            location: existing.location,
            description: existing.description,
            notes: existing.notes || null,
            payeeName: existing.payeeName || null,
          },
          updates,
        },
      });

      const supabaseUpdates: Record<string, unknown> = {};
      if (updates.category !== undefined) supabaseUpdates.category = mapCategoryToSupabase(updates.category);
      if (updates.status !== undefined) supabaseUpdates.status = updates.status;
      if (updates.amount !== undefined) supabaseUpdates.amount = updates.amount;
      if (updates.description !== undefined) supabaseUpdates.description = updates.description;
      if (updates.paymentMethod !== undefined) supabaseUpdates.payment_method = updates.paymentMethod;
      if (updates.payeeName !== undefined) supabaseUpdates.vendor_name = updates.payeeName;
      if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
      if (updates.approvedBy !== undefined) supabaseUpdates.approved_by = updates.approvedBy;
      if (updates.approvedDate !== undefined) supabaseUpdates.approved_at = updates.approvedDate;
      if (updates.date !== undefined) supabaseUpdates.expense_date = updates.date;
      if (updates.location !== undefined) supabaseUpdates.branch_id = updates.location;
      const pAcc = updates.paymentAccountId;
      if (pAcc !== undefined) supabaseUpdates.payment_account_id = pAcc || null;

      const mergedPaymentMethod = updates.paymentMethod ?? existing.paymentMethod;
      const mergedAmount = updates.amount ?? existing.amount;
      const mergedCategory = updates.category ?? existing.category;
      const mergedDescription = updates.description ?? existing.description;
      const mergedDate = updates.date ?? existing.date;

      const existingSnap: PaidExpenseSnapshot = {
        status: existing.status,
        amount: Number(existing.amount) || 0,
        paymentMethod: existing.paymentMethod,
        date: existing.date,
        location: existing.location,
        paymentAccountId: existing.paymentAccountId,
        category: String(existing.category),
        description: existing.description || '',
        notes: existing.notes ?? null,
        payeeName: existing.payeeName ?? null,
      };

      const classification: ExpenseEditClassification = companyId
        ? classifyPaidExpenseEdit(existingSnap, updates, companyId)
        : {
            kind: 'NO_POSTING_CHANGE',
            reasons: ['no company context'],
            changedFields: [],
            postingChangedFields: [],
            headerOnlyChangedFields: [],
            nonPostingChangedFields: [],
            affectedDomains: [],
            domains: { header: false, accounting: false, inventory: false, payments: false },
            headerChangedFields: [],
            accountingChangedFields: [],
            inventoryChangedFields: [],
            actionPlan: {
              updateHeader: false,
              adjustAccounting: false,
              adjustInventory: false,
              touchPayments: false,
            },
            rollbackReversalOnRepostFailure: false,
          };
      assertDomainEditSafetyTestMode(classification, 'expense updateExpense');
      pushExpenseEditTrace({
        traceId,
        ts: new Date().toISOString(),
        expenseId: id,
        companyId: companyId || null,
        phase: 'classified',
        data: {
          classifier: classification.kind,
          affectedDomains: classification.affectedDomains,
          actionPlan: classification.actionPlan,
          reasons: classification.reasons,
          changedFields: classification.changedFields || [],
          postingChangedFields: classification.postingChangedFields || [],
          headerOnlyChangedFields: classification.headerOnlyChangedFields || [],
          nonPostingChangedFields: classification.nonPostingChangedFields || [],
          headerChangedFields: classification.headerChangedFields || [],
          accountingChangedFields: classification.accountingChangedFields || [],
          inventoryChangedFields: classification.inventoryChangedFields || [],
          canonicalComparison: buildExpenseCanonicalComparisonRows(existingSnap, updates),
        },
      });

      const hardBlockPosting = (op: 'reversal' | 'repost') => {
        if (classification.kind === 'FULL_REVERSE_REPOST' || classification.kind === 'DELTA_ADJUSTMENT') return;
        const stack = new Error(`[EXPENSE EDIT] blocked ${op} for ${classification.kind}`).stack;
        pushExpenseEditTrace({
          traceId,
          ts: new Date().toISOString(),
          expenseId: id,
          companyId: companyId || null,
          phase: 'error',
          data: {
            blockedOperation: op,
            classifier: classification.kind,
            stack,
          },
        });
        throw new Error(`Blocked ${op}: classifier=${classification.kind}. This edit is non-financial.`);
      };

      const persistExpenseRow = async () => {
        if (Object.keys(supabaseUpdates).length > 0) {
          pushExpenseEditTrace({
            traceId,
            ts: new Date().toISOString(),
            expenseId: id,
            companyId: companyId || null,
            phase: 'db_update',
            data: { supabaseUpdates },
          });
          await expenseService.updateExpense(id, supabaseUpdates as Partial<SupabaseExpense>);
        }
      };

      const logHeaderOnlyActivity = async () => {
        if (!companyId || !user?.id) return;
        const rows: Parameters<typeof formatFieldChangeLines>[0] = [];
        if (updates.date !== undefined && updates.date !== existing.date) {
          rows.push({
            field: 'expense_date',
            label: 'Expense date',
            oldValue: existing.date,
            newValue: updates.date,
          });
        }
        if (
          updates.notes !== undefined &&
          normalizeNullableText(updates.notes) !== normalizeNullableText(existing.notes)
        ) {
          rows.push({
            field: 'notes',
            label: 'Notes',
            oldValue: existing.notes ?? '',
            newValue: updates.notes ?? '',
          });
        }
        if (
          updates.description !== undefined &&
          String(updates.description ?? '').trim() !== String(existing.description ?? '').trim()
        ) {
          rows.push({
            field: 'description',
            label: 'Description',
            oldValue: existing.description,
            newValue: updates.description,
          });
        }
        if (
          updates.payeeName !== undefined &&
          normalizeNullableText(updates.payeeName) !== normalizeNullableText(existing.payeeName)
        ) {
          rows.push({
            field: 'payee',
            label: 'Payee',
            oldValue: existing.payeeName ?? '',
            newValue: updates.payeeName ?? '',
          });
        }
        const lines = formatFieldChangeLines(rows);
        if (lines.length === 0) return;
        await logDocumentEditActivity({
          companyId,
          module: 'expense',
          entityId: id,
          entityReference: existing.expenseNo,
          action: 'expense_header_edited',
          lines,
          performedBy: user.id,
        });
      };

      if (classification.kind === 'BLOCKED_CLOSED_PERIOD') {
        throw new Error('This expense date falls in a locked accounting period. Change the date or ask an admin.');
      }

      if (classification.kind === 'NO_POSTING_CHANGE') {
        await persistExpenseRow();
        await logHeaderOnlyActivity();
      } else if (classification.kind === 'HEADER_ONLY_CHANGE') {
        await persistExpenseRow();
        await logHeaderOnlyActivity();
        const presentation = classification.presentation || {};
        const patch = await accountingService.patchExpensePostingPresentation({
          companyId: companyId!,
          expenseId: id,
          entryDate: presentation.entryDate,
          journalDescription: presentation.journalDescription,
        });
        if (!patch.ok) {
          throw new Error(patch.error || 'Could not update expense journal header (no reversal was posted).');
        }
        pushExpenseEditTrace({
          traceId,
          ts: new Date().toISOString(),
          expenseId: id,
          companyId: companyId || null,
          phase: 'header_patch',
          data: {
            entryDate: presentation.entryDate || null,
            journalDescription: presentation.journalDescription || null,
          },
        });
      } else if (
        (classification.kind === 'FULL_REVERSE_REPOST' || classification.kind === 'DELTA_ADJUSTMENT') &&
        companyId
      ) {
        // In-place update: modify existing JE lines directly instead of reverse + repost
        const { data: jeRow } = await supabase
          .from('journal_entries')
          .select('id, description')
          .eq('company_id', companyId)
          .eq('reference_type', 'expense')
          .eq('reference_id', id)
          .or('is_void.is.null,is_void.eq.false')
          .not('reference_type', 'eq', 'correction_reversal')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        const jeId = (jeRow as { id?: string; description?: string } | null)?.id;
        if (jeId) {
          const newAmount = Number(mergedAmount) || 0;

          // Resolve correct GL expense account based on category
          const catLower = String(mergedCategory || '').toLowerCase();
          const catAccountMap: Record<string, string> = {
            salaries: '6110', salary: '6110', wages: '6110',
            marketing: '6120', advertising: '6120',
            rent: '6100', utilities: '6100', office: '6100',
            shipping: '5100', freight: '5100', courier: '5100',
            production: '5000', manufacturing: '5000',
          };
          const targetCode = catAccountMap[catLower] || '6100';
          const { data: targetAcct } = await supabase.from('accounts').select('id').eq('code', targetCode).eq('company_id', companyId).eq('is_active', true).maybeSingle();

          // Update debit lines: amount + correct account
          const debitUpdate: Record<string, any> = { debit: newAmount };
          if (targetAcct?.id) debitUpdate.account_id = targetAcct.id;
          await supabase
            .from('journal_entry_lines')
            .update(debitUpdate)
            .eq('journal_entry_id', jeId)
            .gt('debit', 0);
          // Update credit lines: amount only
          await supabase
            .from('journal_entry_lines')
            .update({ credit: newAmount })
            .eq('journal_entry_id', jeId)
            .gt('credit', 0);
          // Update description and log edit
          const ts = new Date().toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' });
          const oldDesc = (jeRow as any)?.description || '';
          const newDesc = mergedDescription || String(mergedCategory) || oldDesc;
          const editNote = `[Edited ${ts}: Rs ${Number(existing?.amount || 0).toLocaleString()} → Rs ${newAmount.toLocaleString()}]`;
          await supabase.from('journal_entries').update({
            description: `${newDesc} ${editNote}`.slice(0, 500),
            entry_date: mergedDate || undefined,
          }).eq('id', jeId);

          pushExpenseEditTrace({
            traceId,
            ts: new Date().toISOString(),
            expenseId: id,
            companyId: companyId || null,
            phase: 'inplace_update',
            data: { jeId, oldAmount: existing?.amount, newAmount, description: newDesc },
          });

          // Refresh
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
          }

        }
        await persistExpenseRow();
      } else {
        await persistExpenseRow();
      }

      setExpenses((prev) =>
        prev.map((expense) => {
          if (expense.id !== id) return expense;
          return {
            ...expense,
            ...updates,
            paymentAccountId:
              updates.paymentAccountId !== undefined ? updates.paymentAccountId : expense.paymentAccountId,
            category:
              updates.category !== undefined
                ? mapCategoryFromSupabase(mapCategoryToSupabase(updates.category))
                : expense.category,
            payeeName:
              updates.payeeName !== undefined ? updates.payeeName || '' : expense.payeeName,
            notes: updates.notes !== undefined ? updates.notes : expense.notes,
            description:
              updates.description !== undefined ? updates.description : expense.description,
            date: updates.date !== undefined ? updates.date : expense.date,
            amount: updates.amount !== undefined ? updates.amount : expense.amount,
            paymentMethod:
              updates.paymentMethod !== undefined ? updates.paymentMethod : expense.paymentMethod,
            location: updates.location !== undefined ? updates.location : expense.location,
            status: updates.status !== undefined ? updates.status : expense.status,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      if (!options?.silent) toast.success('Expense updated successfully!');
      void accounting.refreshEntries();
      pushExpenseEditTrace({
        traceId,
        ts: new Date().toISOString(),
        expenseId: id,
        companyId: companyId || null,
        phase: 'done',
        data: { classifier: classification.kind },
      });
    } catch (error: any) {
      console.error('[EXPENSE CONTEXT] Error updating expense:', error);
      pushExpenseEditTrace({
        traceId,
        ts: new Date().toISOString(),
        expenseId: id,
        companyId: companyId || null,
        phase: 'error',
        data: { message: error?.message || String(error) },
      });
      toast.error(`Failed to update expense: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Delete expense
  const deleteExpense = async (id: string): Promise<void> => {
    const expense = getExpenseById(id);
    if (!expense) {
      throw new Error('Expense not found');
    }

    try {
      // Delete from Supabase
      await expenseService.deleteExpense(id, companyId || undefined);
      
      // Update local state
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success(`${expense.expenseNo} deleted successfully!`);
    } catch (error: any) {
      console.error('[EXPENSE CONTEXT] Error deleting expense:', error);
      toast.error(`Failed to delete expense: ${error.message || 'Unknown error'}`);
      throw error;
    }
  };

  // Approve expense
  const approveExpense = async (id: string, approvedBy: string): Promise<void> => {
    const expense = getExpenseById(id);
    if (!expense) {
      throw new Error('Expense not found');
    }

    try {
      const now = new Date().toISOString();
      
      await updateExpense(id, {
        status: 'approved',
        approvedBy,
        approvedDate: now,
      });

      toast.success(`${expense.expenseNo} approved successfully!`);
    } catch (error) {
      throw error;
    }
  };

  // Reject expense
  const rejectExpense = async (id: string): Promise<void> => {
    const expense = getExpenseById(id);
    if (!expense) {
      throw new Error('Expense not found');
    }

    try {
      await updateExpense(id, { status: 'rejected' });
      toast.success(`${expense.expenseNo} rejected!`);
    } catch (error) {
      throw error;
    }
  };

  // Mark as paid
  const markAsPaid = async (id: string, paymentMethod: string): Promise<void> => {
    const expense = getExpenseById(id);
    if (!expense) {
      throw new Error('Expense not found');
    }

    try {
      await updateExpense(
        id,
        {
          status: 'paid',
          paymentMethod,
        },
        { silent: true }
      );

      const ok = await accounting.recordExpense({
        expenseId: expense.id,
        category: String(expense.category),
        description: expense.description,
        amount: expense.amount,
        paymentMethod: paymentMethod as any,
        date: expense.date,
      });

      if (!ok) {
        toast.error('Expense marked paid but accounting post failed. Check Chart of Accounts.');
      } else {
        toast.success(`${expense.expenseNo} marked as paid and posted to accounting!`);
      }
      void accounting.refreshEntries();
    } catch (error) {
      throw error;
    }
  };

  // Get expenses by category
  const getExpensesByCategory = (category: ExpenseCategory): Expense[] => {
    return expenses.filter(e => e.category === category);
  };

  // Get expenses by status
  const getExpensesByStatus = (status: ExpenseStatus): Expense[] => {
    return expenses.filter(e => e.status === status);
  };

  // Get total by category
  const getTotalByCategory = (category: ExpenseCategory): number => {
    return expenses
      .filter(e => e.category === category && e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const value = useMemo<ExpenseContextType>(() => ({
    expenses,
    loading,
    getExpenseById,
    createExpense,
    updateExpense,
    deleteExpense,
    approveExpense,
    rejectExpense,
    markAsPaid,
    getExpensesByCategory,
    getExpensesByStatus,
    getTotalByCategory,
    refreshExpenses: loadExpenses,
  }), [
    expenses, loading, getExpenseById, createExpense, updateExpense, deleteExpense,
    approveExpense, rejectExpense, markAsPaid, getExpensesByCategory,
    getExpensesByStatus, getTotalByCategory, loadExpenses,
  ]);

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
};
