import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';
import { formatDate } from '../../../utils/dateFormat';
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
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [filters, setFilters] = useState<any>({});
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

  const handleDelete = (expense: Expense) => {
    if (confirm(`Are you sure you want to delete expense ${expense.referenceNo}?`)) {
      setExpenses(expenses.filter(e => e.id !== expense.id));
    }
  };

  const handleDuplicate = (expense: Expense) => {
    const newExpense: Expense = {
      ...expense,
      id: `EXP-${String(expenses.length + 1).padStart(3, '0')}`,
      referenceNo: `REF-2026-${String(expenses.length + 1).padStart(3, '0')}`,
      date: new Date(),
      status: 'pending',
    };
    setExpenses([newExpense, ...expenses]);
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
    <div className="p-6 min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Expenses Management
            </h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Track and manage all business expenses
            </p>
          </div>
          <Button 
            className="shadow-lg"
            style={{
              backgroundColor: 'var(--color-primary)',
              boxShadow: 'var(--shadow-blue-glow)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            }}
          >
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
      <div 
        className="mt-6 border rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead 
              className="border-b"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
            >
              <tr>
                {isColumnVisible('action') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Action
                  </th>
                )}
                {isColumnVisible('date') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Date
                  </th>
                )}
                {isColumnVisible('referenceNo') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Reference No</th>
                )}
                {isColumnVisible('recurringDetails') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Recurring</th>
                )}
                {isColumnVisible('expenseCategory') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Category</th>
                )}
                {isColumnVisible('subcategory') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Subcategory</th>
                )}
                {isColumnVisible('location') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Location</th>
                )}
                {isColumnVisible('payment') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Payment</th>
                )}
                {isColumnVisible('tax') && (
                  <th 
                    className="text-center p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Tax %</th>
                )}
                {isColumnVisible('status') && (
                  <th 
                    className="text-center p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Status</th>
                )}
                {isColumnVisible('totalAmount') && (
                  <th 
                    className="text-right p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Total Amount</th>
                )}
                {isColumnVisible('paymentDue') && (
                  <th 
                    className="text-center p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Payment Due</th>
                )}
                {isColumnVisible('expenseFor') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Expense For</th>
                )}
                {isColumnVisible('contact') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Contact</th>
                )}
                {isColumnVisible('expenseNote') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Note</th>
                )}
                {isColumnVisible('addedBy') && (
                  <th 
                    className="text-left p-4 font-semibold text-sm uppercase tracking-wide"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >Added By</th>
                )}
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <tr
                  key={expense.id}
                  className="border-b transition-colors"
                  style={{ borderBottomColor: 'var(--color-border-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)'; // hover:bg-gray-800/50
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {isColumnVisible('action') && (
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            style={{ color: 'var(--color-text-secondary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-text-primary)';
                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-text-secondary)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end"
                          style={{
                            backgroundColor: 'var(--color-bg-primary)',
                            borderColor: 'var(--color-border-primary)',
                            color: 'var(--color-text-primary)'
                          }}
                        >
                          <DropdownMenuItem
                            onClick={() => handleView(expense)}
                            className="cursor-pointer"
                            style={{ color: 'var(--color-text-primary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Eye size={14} className="mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(expense)}
                            className="cursor-pointer"
                            style={{ color: 'var(--color-text-primary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Edit size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(expense)}
                            className="cursor-pointer"
                            style={{ color: 'var(--color-text-primary)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Copy size={14} className="mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator 
                            style={{ backgroundColor: 'var(--color-border-primary)' }}
                          />
                          <DropdownMenuItem
                            onClick={() => handleDelete(expense)}
                            className="cursor-pointer"
                            style={{ color: 'var(--color-error)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; // hover:bg-red-900/20
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
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
                      <div 
                        className="flex items-center gap-2"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <Calendar 
                          size={14} 
                          style={{ color: 'var(--color-text-tertiary)' }}
                        />
                        {formatDate(expense.date)}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('referenceNo') && (
                    <td className="p-4">
                      <div 
                        className="font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {expense.referenceNo}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('recurringDetails') && (
                    <td className="p-4">
                      <Badge className={
                        expense.recurringDetails === 'Monthly' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                        expense.recurringDetails === 'Weekly' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                        {
                          backgroundColor: 'var(--color-hover-bg)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-border-secondary)'
                        }
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
                        <Tag 
                          size={14} 
                          style={{ color: 'var(--color-text-tertiary)' }}
                        />
                        <span style={{ color: 'var(--color-text-primary)' }}>
                          {expense.expenseCategory}
                        </span>
                      </div>
                    </td>
                  )}
                  {isColumnVisible('subcategory') && (
                    <td 
                      className="p-4 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >{expense.subcategory}</td>
                  )}
                  {isColumnVisible('location') && (
                    <td className="p-4">
                      <div 
                        className="flex items-center gap-2 text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <MapPin size={14} />
                        {expense.location}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('payment') && (
                    <td className="p-4">
                      <div 
                        className="flex items-center gap-2 text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <CreditCard 
                          size={14} 
                          style={{ color: 'var(--color-text-tertiary)' }}
                        />
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
                        <span 
                          className="text-sm"
                          style={{ color: 'var(--color-text-disabled)' }}
                        >
                          —
                        </span>
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
                      <div 
                        className="font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
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
                          {formatDate(expense.paymentDue)}
                        </div>
                      ) : (
                        <span 
                          className="text-sm"
                          style={{ color: 'var(--color-text-disabled)' }}
                        >
                          —
                        </span>
                      )}
                    </td>
                  )}
                  {isColumnVisible('expenseFor') && (
                    <td 
                      className="p-4 text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    >{expense.expenseFor}</td>
                  )}
                  {isColumnVisible('contact') && (
                    <td className="p-4">
                      <div 
                        className="flex items-center gap-2 text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <User size={14} />
                        {expense.contact}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('expenseNote') && (
                    <td className="p-4">
                      <div 
                        className="flex items-center gap-2 text-sm max-w-xs truncate"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <FileText size={14} />
                        {expense.expenseNote}
                      </div>
                    </td>
                  )}
                  {isColumnVisible('addedBy') && (
                    <td className="p-4">
                      <Badge 
                        style={{
                          backgroundColor: 'var(--color-hover-bg)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-border-secondary)'
                        }}
                      >
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
        <div 
          className="flex items-center justify-between p-4 border-t"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            backgroundColor: 'var(--color-bg-tertiary)'
          }}
        >
          <div 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Showing <span 
              className="font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              1
            </span> to{' '}
            <span 
              className="font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {expenses.length}
            </span> of{' '}
            <span 
              className="font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {expenses.length}
            </span> results
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled
              style={{
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-tertiary)'
              }}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              style={{
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-primary)',
                backgroundColor: 'var(--color-primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              }}
            >
              1
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled
              style={{
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-tertiary)'
              }}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
