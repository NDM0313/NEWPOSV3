import { useState } from 'react';
import { ArrowLeft, Plus, TrendingUp, Edit2, Trash2, Eye, Printer, Share2, X, Filter, Search, SlidersHorizontal, Download, Check, Calendar, ChevronDown, ArrowUpDown } from 'lucide-react';
import { User } from '../../App';
import { LongPressCard } from '../common/LongPressCard';

interface SalesDashboardProps {
  onBack: () => void;
  onAddSale: () => void;
  user: User;
}

interface SaleRecord {
  id: string;
  invoiceNo: string;
  customer: string;
  customerPhone: string;
  amount: number;
  date: string;
  time: string;
  items: { name: string; quantity: number; price: number }[];
  paymentStatus: 'paid' | 'pending' | 'partial';
  saleType: 'Regular' | 'Studio';
  timestamp: number; // For sorting
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';
type PaymentFilter = 'all' | 'paid' | 'pending' | 'partial';

export function SalesDashboard({ onBack, onAddSale, user }: SalesDashboardProps) {
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showPaymentUpdate, setShowPaymentUpdate] = useState(false);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  // Mock sales data
  const [salesData, setSalesData] = useState<SaleRecord[]>([
    {
      id: 's1',
      invoiceNo: 'INV-0045',
      customer: 'Ahmed Ali',
      customerPhone: '0300-1234567',
      amount: 12000,
      date: '2026-01-21',
      time: '2:30 PM',
      items: [
        { name: 'Lawn Suit', quantity: 2, price: 6000 },
      ],
      paymentStatus: 'paid',
      saleType: 'Regular',
      timestamp: Date.now() - 1000,
    },
    {
      id: 's2',
      invoiceNo: 'INV-0044',
      customer: 'Sara Khan',
      customerPhone: '0301-2345678',
      amount: 8500,
      date: '2026-01-21',
      time: '11:15 AM',
      items: [
        { name: 'Silk Dupatta', quantity: 1, price: 8500 },
      ],
      paymentStatus: 'paid',
      saleType: 'Regular',
      timestamp: Date.now() - 10000,
    },
    {
      id: 's3',
      invoiceNo: 'INV-0043',
      customer: 'Ali Raza',
      customerPhone: '0302-3456789',
      amount: 15200,
      date: '2026-01-20',
      time: '4:20 PM',
      items: [
        { name: 'Bridal Dress', quantity: 1, price: 15200 },
      ],
      paymentStatus: 'pending',
      saleType: 'Studio',
      timestamp: Date.now() - 100000,
    },
    {
      id: 's4',
      invoiceNo: 'INV-0042',
      customer: 'Fatima Ahmed',
      customerPhone: '0303-4567890',
      amount: 22000,
      date: '2026-01-20',
      time: '1:45 PM',
      items: [
        { name: 'Party Wear Set', quantity: 2, price: 11000 },
      ],
      paymentStatus: 'partial',
      saleType: 'Regular',
      timestamp: Date.now() - 200000,
    },
    {
      id: 's5',
      invoiceNo: 'INV-0041',
      customer: 'Hassan Tariq',
      customerPhone: '0304-5678901',
      amount: 18500,
      date: '2026-01-19',
      time: '3:10 PM',
      items: [
        { name: 'Cotton Fabric', quantity: 50, price: 370 },
      ],
      paymentStatus: 'paid',
      saleType: 'Regular',
      timestamp: Date.now() - 300000,
    },
    {
      id: 's6',
      invoiceNo: 'INV-0040',
      customer: 'Ayesha Malik',
      customerPhone: '0305-6789012',
      amount: 9500,
      date: '2026-01-19',
      time: '10:30 AM',
      items: [
        { name: 'Formal Shirt', quantity: 3, price: 3166 },
      ],
      paymentStatus: 'pending',
      saleType: 'Regular',
      timestamp: Date.now() - 400000,
    },
  ]);

