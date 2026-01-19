import React, { useState, useMemo } from 'react';
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy,
  FileText,
  Plus,
  DollarSign,
  Calendar,
  MapPin,
  Tag,
  User,
  AlertCircle,
  CreditCard,
  Repeat,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AdvancedTableFilters } from "../ui/AdvancedTableFilters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useExpenses, type Expense as ExpenseContextExpense } from '../../context/ExpenseContext';

interface Expense {
  id: string;
  date: Date;
  referenceNo: string;
  recurringDetails: string;
  expenseCategory: string;
  subcategory: string;
  location: string;
  paymentMethod: string;
  tax: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  totalAmount: number;
  paymentDue: Date | null;
  expenseFor: string;
  contact: string;
  expenseNote: string;
  addedBy: string;
}

const mockExpenses: Expense[] = [
  {
    id: 'EXP-001',
    date: new Date('2026-01-15'),
    referenceNo: 'REF-2026-001',
    recurringDetails: 'Monthly',
    expenseCategory: 'Rent',
    subcategory: 'Office Rent',
    location: 'Main Branch',
    paymentMethod: 'Bank Transfer',
    tax: 0,
    status: 'paid',
    totalAmount: 50000,
    paymentDue: null,
    expenseFor: 'Office Space',
    contact: 'Landlord - Ahmed Ali',
    expenseNote: 'January 2026 office rent payment',
    addedBy: 'Admin'
  },
  {
    id: 'EXP-002',
    date: new Date('2026-01-14'),
    referenceNo: 'REF-2026-002',
    recurringDetails: 'One-time',
    expenseCategory: 'Utilities',
    subcategory: 'Electricity',
    location: 'Warehouse',
    paymentMethod: 'Cash',
    tax: 17,
    status: 'approved',
    totalAmount: 12500,
    paymentDue: new Date('2026-01-20'),
    expenseFor: 'Electricity Bill',
    contact: 'LESCO',
    expenseNote: 'December 2025 electricity consumption',
    addedBy: 'Manager'
  },
  {
    id: 'EXP-003',
    date: new Date('2026-01-13'),
    referenceNo: 'REF-2026-003',
    recurringDetails: 'Weekly',
    expenseCategory: 'Salaries',
    subcategory: 'Staff Wages',
    location: 'Main Branch',
    paymentMethod: 'Bank Transfer',
    tax: 0,
    status: 'pending',
    totalAmount: 85000,
    paymentDue: new Date('2026-01-18'),
    expenseFor: 'Weekly Staff Wages',
    contact: 'Multiple Employees',
    expenseNote: 'Week 2 - January 2026 staff payments',
    addedBy: 'HR Manager'
  },
  {
    id: 'EXP-004',
    date: new Date('2026-01-12'),
    referenceNo: 'REF-2026-004',
    recurringDetails: 'One-time',
    expenseCategory: 'Maintenance',
    subcategory: 'Equipment Repair',
    location: 'Production Unit',
    paymentMethod: 'Cash',
    tax: 0,
    status: 'paid',
    totalAmount: 8500,
    paymentDue: null,
    expenseFor: 'Sewing Machine Repair',
    contact: 'Hassan Mechanics',
    expenseNote: 'Emergency repair of 3 industrial machines',
    addedBy: 'Production Manager'
  },
  {
    id: 'EXP-005',
    date: new Date('2026-01-11'),
    referenceNo: 'REF-2026-005',
    recurringDetails: 'Monthly',
    expenseCategory: 'Marketing',
    subcategory: 'Social Media Ads',
    location: 'Head Office',
    paymentMethod: 'Credit Card',
    tax: 0,
    status: 'approved',
    totalAmount: 15000,
    paymentDue: new Date('2026-01-25'),
    expenseFor: 'Facebook & Instagram Campaigns',
    contact: 'Meta Business',
    expenseNote: 'Bridal collection promotion - January',
    addedBy: 'Marketing Head'
  },
  {
    id: 'EXP-006',
    date: new Date('2026-01-10'),
    referenceNo: 'REF-2026-006',
    recurringDetails: 'One-time',
    expenseCategory: 'Transportation',
    subcategory: 'Delivery Charges',
    location: 'Multiple',
    paymentMethod: 'Cash',
    tax: 0,
    status: 'rejected',
    totalAmount: 3500,
    paymentDue: null,
    expenseFor: 'Customer Deliveries',
    contact: 'TCS Courier',
    expenseNote: 'Bulk order deliveries - Rejected due to overcharging',
    addedBy: 'Logistics'
  },
];

