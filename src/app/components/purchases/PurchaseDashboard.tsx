import React from 'react';
import { Plus, Search, ShoppingBag, DollarSign, Package, TrendingDown, MoreVertical, Eye, Edit, Trash2, FileText } from 'lucide-react';
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

const mockPurchases = [
  { id: 1, refNo: 'PO-001', supplier: 'Bilal Fabrics', date: '2024-01-15', location: 'Main Branch', items: 24, total: 15000, paid: 10000, due: 5000, purchaseStatus: 'Received', paymentStatus: 'Partial', addedBy: 'Ahmad Khan' },
  { id: 2, refNo: 'PO-002', supplier: 'ChenOne', date: '2024-01-14', location: 'Warehouse A', items: 56, total: 120000, paid: 120000, due: 0, purchaseStatus: 'Received', paymentStatus: 'Paid', addedBy: 'Sara Ali' },
  { id: 3, refNo: 'PO-003', supplier: 'Sapphire Mills', date: '2024-01-13', location: 'Main Branch', items: 12, total: 45000, paid: 0, due: 45000, purchaseStatus: 'Ordered', paymentStatus: 'Unpaid', addedBy: 'Bilal Ahmed' },
  { id: 4, refNo: 'PO-004', supplier: 'Local Supplier', date: '2024-01-12', location: 'Warehouse B', items: 8, total: 8500, paid: 8500, due: 0, purchaseStatus: 'Received', paymentStatus: 'Paid', addedBy: 'Ahmad Khan' },
];

export const PurchaseDashboard = () => {
  const { openDrawer } = useNavigation();

  const totalPurchase = mockPurchases.reduce((acc, p) => acc + p.total, 0);
  const totalDue = mockPurchases.reduce((acc, p) => acc + p.due, 0);
  const totalReturns = 2500; // Mock value

  // Filter Configuration
  const filterConfig = [
    {
      label: 'Business Location',
      key: 'location',
      type: 'select' as const,
      options: [
        { value: 'main', label: 'Main Branch' },
        { value: 'warehouseA', label: 'Warehouse A' },
        { value: 'warehouseB', label: 'Warehouse B' },
      ]
    },
    {
      label: 'Supplier',
      key: 'supplier',
      type: 'select' as const,
      options: [
        { value: 'bilal', label: 'Bilal Fabrics' },
        { value: 'chenone', label: 'ChenOne' },
        { value: 'sapphire', label: 'Sapphire Mills' },
      ]
    },
    {
      label: 'Purchase Status',
      key: 'purchaseStatus',
      type: 'select' as const,
      options: [
        { value: 'received', label: 'Received' },
        { value: 'ordered', label: 'Ordered' },
        { value: 'pending', label: 'Pending' },
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
      label: 'Added By',
      key: 'addedBy',
      type: 'select' as const,
      options: [
        { value: 'ahmad', label: 'Ahmad Khan' },
        { value: 'sara', label: 'Sara Ali' },
        { value: 'bilal', label: 'Bilal Ahmed' },
      ]
    },
  ];

  // Column Configuration
  const columnConfig = [
    { key: 'date', label: 'Date', visible: true },
    { key: 'refNo', label: 'Reference No', visible: true },
    { key: 'location', label: 'Location', visible: true },
    { key: 'supplier', label: 'Supplier', visible: true },
    { key: 'purchaseStatus', label: 'Purchase Status', visible: true },
    { key: 'paymentStatus', label: 'Payment Status', visible: true },
    { key: 'grandTotal', label: 'Grand Total', visible: true },
    { key: 'paymentDue', label: 'Payment Due', visible: true },
    { key: 'addedBy', label: 'Added By', visible: true },
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
            Purchases
          </h2>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Manage purchase orders and supplier transactions.
          </p>
        </div>
        <Button 
          onClick={() => openDrawer('addPurchase')}
          className="gap-2"
          style={{
            backgroundColor: 'var(--color-warning)',
            color: 'var(--color-text-primary)',
            boxShadow: 'var(--shadow-lg) rgba(249, 115, 22, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(234, 88, 12, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-warning)';
          }}
        >
          <Plus size={18} />
          Add Purchase
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassCard 
          title="Total Purchase" 
          value={`$${totalPurchase.toLocaleString()}`}
          subtitle="This Month"
          icon={ShoppingBag}
          highlightColor="text-orange-400" 
        />
        <GlassCard 
          title="Amount Due" 
          value={`$${totalDue.toLocaleString()}`}
          subtitle="Pending Payments"
          icon={DollarSign}
          highlightColor="text-red-400"
        />
        <GlassCard 
          title="Returns" 
          value={`$${totalReturns.toLocaleString()}`}
          subtitle="2 Items Returned"
          icon={Package}
          highlightColor="text-yellow-400"
        />
        <GlassCard 
          title="Purchase Orders" 
          value={mockPurchases.length.toString()}
          subtitle="Active Orders"
          icon={FileText}
          highlightColor="text-blue-400"
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
        {/* Table Header with Method Badge */}
        <div 
          className="px-6 py-3 border-b flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(3, 7, 18, 0.5)',
            borderBottomColor: 'var(--color-border-primary)'
          }}
        >
          <div className="flex items-center gap-3">
            <h3 
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Purchase Orders
            </h3>
            <span 
              className="px-3 py-1 border rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: 'var(--color-primary)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-full)'
              }}
            >
              Standard Method
            </span>
          </div>
        </div>

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
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4 text-center">Purchase Status</th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4 text-right">Grand Total</th>
                <th className="px-6 py-4 text-right">Payment Due</th>
                <th className="px-6 py-4">Added By</th>
              </tr>
            </thead>
            <tbody>
              {mockPurchases.map((purchase) => (
                <tr 
                  key={purchase.id} 
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
                          Edit Purchase
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
                          Generate Invoice
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
                    {formatDate(new Date(purchase.date))}
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {purchase.refNo}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{purchase.location}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p 
                        className="font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {purchase.supplier}
                      </p>
                      <p 
                        className="text-xs"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {purchase.items} items
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: purchase.purchaseStatus === 'Received' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : purchase.purchaseStatus === 'Ordered'
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(107, 114, 128, 0.1)',
                        color: purchase.purchaseStatus === 'Received' 
                          ? 'var(--color-success)' 
                          : purchase.purchaseStatus === 'Ordered'
                          ? 'var(--color-primary)'
                          : 'var(--color-text-tertiary)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {purchase.purchaseStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span 
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: purchase.paymentStatus === 'Paid' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : purchase.paymentStatus === 'Partial'
                          ? 'rgba(234, 179, 8, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                        color: purchase.paymentStatus === 'Paid' 
                          ? 'var(--color-success)' 
                          : purchase.paymentStatus === 'Partial'
                          ? 'var(--color-warning)'
                          : 'var(--color-error)',
                        borderRadius: 'var(--radius-full)'
                      }}
                    >
                      {purchase.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span 
                      className="font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      ${purchase.total.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {purchase.due > 0 ? (
                      <span 
                        className="font-medium"
                        style={{ color: 'var(--color-error)' }}
                      >
                        ${purchase.due.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {purchase.addedBy}
                    </span>
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
  const valueColor = highlightColor === 'text-orange-400' 
    ? 'var(--color-warning)'
    : highlightColor === 'text-red-400'
    ? 'var(--color-error)'
    : highlightColor === 'text-yellow-400'
    ? 'var(--color-warning)'
    : highlightColor === 'text-blue-400'
    ? 'var(--color-primary)'
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