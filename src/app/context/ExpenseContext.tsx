// ============================================
// 🎯 EXPENSE CONTEXT
// ============================================
// Manages expenses with auto-numbering and accounting integration

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
import { useSupabase } from '@/app/context/SupabaseContext';
import { expenseService, Expense as SupabaseExpense } from '@/app/services/expenseService';
import { getOrCreateLedger, addLedgerEntry } from '@/app/services/ledgerService';
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
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
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
        updateExpense: defaultError,
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
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();
  const { companyId, branchId, user } = useSupabase();

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
      payeeName: supabaseExpense.vendor_name || '',
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
    if (!companyId || !effectiveBranchId || !user) {
      throw new Error('Company ID, Branch ID, and User are required');
    }

    try {
      // Generate expense number for display (DB may not have expense_no column)
      const expenseNo = generateDocumentNumber('expense');
      
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
      if (options?.paidToUserId) (supabaseExpense as any).paid_to_user_id = options.paidToUserId;

      // Save to Supabase
      const result = await expenseService.createExpense(supabaseExpense);
      
      // Increment document number
      incrementNextNumber('expense');
      
      // Convert back to app format (use generated expenseNo if DB doesn't return expense_no)
      const newExpense = convertFromSupabaseExpense(result);
      if (!newExpense.expenseNo) (newExpense as { expenseNo: string }).expenseNo = expenseNo;
      
      // Update local state
      setExpenses(prev => [newExpense, ...prev]);

      // Salary = User only → post to User Ledger (Salary paid = DEBIT to user ledger)
      if (newExpense.status === 'paid' && options?.paidToUserId && companyId) {
        try {
          const ledger = await getOrCreateLedger(companyId, 'user', options.paidToUserId, newExpense.payeeName || undefined);
          if (ledger) {
            await addLedgerEntry({
              companyId,
              ledgerId: ledger.id,
              entryDate: newExpense.date,
              debit: newExpense.amount,
              credit: 0,
              source: 'expense',
              referenceNo: newExpense.expenseNo,
              referenceId: newExpense.id,
              remarks: newExpense.description || `Salary - ${newExpense.payeeName || 'User'}`,
            });
            window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'user', entityId: options.paidToUserId } }));
          }
        } catch (e) {
          console.warn('[ExpenseContext] User ledger entry failed:', e);
        }
      }

      // Auto-post to accounting if paid
      if (newExpense.status === 'paid') {
        accounting.recordExpense({
          expenseId: newExpense.id,
          expenseNo: newExpense.expenseNo,
          category: newExpense.category,
          amount: newExpense.amount,
          paymentMethod: newExpense.paymentMethod,
          payeeName: newExpense.payeeName,
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
  const updateExpense = async (id: string, updates: Partial<Expense>): Promise<void> => {
    try {
      // Convert updates to Supabase format
      const supabaseUpdates: any = {};
      if (updates.category !== undefined) supabaseUpdates.category = mapCategoryToSupabase(updates.category);
      if (updates.status !== undefined) supabaseUpdates.status = updates.status;
      if (updates.amount !== undefined) supabaseUpdates.amount = updates.amount;
      if (updates.description !== undefined) supabaseUpdates.description = updates.description;
      if (updates.paymentMethod !== undefined) supabaseUpdates.payment_method = updates.paymentMethod;
      if (updates.payeeName !== undefined) supabaseUpdates.vendor_name = updates.payeeName;
      if (updates.notes !== undefined) supabaseUpdates.notes = updates.notes;
      if (updates.approvedBy !== undefined) supabaseUpdates.approved_by = updates.approvedBy;
      if (updates.approvedDate !== undefined) supabaseUpdates.approved_at = updates.approvedDate;

      // Update in Supabase
      await expenseService.updateExpense(id, supabaseUpdates);
      
      // Update local state
      setExpenses(prev => prev.map(expense => 
        expense.id === id 
          ? { ...expense, ...updates, updatedAt: new Date().toISOString() }
          : expense
      ));
      
      toast.success('Expense updated successfully!');
    } catch (error: any) {
      console.error('[EXPENSE CONTEXT] Error updating expense:', error);
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
      await expenseService.deleteExpense(id);
      
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
      await updateExpense(id, { 
        status: 'paid',
        paymentMethod 
      });

      // Auto-post to accounting
      accounting.recordExpense({
        expenseId: expense.id,
        expenseNo: expense.expenseNo,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        paymentMethod: paymentMethod as any,
        date: new Date().toISOString(),
        payeeName: expense.payeeName,
      });

      toast.success(`${expense.expenseNo} marked as paid and posted to accounting!`);
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

  const value: ExpenseContextType = {
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
  };

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
};