export const ExpensesList = () => {
  const { expenses: contextExpenses, loading, deleteExpense, refreshExpenses, createExpense } = useExpenses();
  const [filters, setFilters] = useState<any>({});

  // Convert ExpenseContext format to ExpensesList format
  const expenses = useMemo(() => {
    return contextExpenses.map((exp: ExpenseContextExpense) => ({
      id: exp.id,
      date: new Date(exp.date),
      referenceNo: exp.expenseNo,
      recurringDetails: 'One-time', // TODO: Add recurring support
      expenseCategory: exp.category,
      subcategory: exp.category, // Use category as subcategory for now
      location: exp.location,
      paymentMethod: exp.paymentMethod,
      tax: 0, // TODO: Add tax support
      status: exp.status as 'pending' | 'approved' | 'paid' | 'rejected',
      totalAmount: exp.amount,
      paymentDue: exp.status === 'approved' ? new Date() : null,
      expenseFor: exp.description,
      contact: exp.payeeName,
      expenseNote: exp.notes || '',
      addedBy: exp.submittedBy,
    }));
  }, [contextExpenses]);
  const [columnVisibility, setColumnVisibility] = useState([
    { key: 'action', label: 'Action', visible: true },
    { key: 'date', label: 'Date', visible: true },
    { key: 'referenceNo', label: 'Reference No', visible: true },
    { key: 'recurringDetails', label: 'Recurring', visible: true },
    { key: 'expenseCategory', label: 'Category', visible: true },
    { key: 'subcategory', label: 'Subcategory', visible: true },
    { key: 'location', label: 'Location', visible: true },
    { key: 'payment', label: 'Payment Method', visible: true },
    { key: 'tax', label: 'Tax %', visible: true },
    { key: 'status', label: 'Status', visible: true },
    { key: 'totalAmount', label: 'Total Amount', visible: true },
    { key: 'paymentDue', label: 'Payment Due', visible: true },
    { key: 'expenseFor', label: 'Expense For', visible: true },
    { key: 'contact', label: 'Contact', visible: true },
    { key: 'expenseNote', label: 'Note', visible: false },
    { key: 'addedBy', label: 'Added By', visible: true },
  ]);

  const filterConfigs = [
    {
      label: 'Date Range',
      key: 'dateRange',
      type: 'daterange' as const,
    },
    {
      label: 'Status',
      key: 'status',
      type: 'select' as const,
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'paid', label: 'Paid' },
        { value: 'rejected', label: 'Rejected' },
      ],
    },
    {
      label: 'Category',
      key: 'category',
      type: 'select' as const,
      options: [
        { value: 'rent', label: 'Rent' },
        { value: 'utilities', label: 'Utilities' },
        { value: 'salaries', label: 'Salaries' },
        { value: 'maintenance', label: 'Maintenance' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'transportation', label: 'Transportation' },
      ],
    },
    {
      label: 'Location',
      key: 'location',
      type: 'select' as const,
      options: [
        { value: 'main', label: 'Main Branch' },
        { value: 'warehouse', label: 'Warehouse' },
        { value: 'production', label: 'Production Unit' },
        { value: 'head_office', label: 'Head Office' },
      ],
    },
  ];

  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    console.log(`Exporting expenses as ${type}`);
    // Implementation for export
  };

  const handlePrint = () => {
    window.print();
  };

  const handleView = (expense: Expense) => {
    console.log('View expense:', expense);
  };

  const handleEdit = (expense: Expense) => {
    console.log('Edit expense:', expense);
  };

  const handleDelete = async (expense: Expense) => {
    if (confirm(`Are you sure you want to delete expense ${expense.referenceNo}?`)) {
      try {
        await deleteExpense(expense.id);
        await refreshExpenses();
      } catch (error: any) {
        console.error('[EXPENSES LIST] Error deleting expense:', error);
        alert('Failed to delete expense: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDuplicate = async (expense: Expense) => {
    try {
      // Find the original expense in context
      const originalExpense = contextExpenses.find(e => e.id === expense.id);
      if (!originalExpense) return;

      // Create duplicate using ExpenseContext
      await createExpense({
        category: originalExpense.category,
        description: originalExpense.description,
        amount: originalExpense.amount,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: originalExpense.paymentMethod,
        payeeName: originalExpense.payeeName,
        location: originalExpense.location,
        status: 'pending' as any,
        submittedBy: originalExpense.submittedBy,
        receiptAttached: false,
        notes: originalExpense.notes,
      });
      await refreshExpenses();
    } catch (error: any) {
      console.error('[EXPENSES LIST] Error duplicating expense:', error);
      alert('Failed to duplicate expense: ' + (error.message || 'Unknown error'));
    }
  };

  const getStatusBadge = (status: Expense['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock size={12} className="mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><CheckCircle2 size={12} className="mr-1" />Approved</Badge>;
      case 'paid':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 size={12} className="mr-1" />Paid</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle size={12} className="mr-1" />Rejected</Badge>;
    }
  };

  const isColumnVisible = (key: string) => {
    return columnVisibility.find(col => col.key === key)?.visible ?? true;
  };

  return (
    <div className="p-6 bg-[#111827] min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Expenses Management</h1>
            <p className="text-gray-400">Track and manage all business expenses</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20">
            <Plus className="mr-2 h-4 w-4" />
            Add New Expense
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdvancedTableFilters
        filters={filterConfigs}
        columns={columnVisibility}
        onFilterChange={setFilters}
        onColumnVisibilityChange={setColumnVisibility}
        onExport={handleExport}
        onPrint={handlePrint}
        showEntriesOptions={[10, 25, 50, 100]}
        defaultEntries={50}
      />

      {/* Expenses Table */}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-950 border-b border-gray-800">
              <tr>
                {isColumnVisible('action') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Action</th>
                )}
                {isColumnVisible('date') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Date</th>
                )}
                {isColumnVisible('referenceNo') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Reference No</th>
                )}
                {isColumnVisible('recurringDetails') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Recurring</th>
                )}
                {isColumnVisible('expenseCategory') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Category</th>
                )}
                {isColumnVisible('subcategory') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Subcategory</th>
                )}
                {isColumnVisible('location') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Location</th>
                )}
                {isColumnVisible('payment') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Payment</th>
                )}
                {isColumnVisible('tax') && (
                  <th className="text-center p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Tax %</th>
                )}
                {isColumnVisible('status') && (
                  <th className="text-center p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Status</th>
                )}
                {isColumnVisible('totalAmount') && (
                  <th className="text-right p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Total Amount</th>
                )}
                {isColumnVisible('paymentDue') && (
                  <th className="text-center p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Payment Due</th>
                )}
                {isColumnVisible('expenseFor') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Expense For</th>
                )}
                {isColumnVisible('contact') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Contact</th>
                )}
                {isColumnVisible('expenseNote') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Note</th>
                )}
                {isColumnVisible('addedBy') && (
                  <th className="text-left p-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">Added By</th>
                )}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <tr
                  key={expense.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  {isColumnVisible('action') && (
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white">
                          <DropdownMenuItem
                            onClick={() => handleView(expense)}
                            className="hover:bg-gray-800 cursor-pointer"
                          >
                            <Eye size={14} className="mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(expense)}
                            className="hover:bg-gray-800 cursor-pointer"
                          >
                            <Edit size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(expense)}
                            className="hover:bg-gray-800 cursor-pointer"
                          >
                            <Copy size={14} className="mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-800" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(expense)}
                            className="hover:bg-red-900/20 text-red-400 cursor-pointer"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                  {isColumnVisible('date') && (
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Calendar size={14} className="text-gray-500" />
                        {expense.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('referenceNo') && (
                    <td className="p-4">
                      <div className="font-medium text-white">{expense.referenceNo}</div>
                    </td>
                  )}
                  {isColumnVisible('recurringDetails') && (
                    <td className="p-4">
                      <Badge className={
                        expense.recurringDetails === 'Monthly' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                        expense.recurringDetails === 'Weekly' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        'bg-gray-700 text-gray-300 border-gray-600'
                      }>
                        {expense.recurringDetails === 'One-time' ? (
                          <AlertCircle size={12} className="mr-1" />
                        ) : (
                          <Repeat size={12} className="mr-1" />
                        )}
                        {expense.recurringDetails}
                      </Badge>
                    </td>
                  )}
                  {isColumnVisible('expenseCategory') && (
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-gray-500" />
                        <span className="text-gray-300">{expense.expenseCategory}</span>
                      </div>
                    </td>
                  )}
                  {isColumnVisible('subcategory') && (
                    <td className="p-4 text-gray-400 text-sm">{expense.subcategory}</td>
                  )}
                  {isColumnVisible('location') && (
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <MapPin size={14} />
                        {expense.location}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('payment') && (
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <CreditCard size={14} className="text-gray-500" />
                        {expense.paymentMethod}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('tax') && (
                    <td className="p-4 text-center">
                      {expense.tax > 0 ? (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                          {expense.tax}%
                        </Badge>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                  )}
                  {isColumnVisible('status') && (
                    <td className="p-4 text-center">
                      {getStatusBadge(expense.status)}
                    </td>
                  )}
                  {isColumnVisible('totalAmount') && (
                    <td className="p-4 text-right">
                      <div className="font-semibold text-white">
                        ₨{expense.totalAmount.toLocaleString()}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('paymentDue') && (
                    <td className="p-4 text-center">
                      {expense.paymentDue ? (
                        <div className={`text-sm ${
                          new Date() > expense.paymentDue
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }`}>
                          {expense.paymentDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                  )}
                  {isColumnVisible('expenseFor') && (
                    <td className="p-4 text-gray-300 text-sm">{expense.expenseFor}</td>
                  )}
                  {isColumnVisible('contact') && (
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <User size={14} />
                        {expense.contact}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('expenseNote') && (
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-400 text-sm max-w-xs truncate">
                        <FileText size={14} />
                        {expense.expenseNote}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('addedBy') && (
                    <td className="p-4">
                      <Badge className="bg-gray-700 text-gray-300 border-gray-600">
                        {expense.addedBy}
                      </Badge>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800 bg-gray-950">
          <div className="text-sm text-gray-400">
            Showing <span className="font-medium text-white">1</span> to{' '}
            <span className="font-medium text-white">{expenses.length}</span> of{' '}
            <span className="font-medium text-white">{expenses.length}</span> results
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled className="border-gray-800 text-gray-500">
              Previous
            </Button>
            <Button variant="outline" size="sm" className="border-gray-800 text-white bg-blue-600 hover:bg-blue-500">
              1
            </Button>
            <Button variant="outline" size="sm" disabled className="border-gray-800 text-gray-500">
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