  // Check permissions
  const canEdit = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  // Filter & Sort Logic
  const getFilteredAndSortedSales = () => {
    let filtered = [...salesData];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(sale => 
        sale.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.customerPhone.includes(searchQuery)
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(sale => sale.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(sale => sale.date <= dateTo);
    }

    // Payment status filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(sale => sale.paymentStatus === paymentFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return b.timestamp - a.timestamp;
        case 'date-asc':
          return a.timestamp - b.timestamp;
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredSales = getFilteredAndSortedSales();

  // Calculate stats
  const todaySales = salesData
    .filter(s => s.date === '2026-01-21')
    .reduce((sum, s) => sum + s.amount, 0);
  
  const weekSales = salesData.reduce((sum, s) => sum + s.amount, 0);

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSales.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSales.map(s => s.id));
    }
  };

  const toggleSelectSale = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Export to CSV (simulated)
  const handleExportCSV = () => {
    const csv = [
      ['Invoice', 'Customer', 'Phone', 'Amount', 'Date', 'Time', 'Payment Status', 'Type'].join(','),
      ...filteredSales.map(s => 
        [s.invoiceNo, s.customer, s.customerPhone, s.amount, s.date, s.time, s.paymentStatus, s.saleType].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-export-${Date.now()}.csv`;
    a.click();
  };

  // Bulk delete
  const handleBulkDelete = () => {
    if (canDelete) {
      setSalesData(salesData.filter(s => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      setBulkMode(false);
      setShowBulkActions(false);
    }
  };

  // Bulk payment status update
  const handleBulkPaymentUpdate = (status: 'paid' | 'pending' | 'partial') => {
    setSalesData(salesData.map(s => 
      selectedIds.includes(s.id) ? { ...s, paymentStatus: status } : s
    ));
    setSelectedIds([]);
    setBulkMode(false);
    setShowPaymentUpdate(false);
  };

  // Single delete
  const handleDeleteSale = () => {
    if (selectedSale && canDelete) {
      setSalesData(salesData.filter(s => s.id !== selectedSale.id));
      setShowDeleteConfirm(false);
      setSelectedSale(null);
    }
  };

  // Save edit
  const handleSaveEdit = () => {
    if (selectedSale) {
      setSalesData(salesData.map(s => s.id === selectedSale.id ? selectedSale : s));
      setIsEditing(false);
    }
  };

  // Update payment status for single sale
  const handleUpdatePaymentStatus = (status: 'paid' | 'pending' | 'partial') => {
    if (selectedSale) {
      const updated = { ...selectedSale, paymentStatus: status };
      setSelectedSale(updated);
      setSalesData(salesData.map(s => s.id === selectedSale.id ? updated : s));
    }
  };

  // Format date display
  const formatDateDisplay = (dateStr: string) => {
    const today = '2026-01-21';
    const yesterday = '2026-01-20';
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return dateStr;
  };

  // Sale Detail/Edit View
  if (selectedSale) {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        {/* Header */}
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedSale(null);
                  setIsEditing(false);
                }}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold">{isEditing ? 'Edit Sale' : 'Sale Details'}</h1>
            </div>
            
            {!isEditing && (
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
                  >
                    <Edit2 className="w-5 h-5 text-[#3B82F6]" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
                  >
                    <Trash2 className="w-5 h-5 text-[#EF4444]" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Invoice Info */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-[#9CA3AF]">Invoice Number</p>
                <p className="text-xl font-bold text-white">{selectedSale.invoiceNo}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => setShowPaymentUpdate(true)}
                  className={`px-3 py-1 ${selectedSale.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : selectedSale.paymentStatus === 'partial' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#EF4444]/10 text-[#EF4444]'} text-xs rounded-full font-medium uppercase hover:opacity-80 transition-opacity active:scale-95`}
                >
                  {selectedSale.paymentStatus}
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-sm text-[#9CA3AF]">Date</span>
                <span className="text-sm text-white">{formatDateDisplay(selectedSale.date)}, {selectedSale.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#9CA3AF]">Sale Type</span>
                <span className="text-sm text-white">{selectedSale.saleType}</span>
              </div>
            </div>

            {/* Customer Info - Editable */}
            <div className="border-t border-[#374151] pt-4">
              <p className="text-sm text-[#9CA3AF] mb-3">Customer Details</p>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-2">Name</label>
                    <input
                      type="text"
                      value={selectedSale.customer}
                      onChange={(e) => setSelectedSale({ ...selectedSale, customer: e.target.value })}
                      className="w-full h-10 px-3 bg-[#111827] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-2">Phone</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={selectedSale.customerPhone}
                      onChange={(e) => setSelectedSale({ ...selectedSale, customerPhone: e.target.value })}
                      className="w-full h-10 px-3 bg-[#111827] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white font-medium">{selectedSale.customer}</p>
                  <p className="text-sm text-[#9CA3AF]">{selectedSale.customerPhone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Items</h3>
            <div className="space-y-3">
              {selectedSale.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between pb-3 border-b border-[#374151] last:border-0">
                  <div>
                    <p className="text-sm text-white">{item.name}</p>
                    <p className="text-xs text-[#9CA3AF]">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-[#10B981]">Rs. {item.price.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#374151]">
              <span className="text-sm font-medium text-white">Total Amount</span>
              <span className="text-xl font-bold text-[#10B981]">Rs. {selectedSale.amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Actions */}
          {isEditing ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="h-12 bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] text-white rounded-lg font-medium transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium transition-colors active:scale-95"
              >
                Save Changes
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => alert('Print functionality - Connect to printer')}
                className="h-12 bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] text-white rounded-lg font-medium transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button 
                onClick={() => alert('Share functionality - Native share API')}
                className="h-12 bg-[#1F2937] border border-[#374151] hover:border-[#3B82F6] text-white rounded-lg font-medium transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button className="h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg font-medium transition-colors active:scale-95 flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                Full
              </button>
            </div>
          )}
        </div>

        {/* Payment Status Update Modal */}
        {showPaymentUpdate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Update Payment Status</h3>
                <button
                  onClick={() => setShowPaymentUpdate(false)}
                  className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    handleUpdatePaymentStatus('paid');
                    setShowPaymentUpdate(false);
                  }}
                  className="w-full h-12 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-lg font-medium hover:bg-[#10B981]/20 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  {selectedSale.paymentStatus === 'paid' && <Check className="w-5 h-5" />}
                  Paid
                </button>
                <button
                  onClick={() => {
                    handleUpdatePaymentStatus('partial');
                    setShowPaymentUpdate(false);
                  }}
                  className="w-full h-12 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-lg font-medium hover:bg-[#F59E0B]/20 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  {selectedSale.paymentStatus === 'partial' && <Check className="w-5 h-5" />}
                  Partial
                </button>
                <button
                  onClick={() => {
                    handleUpdatePaymentStatus('pending');
                    setShowPaymentUpdate(false);
                  }}
                  className="w-full h-12 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg font-medium hover:bg-[#EF4444]/20 transition-colors active:scale-95 flex items-center justify-center gap-2"
                >
                  {selectedSale.paymentStatus === 'pending' && <Check className="w-5 h-5" />}
                  Pending
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Delete Sale?</h3>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#9CA3AF] mb-6">
                Are you sure you want to delete {selectedSale.invoiceNo}? This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="h-10 bg-[#1F2937] border border-[#374151] text-white rounded-lg font-medium transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSale}
                  className="h-10 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg font-medium transition-colors active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Dashboard View
  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Sales</h1>
          </div>
          <div className="flex items-center gap-2">
            {bulkMode ? (
              <button
                onClick={() => {
                  setBulkMode(false);
                  setSelectedIds([]);
                }}
                className="px-3 py-2 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-sm font-medium transition-colors active:scale-95"
              >
                Cancel
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
                >
                  <Filter className="w-5 h-5" />
                </button>
                <button
                  onClick={onAddSale}
                  className="p-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search by invoice, customer, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-[#111827] border border-[#374151] rounded-lg text-white placeholder-[#6B7280] text-sm focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 space-y-3 pb-3 border-b border-[#374151]">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 px-2 bg-[#111827] border border-[#374151] rounded-lg text-white text-xs focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#9CA3AF] mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 px-2 bg-[#111827] border border-[#374151] rounded-lg text-white text-xs focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>

            {/* Payment Status Filter */}
            <div className="grid grid-cols-4 gap-2">
              {(['all', 'paid', 'partial', 'pending'] as PaymentFilter[]).map(status => (
                <button
                  key={status}
                  onClick={() => setPaymentFilter(status)}
                  className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                    paymentFilter === status
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-[#111827] border border-[#374151] text-[#9CA3AF]'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchQuery('');
                setDateFrom('');
                setDateTo('');
                setPaymentFilter('all');
              }}
              className="w-full h-8 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-xs font-medium hover:bg-[#EF4444]/20 transition-colors active:scale-95"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Quick Stats Card */}
        <div className="bg-gradient-to-br from-[#3B82F6] to-[#2563EB] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-white/80" />
            <span className="text-sm text-white/80">Quick Stats</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/60 mb-1">Today</p>
              <p className="text-2xl font-bold text-white">Rs. {todaySales.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-white/60 mb-1">Total</p>
              <p className="text-2xl font-bold text-white">Rs. {weekSales.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setShowSortMenu(true)}
            className="h-10 bg-[#1F2937] border border-[#374151] rounded-lg text-sm font-medium text-white hover:border-[#3B82F6] transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort
          </button>
          <button
            onClick={() => {
              setBulkMode(true);
              setShowBulkActions(true);
            }}
            className="h-10 bg-[#1F2937] border border-[#374151] rounded-lg text-sm font-medium text-white hover:border-[#3B82F6] transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Bulk
          </button>
          <button
            onClick={handleExportCSV}
            className="h-10 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg text-sm font-medium transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {bulkMode && (
          <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-[#374151] rounded transition-colors"
                >
                  <div className={`w-5 h-5 rounded border-2 ${selectedIds.length === filteredSales.length ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#374151]'} flex items-center justify-center`}>
                    {selectedIds.length === filteredSales.length && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
                <span className="text-sm text-[#3B82F6] font-medium">
                  {selectedIds.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canDelete && selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs rounded-lg font-medium transition-colors active:scale-95"
                  >
                    Delete
                  </button>
                )}
                {canEdit && selectedIds.length > 0 && (
                  <button
                    onClick={() => setShowPaymentUpdate(true)}
                    className="px-3 py-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-xs rounded-lg font-medium transition-colors active:scale-95"
                  >
                    Update Status
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#9CA3AF]">
            {filteredSales.length} SALE{filteredSales.length !== 1 ? 'S' : ''} FOUND
          </h2>
        </div>

        {/* Sales List */}
        <div className="space-y-2">
          {filteredSales.map((sale) => (
            bulkMode ? (
              <div
                key={sale.id}
                onClick={() => toggleSelectSale(sale.id)}
                className={`w-full bg-[#1F2937] border ${selectedIds.includes(sale.id) ? 'border-[#3B82F6] bg-[#3B82F6]/5' : 'border-[#374151]'} rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98] cursor-pointer`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <div className={`w-5 h-5 rounded border-2 ${selectedIds.includes(sale.id) ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-[#374151]'} flex items-center justify-center`}>
                      {selectedIds.includes(sale.id) && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-base font-medium text-white">{sale.invoiceNo}</p>
                      <p className="text-sm font-semibold text-[#10B981]">Rs. {sale.amount.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-[#9CA3AF]">{sale.customer}</p>
                      <span className={`px-2 py-0.5 ${sale.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : sale.paymentStatus === 'partial' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#EF4444]/10 text-[#EF4444]'} text-xs rounded-full font-medium`}>
                        {sale.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">{formatDateDisplay(sale.date)}, {sale.time}</p>
                  </div>
                </div>
              </div>
            ) : (
              <LongPressCard
                key={sale.id}
                onTap={() => setSelectedSale(sale)}
                onView={() => setSelectedSale(sale)}
                onEdit={canEdit ? () => {
                  setSelectedSale(sale);
                  setIsEditing(true);
                } : undefined}
                onDelete={canDelete ? () => {
                  setSelectedSale(sale);
                  setShowDeleteConfirm(true);
                } : undefined}
                onDuplicate={() => {
                  // Duplicate functionality
                  const newSale = {
                    ...sale,
                    id: `s${Date.now()}`,
                    invoiceNo: `INV-${String(Date.now()).slice(-4)}`,
                    timestamp: Date.now(),
                  };
                  setSalesData([newSale, ...salesData]);
                }}
                canEdit={canEdit}
                canDelete={canDelete}
                className="w-full bg-[#1F2937] border border-[#374151] rounded-xl p-4 hover:border-[#3B82F6] transition-all active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-base font-medium text-white">{sale.invoiceNo}</p>
                      <p className="text-sm font-semibold text-[#10B981]">Rs. {sale.amount.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-[#9CA3AF]">{sale.customer}</p>
                      <span className={`px-2 py-0.5 ${sale.paymentStatus === 'paid' ? 'bg-[#10B981]/10 text-[#10B981]' : sale.paymentStatus === 'partial' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#EF4444]/10 text-[#EF4444]'} text-xs rounded-full font-medium`}>
                        {sale.paymentStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">{formatDateDisplay(sale.date)}, {sale.time}</p>
                  </div>
                </div>
              </LongPressCard>
            )
          ))}

          {filteredSales.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-[#9CA3AF]">No sales found matching your filters</p>
            </div>
          )}
        </div>

        {/* Permission Notice */}
        {!canEdit && (
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
            <p className="text-xs text-[#F59E0B]">
              ℹ️ You have view-only access. Contact your administrator to request edit permissions.
            </p>
          </div>
        )}
      </div>

      {/* Sort Menu Modal */}
      {showSortMenu && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center p-4 z-50">
          <div className="bg-[#1F2937] border border-[#374151] rounded-t-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-[#374151]">
              <h3 className="text-lg font-semibold text-white">Sort By</h3>
              <button
                onClick={() => setShowSortMenu(false)}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {[
                { value: 'date-desc' as SortOption, label: 'Date (Newest First)' },
                { value: 'date-asc' as SortOption, label: 'Date (Oldest First)' },
                { value: 'amount-desc' as SortOption, label: 'Amount (High to Low)' },
                { value: 'amount-asc' as SortOption, label: 'Amount (Low to High)' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSortBy(option.value);
                    setShowSortMenu(false);
                  }}
                  className={`w-full h-12 rounded-lg text-sm font-medium transition-colors flex items-center justify-between px-4 ${
                    sortBy === option.value
                      ? 'bg-[#3B82F6] text-white'
                      : 'bg-[#111827] border border-[#374151] text-white hover:border-[#3B82F6]'
                  }`}
                >
                  {option.label}
                  {sortBy === option.value && <Check className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Payment Update Modal */}
      {showPaymentUpdate && bulkMode && selectedIds.length > 0 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Update Payment Status</h3>
              <button
                onClick={() => setShowPaymentUpdate(false)}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#9CA3AF] mb-4">Update {selectedIds.length} selected sale{selectedIds.length > 1 ? 's' : ''}</p>
            <div className="space-y-2">
              <button
                onClick={() => handleBulkPaymentUpdate('paid')}
                className="w-full h-12 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] rounded-lg font-medium hover:bg-[#10B981]/20 transition-colors active:scale-95"
              >
                Mark as Paid
              </button>
              <button
                onClick={() => handleBulkPaymentUpdate('partial')}
                className="w-full h-12 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-lg font-medium hover:bg-[#F59E0B]/20 transition-colors active:scale-95"
              >
                Mark as Partial
              </button>
              <button
                onClick={() => handleBulkPaymentUpdate('pending')}
                className="w-full h-12 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg font-medium hover:bg-[#EF4444]/20 transition-colors active:scale-95"
              >
                Mark as Pending
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}