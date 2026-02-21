import { useState } from 'react';
import { ArrowLeft, BarChart3, Plus, Search, Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { User } from '../../App';

interface InventoryModuleProps {
  onBack: () => void;
  user: User;
}

export interface InventoryItem {
  id: string;
  productName: string;
  sku: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  costPrice: number;
  totalValue: number;
  lastUpdated: Date;
  status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'overstock';
}

export function InventoryModule({ onBack, user }: InventoryModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | InventoryItem['status']>('all');

  // Mock data
  const [inventory] = useState<InventoryItem[]>([
    {
      id: '1',
      productName: 'Bridal Lehenga - Red & Gold',
      sku: 'BRD-001',
      category: 'Bridal',
      currentStock: 5,
      minStock: 2,
      maxStock: 10,
      unit: 'Piece',
      costPrice: 12000,
      totalValue: 60000,
      lastUpdated: new Date('2026-01-18'),
      status: 'in-stock',
    },
    {
      id: '2',
      productName: 'Dupatta - Gold Embroidered',
      sku: 'DUP-002',
      category: 'Accessories',
      currentStock: 12,
      minStock: 5,
      maxStock: 20,
      unit: 'Piece',
      costPrice: 4000,
      totalValue: 48000,
      lastUpdated: new Date('2026-01-17'),
      status: 'in-stock',
    },
    {
      id: '3',
      productName: 'Bridal Shoes - Golden',
      sku: 'SHO-005',
      category: 'Footwear',
      currentStock: 1,
      minStock: 2,
      maxStock: 8,
      unit: 'Pair',
      costPrice: 3000,
      totalValue: 3000,
      lastUpdated: new Date('2026-01-16'),
      status: 'low-stock',
    },
    {
      id: '4',
      productName: 'Jewelry Set - Pearl',
      sku: 'JWL-004',
      category: 'Jewelry',
      currentStock: 0,
      minStock: 2,
      maxStock: 5,
      unit: 'Set',
      costPrice: 8000,
      totalValue: 0,
      lastUpdated: new Date('2026-01-15'),
      status: 'out-of-stock',
    },
    {
      id: '5',
      productName: 'Silk Fabric - Royal Blue',
      sku: 'FAB-003',
      category: 'Fabric',
      currentStock: 25,
      minStock: 10,
      maxStock: 30,
      unit: 'Meter',
      costPrice: 1000,
      totalValue: 25000,
      lastUpdated: new Date('2026-01-14'),
      status: 'in-stock',
    },
  ]);

  // Calculate stats
  const stats = {
    totalItems: inventory.length,
    inStock: inventory.filter(i => i.status === 'in-stock').length,
    lowStock: inventory.filter(i => i.status === 'low-stock').length,
    outOfStock: inventory.filter(i => i.status === 'out-of-stock').length,
    totalValue: inventory.reduce((sum, i) => sum + i.totalValue, 0),
  };

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch =
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock':
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30';
      case 'low-stock':
        return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30';
      case 'out-of-stock':
        return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30';
      case 'overstock':
        return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
      default:
        return 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'low-stock':
        return <TrendingDown size={14} />;
      case 'out-of-stock':
        return <AlertTriangle size={14} />;
      case 'overstock':
        return <TrendingUp size={14} />;
      default:
        return <Package size={14} />;
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <BarChart3 size={18} className="text-white" />
            </div>
            <h1 className="text-white font-semibold text-base">Inventory</h1>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="overflow-x-auto px-4 py-4 scrollbar-hide">
        <div className="flex gap-3" style={{ minWidth: 'min-content' }}>
          <StatsCard icon="📦" value={stats.totalItems} label="Total Items" />
          <StatsCard icon="✓" value={stats.inStock} label="In Stock" color="green" />
          <StatsCard icon="⚠️" value={stats.lowStock} label="Low Stock" color="orange" />
          <StatsCard icon="❌" value={stats.outOfStock} label="Out of Stock" color="red" />
          <StatsCard 
            icon="💰" 
            value={`Rs. ${(stats.totalValue / 1000).toFixed(0)}k`} 
            label="Total Value" 
            color="blue" 
          />
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 pb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['all', 'in-stock', 'low-stock', 'out-of-stock'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as typeof filterStatus)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === status
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#1F2937] text-[#9CA3AF] border border-[#374151]'
              }`}
            >
              {status === 'all' ? 'All' : status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      <div className="px-4 space-y-3">
        {filteredInventory.map((item) => (
          <div key={item.id} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base mb-1">{item.productName}</h3>
                <p className="text-[#6B7280] text-sm">SKU: {item.sku}</p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium border flex items-center gap-1 ${getStatusColor(item.status)}`}>
                {getStatusIcon(item.status)}
                {item.status.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </span>
            </div>

            {/* Stock Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-[#9CA3AF] mb-1">
                <span>Stock Level</span>
                <span>{item.currentStock} / {item.maxStock} {item.unit}</span>
              </div>
              <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    item.status === 'out-of-stock'
                      ? 'bg-[#EF4444]'
                      : item.status === 'low-stock'
                      ? 'bg-[#F59E0B]'
                      : 'bg-[#10B981]'
                  }`}
                  style={{ width: `${(item.currentStock / item.maxStock) * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-[#111827] rounded-lg p-2">
                <p className="text-xs text-[#6B7280] mb-1">Current</p>
                <p className="text-white font-semibold">{item.currentStock}</p>
              </div>
              <div className="bg-[#111827] rounded-lg p-2">
                <p className="text-xs text-[#6B7280] mb-1">Min</p>
                <p className="text-white font-semibold">{item.minStock}</p>
              </div>
              <div className="bg-[#111827] rounded-lg p-2">
                <p className="text-xs text-[#6B7280] mb-1">Value</p>
                <p className="text-white font-semibold">Rs. {(item.totalValue / 1000).toFixed(0)}k</p>
              </div>
            </div>

            <div className="mt-3 text-xs text-[#6B7280]">
              Last updated: {item.lastUpdated.toLocaleDateString()}
            </div>
          </div>
        ))}

        {filteredInventory.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 text-[#374151]" />
            <p className="text-[#9CA3AF]">No inventory items found</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => alert('Stock Adjustment - Coming Soon!')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-[#10B981] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#10B981]/50 active:scale-95 transition-transform z-30 hover:bg-[#059669]"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

// Stats Card Component
interface StatsCardProps {
  icon: string;
  value: number | string;
  label: string;
  color?: string;
}

function StatsCard({ icon, value, label, color = 'gray' }: StatsCardProps) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-[#1F2937] border-[#374151]',
    green: 'bg-[#10B981]/10 border-[#10B981]/30',
    orange: 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
    red: 'bg-[#EF4444]/10 border-[#EF4444]/30',
    blue: 'bg-[#3B82F6]/10 border-[#3B82F6]/30',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-xl p-4 min-w-[120px]`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-[#9CA3AF]">{label}</div>
    </div>
  );
}
