import React from 'react';
import { Plus, ShoppingCart, DollarSign, TrendingUp, Calendar, MoreVertical, Eye, Edit, Trash2, FileText, Phone, MapPin, Package, Truck } from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { useNavigation } from '../../context/NavigationContext';
import { AdvancedTableFilters } from '../ui/AdvancedTableFilters';
import { formatDate } from '../../../utils/dateFormat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const mockSales = [
  { 
    id: 1, 
    invoiceNo: 'INV-001', 
    customer: 'Ahmed Retailers',
    customerName: 'Ahmed Ali', 
    contactNumber: '+92-300-1234567',
    date: '2024-01-15', 
    location: 'Main Branch',
    items: 12, 
    subtotal: 45000, 
    expenses: 500, 
    total: 45500, 
    paid: 45500, 
    due: 0,
    returnDue: 0,
    paymentStatus: 'Paid',
    paymentMethod: 'Cash',
    shippingStatus: 'Delivered'
  },
  { 
    id: 2, 
    invoiceNo: 'INV-002', 
    customer: 'Walk-in Customer',
    customerName: 'Sara Khan',
    contactNumber: '+92-321-9876543',
    date: '2024-01-15', 
    location: 'Branch 2',
    items: 3, 
    subtotal: 8000, 
    expenses: 200, 
    total: 8200, 
    paid: 5000, 
    due: 3200,
    returnDue: 0,
    paymentStatus: 'Partial',
    paymentMethod: 'Card',
    shippingStatus: 'Pending'
  },
  { 
    id: 3, 
    invoiceNo: 'INV-003', 
    customer: 'Local Store',
    customerName: 'Bilal Ahmed',
    contactNumber: '+92-333-5555555',
    date: '2024-01-14', 
    location: 'Main Branch',
    items: 24, 
    subtotal: 98000, 
    expenses: 1200, 
    total: 99200, 
    paid: 0, 
    due: 99200,
    returnDue: 500,
    paymentStatus: 'Unpaid',
    paymentMethod: 'Credit',
    shippingStatus: 'Processing'
  },
  { 
    id: 4, 
    invoiceNo: 'INV-004', 
    customer: 'Ahmed Retailers',
    customerName: 'Usman Malik',
    contactNumber: '+92-345-7777777',
    date: '2024-01-14', 
    location: 'Branch 2',
    items: 8, 
    subtotal: 32000, 
    expenses: 800, 
    total: 32800, 
    paid: 32800, 
    due: 0,
    returnDue: 0,
    paymentStatus: 'Paid',
    paymentMethod: 'Bank Transfer',
    shippingStatus: 'Delivered'
  },
];

