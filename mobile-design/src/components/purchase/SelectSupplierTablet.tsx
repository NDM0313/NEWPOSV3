import { useState } from 'react';
import { ArrowLeft, Search, Plus, Phone, X, TrendingUp, Building2 } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface SelectSupplierTabletProps {
  onBack: () => void;
  onSelect: (supplier: Supplier) => void;
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[]) => void;
}

export function SelectSupplierTablet({ 
  onBack, 
  onSelect, 
  suppliers, 
  setSuppliers 
}: SelectSupplierTabletProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '' });

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    supplier.phone.includes(searchQuery)
  );

  const recentSuppliers = suppliers.slice(0, 2);

  const stats = {
    total: suppliers.length,
    withDue: suppliers.filter(s => s.balance > 0).length,
    withCredit: suppliers.filter(s => s.balance < 0).length,
  };

  const handleAddNewSupplier = () => {
    if (!newSupplier.name || !newSupplier.phone) return;
    
    const supplier: Supplier = {
      id: `s${Date.now()}`,
      name: newSupplier.name,
      phone: newSupplier.phone,
      balance: 0,
    };
    
    setSuppliers([supplier, ...suppliers]);
    setShowAddDialog(false);
    setNewSupplier({ name: '', phone: '' });
    onSelect(supplier);
  };

  // Compact Supplier Card Component
  const CompactSupplierCard = ({ supplier }: { supplier: Supplier }) => (
    <button
      onClick={() => onSelect(supplier)}
      className="w-full bg-[#1F2937] border border-[#374151] rounded-lg p-3 hover:border-[#10B981] transition-all active:scale-[0.98] text-left group"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 bg-[#10B981]/10 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-[#10B981]">
            {supplier.name.charAt(0)}
          </span>
        </div>

        {/* Name + Phone (Left) */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white text-sm truncate">{supplier.name}</h3>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Phone className="w-3 h-3" />
            <span>{supplier.phone}</span>
          </div>
        </div>

        {/* Balance (Right) */}
        {supplier.balance !== 0 && (
          <div className="text-right flex-shrink-0">
            <p className={`text-xs font-medium ${supplier.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              {supplier.balance > 0 ? 'Payable' : 'Receivable'}
            </p>
            <p className={`text-sm font-semibold ${supplier.balance > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              Rs. {Math.abs(supplier.balance).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">Select Supplier</h1>
                <p className="text-xs text-[#6B7280]">Choose supplier for purchase</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search supplier by name or phone..."
              className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Supplier List (2/3 width) */}
          <div className="col-span-2 space-y-6">
            {/* Recent Suppliers */}
            {!searchQuery && recentSuppliers.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">RECENT SUPPLIERS</h2>
                <div className="space-y-2">
                  {recentSuppliers.map((supplier) => (
                    <CompactSupplierCard key={supplier.id} supplier={supplier} />
                  ))}
                </div>
              </div>
            )}

            {/* All Suppliers */}
            <div>
              <h2 className="text-sm font-medium text-[#9CA3AF] mb-3">
                {searchQuery ? 'SEARCH RESULTS' : 'ALL SUPPLIERS'}
              </h2>
              <div className="space-y-2">
                {filteredSuppliers.map((supplier) => (
                  <CompactSupplierCard key={supplier.id} supplier={supplier} />
                ))}
              </div>

              {filteredSuppliers.length === 0 && (
                <div className="text-center py-12 bg-[#1F2937] rounded-xl border border-[#374151]">
                  <div className="w-16 h-16 bg-[#374151] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-[#6B7280]" />
                  </div>
                  <p className="text-[#9CA3AF]">No suppliers found</p>
                </div>
              )}
            </div>

            {/* Add New Supplier Button */}
            <button 
              onClick={() => setShowAddDialog(true)}
              className="w-full py-3 border-2 border-dashed border-[#374151] rounded-lg text-[#9CA3AF] hover:border-[#10B981] hover:text-[#10B981] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium text-sm">Add New Supplier</span>
            </button>
          </div>

          {/* Right Column - Stats & Info (1/3 width) */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-sm font-semibold text-white">Supplier Stats</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Total Suppliers</span>
                  <span className="text-sm font-semibold text-white">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Payables</span>
                  <span className="text-sm font-semibold text-[#EF4444]">{stats.withDue}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Receivables</span>
                  <span className="text-sm font-semibold text-[#10B981]">{stats.withCredit}</span>
                </div>
              </div>
            </div>

            {/* Quick Tip */}
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4">
              <div className="text-lg mb-2">💡</div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                <span className="text-white font-medium">Quick Tip:</span> Select supplier to start purchase order
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Supplier Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1F2937] rounded-2xl w-full max-w-md">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#374151] flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add New Supplier</h2>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewSupplier({ name: '', phone: '' });
                }}
                className="p-2 hover:bg-[#374151] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="Enter supplier name"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#9CA3AF] mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={newSupplier.phone}
                  onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  placeholder="+92-300-1234567"
                  className="w-full h-12 bg-[#111827] border border-[#374151] rounded-lg px-4 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewSupplier({ name: '', phone: '' });
                  }}
                  className="flex-1 h-12 border border-[#374151] rounded-lg font-medium hover:bg-[#374151] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewSupplier}
                  disabled={!newSupplier.name || !newSupplier.phone}
                  className="flex-1 h-12 bg-[#10B981] hover:bg-[#059669] disabled:bg-[#374151] disabled:text-[#6B7280] rounded-lg font-medium transition-colors"
                >
                  Add Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
