// ============================================
// 🎯 EXPENSE CONTEXT
// ============================================
// Manages expenses with auto-numbering and accounting integration

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useDocumentNumbering } from '@/app/hooks/useDocumentNumbering';
import { useAccounting } from '@/app/context/AccountingContext';
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
  category: ExpenseCategory;
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
  getExpenseById: (id: string) => Expense | undefined;
  createExpense: (expense: Omit<Expense, 'id' | 'expenseNo' | 'createdAt' | 'updatedAt'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  approveExpense: (id: string, approvedBy: string) => void;
  rejectExpense: (id: string) => void;
  markAsPaid: (id: string, paymentMethod: string) => void;
  getExpensesByCategory: (category: ExpenseCategory) => Expense[];
  getExpensesByStatus: (status: ExpenseStatus) => Expense[];
  getTotalByCategory: (category: ExpenseCategory) => number;
}

// ============================================
// CONTEXT
// ============================================

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within ExpenseProvider');
  }
  return context;
};

// ============================================
// MOCK DATA (Initial)
// ============================================

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'expense-1',
    expenseNo: 'EXP-0001',
    category: 'Rent',
    description: 'Monthly shop rent - January 2024',
    amount: 50000,
    date: '2024-01-01',
    paymentMethod: 'Bank Transfer',
    payeeName: 'Property Owner',
    location: 'Main Branch (HQ)',
    status: 'paid',
    submittedBy: 'Admin User',
    approvedBy: 'Manager',
    approvedDate: '2024-01-01',
    receiptAttached: true,
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'expense-2',
    expenseNo: 'EXP-0002',
    category: 'Utilities',
    description: 'Electricity bill - December 2023',
    amount: 8500,
    date: '2024-01-05',
    paymentMethod: 'Cash',
    payeeName: 'WAPDA',
    location: 'Main Branch (HQ)',
    status: 'paid',
    submittedBy: 'Admin User',
    approvedBy: 'Manager',
    approvedDate: '2024-01-05',
    receiptAttached: true,
    createdAt: '2024-01-05T09:30:00Z',
    updatedAt: '2024-01-05T09:30:00Z',
  },
  {
    id: 'expense-3',
    expenseNo: 'EXP-0003',
    category: 'Marketing',
    description: 'Social media advertising - January campaign',
    amount: 15000,
    date: '2024-01-10',
    paymentMethod: 'Online Payment',
    payeeName: 'Facebook Ads',
    location: 'Head Office',
    status: 'submitted',
    submittedBy: 'Marketing Manager',
    receiptAttached: false,
    createdAt: '2024-01-10T11:00:00Z',
    updatedAt: '2024-01-10T11:00:00Z',
  },
];

// ============================================
// PROVIDER
// ============================================

export const ExpenseProvider = ({ children }: { children: ReactNode }) => {
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const { generateDocumentNumber, incrementNextNumber } = useDocumentNumbering();
  const accounting = useAccounting();

  // Get expense by ID
  const getExpenseById = (id: string): Expense | undefined => {
    return expenses.find(e => e.id === id);
  };

  // Create new expense
  const createExpense = (expenseData: Omit<Expense, 'id' | 'expenseNo' | 'createdAt' | 'updatedAt'>): Expense => {
    const now = new Date().toISOString();
    
    // Generate expense number
    const expenseNo = generateDocumentNumber('expense');
    
    const newExpense: Expense = {
      ...expenseData,
      id: `expense-${Date.now()}`,
      expenseNo,
      createdAt: now,
      updatedAt: now,
    };

    setExpenses(prev => [newExpense, ...prev]);
    
    // Increment document number
    incrementNextNumber('expense');

    toast.success(`Expense ${expenseNo} created successfully!`);
    
    return newExpense;
  };

  // Update expense
  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(prev => prev.map(expense => 
      expense.id === id 
        ? { ...expense, ...updates, updatedAt: new Date().toISOString() }
        : expense
    ));
    
    toast.success('Expense updated successfully!');
  };

  // Delete expense
  const deleteExpense = (id: string) => {
    const expense = getExpenseById(id);
    if (expense) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success(`${expense.expenseNo} deleted successfully!`);
    }
  };

  // Approve expense
  const approveExpense = (id: string, approvedBy: string) => {
    const expense = getExpenseById(id);
    if (!expense) return;

    const now = new Date().toISOString();
    
    updateExpense(id, {
      status: 'approved',
      approvedBy,
      approvedDate: now,
    });

    toast.success(`${expense.expenseNo} approved successfully!`);
  };

  // Reject expense
  const rejectExpense = (id: string) => {
    const expense = getExpenseById(id);
    if (!expense) return;

    updateExpense(id, { status: 'rejected' });
    toast.success(`${expense.expenseNo} rejected!`);
  };

  // Mark as paid
  const markAsPaid = (id: string, paymentMethod: string) => {
    const expense = getExpenseById(id);
    if (!expense) return;

    updateExpense(id, { 
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
  };

  return (
    <ExpenseContext.Provider value={value}>
      {children}
    </ExpenseContext.Provider>
  );
};