export const SalesDashboard = () => {
  const { openDrawer } = useNavigation();

  const todaySales = mockSales.filter(s => s.date === '2024-01-15').reduce((acc, s) => acc + s.total, 0);
  const monthlySales = mockSales.reduce((acc, s) => acc + s.total, 0);
  const profit = mockSales.reduce((acc, s) => acc + (s.total * 0.25), 0); // Mock 25% profit

  // Filter Configuration
  const filterConfig = [
    {
      label: 'Business Location',
      key: 'location',
      type: 'select' as const,
      options: [
        { value: 'main', label: 'Main Branch' },
        { value: 'branch2', label: 'Branch 2' },
        { value: 'warehouse', label: 'Warehouse' },
      ]
    },
    {
      label: 'Customer',
      key: 'customer',
      type: 'select' as const,
      options: [
        { value: 'ahmed', label: 'Ahmed Retailers' },
        { value: 'local', label: 'Local Store' },
        { value: 'walkin', label: 'Walk-in Customer' },
      ]
    },
    {
      label: 'Payment Status',
      key: 'paymentStatus',
      type: 'select' as const,
      options: [
        { value: 'paid', label: 'Paid' },
        { value: 'partial', label: 'Partial' },
        { value: 'unpaid', label: 'Unpaid' },
      ]
    },
    {
      label: 'Date Range',
      key: 'dateRange',
      type: 'daterange' as const,
    },
    {
      label: 'User',
      key: 'user',
      type: 'select' as const,
      options: [
        { value: 'admin', label: 'Admin User' },
        { value: 'sales1', label: 'Salesman 1' },
        { value: 'sales2', label: 'Salesman 2' },
      ]
    },
    {
      label: 'Sales Commission Agent',
      key: 'agent',
      type: 'select' as const,
      options: [
        { value: 'agent1', label: 'Agent 1' },
        { value: 'agent2', label: 'Agent 2' },
      ]
    },
    {
      label: 'Shipping Status',
      key: 'shippingStatus',
      type: 'select' as const,
      options: [
        { value: 'delivered', label: 'Delivered' },
        { value: 'processing', label: 'Processing' },
        { value: 'pending', label: 'Pending' },
      ]
    },
    {
      label: 'Payment Method',
      key: 'paymentMethod',
      type: 'select' as const,
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'credit', label: 'Credit' },
      ]
    },
  ];

  // Column Configuration
  const columnConfig = [
    { key: 'date', label: 'Date', visible: true },
    { key: 'invoiceNo', label: 'Invoice No.', visible: true },
    { key: 'customerName', label: 'Customer Name', visible: true },
    { key: 'contactNumber', label: 'Contact Number', visible: true },
    { key: 'location', label: 'Location', visible: true },
    { key: 'paymentStatus', label: 'Payment Status', visible: true },
    { key: 'paymentMethod', label: 'Payment Method', visible: true },
    { key: 'totalAmount', label: 'Total Amount', visible: true },
    { key: 'totalPaid', label: 'Total Paid', visible: true },
    { key: 'sellDue', label: 'Sell Due', visible: true },
    { key: 'sellReturnDue', label: 'Sell Return Due', visible: false },
    { key: 'shippingStatus', label: 'Shipping Status', visible: true },
    { key: 'totalItems', label: 'Total Items', visible: true },
  ];

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Sales
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Track your sales and customer orders.
          </p>
        </div>
        <Button 
          onClick={() => openDrawer('addSale')}
          className="gap-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-primary)',
            boxShadow: 'var(--shadow-lg) rgba(59, 130, 246, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
          }}
        >
          <Plus size={18} />
          Add Sale
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard 
          title="Today's Sales" 
          value={`$${todaySales.toLocaleString()}`}
          subtitle="2 Transactions"
          icon={ShoppingCart}
          highlightColor="text-blue-400" 
        />
        <GlassCard 
          title="Monthly Sales" 
          value={`$${monthlySales.toLocaleString()}`}
          subtitle="This Month"
          icon={Calendar}
          highlightColor="text-green-400"
        />
        <GlassCard 
          title="Total Profit" 
          value={`$${profit.toLocaleString()}`}
          subtitle="25% Average Margin"
          icon={TrendingUp}
          highlightColor="text-yellow-400"
        />
        <GlassCard 
          title="Total Invoices" 
          value={mockSales.length.toString()}
          subtitle="Active Invoices"
          icon={FileText}
          highlightColor="text-purple-400"
        />
      </div>

      {/* Advanced Filters */}
      <AdvancedTableFilters
        filters={filterConfig}
        columns={columnConfig}
        onFilterChange={(filters) => console.log('Filters:', filters)}
        onColumnVisibilityChange={(cols) => console.log('Columns:', cols)}
        onExport={(type) => console.log('Export:', type)}
        onPrint={() => console.log('Print')}
        onEntriesChange={(count) => console.log('Entries:', count)}
      />

      {/* Table Section */}
      <div 
        className="border rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead 
              className="font-medium border-b"
              style={{
                backgroundColor: 'rgba(3, 7, 18, 0.5)',
                color: 'var(--color-text-secondary)',
                borderBottomColor: 'var(--color-border-primary)'
              }}
            >
              <tr>
                <th className="px-6 py-4"></th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Invoice No.</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Contact Number</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4">Payment Method</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-right">Total Paid</th>
                <th className="px-6 py-4 text-right">Sell Due</th>
                <th className="px-6 py-4 text-right">Sell Return Due</th>
                <th className="px-6 py-4 text-center">Shipping Status</th>
                <th className="px-6 py-4 text-center">Total Items</th>
              </tr>
            </thead>
            <tbody>
              {mockSales.map((sale) => (
                <tr 
                  key={sale.id} 
                  className="transition-colors group border-b"
                  style={{
                    borderBottomColor: 'var(--color-border-primary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(31, 41, 55, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td className="px-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-tertiary)';
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
                          Edit Sale
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <FileText size={14} className="mr-2" />
                          Print Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <DollarSign size={14} className="mr-2" />
                          Add Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          style={{ color: 'var(--color-text-primary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Truck size={14} className="mr-2" />
                          Update Shipping
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          style={{ color: 'var(--color-error)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
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
                  <td 
                    className="px-6 py-4"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {formatDate(new Date(sale.date))}
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {sale.invoiceNo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p 
                        className="font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {sale.customerName}
                      </p>
                      <p 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {sale.customer}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div 
                      className="flex items-center gap-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <Phone size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="text-sm">{sale.contactNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div 
                      className="flex items-center gap-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <MapPin size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="text-sm">{sale.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: sale.paymentStatus === 'Paid' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : sale.paymentStatus === 'Partial'
                          ? 'rgba(234, 179, 8, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                        color: sale.paymentStatus === 'Paid' 
                          ? 'var(--color-success)' 
                          : sale.paymentStatus === 'Partial'
                          ? 'var(--color-warning)'
                          : 'var(--color-error)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {sale.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ${sale.total.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-success)' }}
                    >
                      ${sale.paid.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {sale.due > 0 ? (
                      <span 
                        className="font-medium"
                        style={{ color: 'var(--color-error)' }}
                      >
                        ${sale.due.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {sale.returnDue > 0 ? (
                      <span 
                        className="font-medium"
                        style={{ color: 'var(--color-warning)' }}
                      >
                        ${sale.returnDue.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: sale.shippingStatus === 'Delivered' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : sale.shippingStatus === 'Processing'
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(234, 179, 8, 0.1)',
                        color: sale.shippingStatus === 'Delivered' 
                          ? 'var(--color-success)' 
                          : sale.shippingStatus === 'Processing'
                          ? 'var(--color-primary)'
                          : 'var(--color-warning)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {sale.shippingStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div 
                      className="flex items-center justify-center gap-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <Package size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                      <span className="font-medium">{sale.items}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const GlassCard = ({ title, value, subtitle, icon: Icon, highlightColor }: any) => {
  const valueColor = highlightColor === 'text-blue-400' 
    ? 'var(--color-primary)'
    : highlightColor === 'text-green-400'
    ? 'var(--color-success)'
    : highlightColor === 'text-yellow-400'
    ? 'var(--color-warning)'
    : highlightColor === 'text-purple-400'
    ? 'var(--color-wholesale)'
    : 'var(--color-text-primary)';
  
  return (
    <div 
      className="backdrop-blur-md border p-6 rounded-xl shadow-lg relative overflow-hidden"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Icon size={48} style={{ color: 'var(--color-text-primary)' }} />
      </div>
      <p 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </p>
      <div className="flex items-end gap-3 mt-1 mb-2">
        <h3 
          className="text-3xl font-bold"
          style={{ color: valueColor }}
        >
          {value}
        </h3>
      </div>
      <p 
        className="text-xs"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        {subtitle}
      </p>
    </div>
  );
};